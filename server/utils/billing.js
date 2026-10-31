const prisma = require("../db");
const { applyDiscounts, round } = require("./discounts");

function addPeriod(date, period) {
  const d = new Date(date);
  if (period === "DAILY") d.setUTCDate(d.getUTCDate() + 1);
  else if (period === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7);
  else if (period === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (period === "YEARLY") d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

// "Net 15" gives 15 days; no number gives 15
function dueDays(terms) {
  const m = /(\d+)/.exec(terms || "");
  return m ? Number(m[1]) : 15;
}

const describe = (l) =>
  l.variant ? `${l.product.name} (${l.variant.attribute}: ${l.variant.value})` : l.product.name;

// Invoice maths:
//   subtotal      = sum of the product lines, before discounts and tax
//   discountTotal = everything taken off (also shown as negative "Discount: ..." lines)
//   taxTotal      = tax worked out on what is left after discounts
//   total         = subtotal - discountTotal + taxTotal
async function billOnePeriod(sub, discounts) {
  const periodStart = sub.nextBillingDate;
  const base = sub.lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
    amount: round(l.quantity * l.unitPrice),
  }));
  const { net, applied, total: discountTotal } = applyDiscounts(base, discounts, sub.id, periodStart);

  let subtotal = 0;
  let taxTotal = 0;
  const lines = sub.lines.map((l, i) => {
    subtotal += base[i].amount;
    if (l.tax) taxTotal += round((net[i] * l.tax.ratePct) / 100);
    return {
      description: describe(l),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxId: l.taxId,
      amount: base[i].amount,
    };
  });
  const discountLines = applied.map((a) => ({
    description: `Discount: ${a.discount.name}`,
    quantity: 1,
    unitPrice: -a.amount,
    taxId: null,
    discountId: a.discount.id,
    amount: -a.amount,
  }));
  subtotal = round(subtotal);
  taxTotal = round(taxTotal);
  const total = round(subtotal - discountTotal + taxTotal);
  const dueDate = new Date(periodStart);
  dueDate.setUTCDate(dueDate.getUTCDate() + dueDays(sub.paymentTerms));

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        number: `TMP-${sub.id}-${periodStart.getTime()}`,
        subscriptionId: sub.id,
        status: "DRAFT",
        dueDate,
        billingPeriodStart: periodStart,
        subtotal,
        taxTotal,
        discountTotal,
        total,
        lines: { create: [...lines, ...discountLines] },
      },
    });
    // Count the use. The check stops two runs at once from going past the limit.
    for (const a of applied) {
      const r = await tx.discount.updateMany({
        where: {
          id: a.discount.id,
          ...(a.discount.usageLimit != null ? { timesUsed: { lt: a.discount.usageLimit } } : {}),
        },
        data: { timesUsed: { increment: 1 } },
      });
      if (r.count === 0) throw new Error(`Discount "${a.discount.name}" has reached its usage limit`);
    }
    await tx.subscription.update({
      where: { id: sub.id },
      data: { nextBillingDate: addPeriod(periodStart, sub.plan.billingPeriod) },
    });
    return tx.invoice.update({
      where: { id: inv.id },
      data: { number: `INV-${String(inv.id).padStart(5, "0")}` },
    });
  });
  for (const a of applied) a.discount.timesUsed += 1; // keep the in-memory copy in step
  return invoice;
}

// Active subscriptions past their expiry date, with every period already billed, are closed
async function closeFinishedSubscriptions(asOf) {
  const candidates = await prisma.subscription.findMany({
    where: { status: "ACTIVE", expiryDate: { lt: asOf } },
    select: { id: true, nextBillingDate: true, expiryDate: true },
  });
  const ids = candidates
    .filter((s) => !s.nextBillingDate || s.nextBillingDate > s.expiryDate)
    .map((s) => s.id);
  if (ids.length) {
    await prisma.subscription.updateMany({ where: { id: { in: ids } }, data: { status: "CLOSED" } });
  }
  return ids.length;
}

async function generateDueInvoices(asOf) {
  const subs = await prisma.subscription.findMany({
    where: { status: "ACTIVE", nextBillingDate: { lte: asOf } },
    include: { plan: true, lines: { include: { product: true, tax: true, variant: true } } },
  });
  // Discount rules are few, so load them once for the whole run (oldest first, so they stack in a fixed order)
  const discounts = await prisma.discount.findMany({ orderBy: { id: "asc" } });
  const created = [];
  const skipped = [];
  for (const first of subs) {
    let sub = first;
    let guard = 0;
    while (
      sub.nextBillingDate &&
      sub.nextBillingDate <= asOf &&
      sub.nextBillingDate <= sub.expiryDate &&
      guard++ < 60
    ) {
      const next = addPeriod(sub.nextBillingDate, sub.plan.billingPeriod);
      try {
        const inv = await billOnePeriod(sub, discounts);
        created.push(inv.number);
      } catch (e) {
        if (e.code !== "P2002") {
          skipped.push({ subscription: sub.number, reason: e.message });
          break;
        }
        // This period already has an invoice: just move on to the next one
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { nextBillingDate: next },
        });
        skipped.push({ subscription: sub.number, reason: "period already billed" });
      }
      sub = { ...sub, nextBillingDate: next };
    }
  }
  const closed = await closeFinishedSubscriptions(asOf);
  return { created, skipped, closedSubscriptions: closed };
}

module.exports = { generateDueInvoices, closeFinishedSubscriptions };
