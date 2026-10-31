const prisma = require("../db");

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

const round = (n) => Math.round(n * 100) / 100;

async function billOnePeriod(sub) {
  const periodStart = sub.nextBillingDate;
  let subtotal = 0;
  let taxTotal = 0;
  const lines = sub.lines.map((l) => {
    const amount = round(l.quantity * l.unitPrice);
    const tax = l.tax ? round((amount * l.tax.ratePct) / 100) : 0;
    subtotal += amount;
    taxTotal += tax;
    return {
      description: l.product.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxId: l.taxId,
      amount,
    };
  });
  subtotal = round(subtotal);
  taxTotal = round(taxTotal);
  const total = round(subtotal + taxTotal);
  const dueDate = new Date(periodStart);
  dueDate.setUTCDate(dueDate.getUTCDate() + dueDays(sub.paymentTerms));

  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        number: `TMP-${sub.id}-${periodStart.getTime()}`,
        subscriptionId: sub.id,
        status: "DRAFT",
        dueDate,
        billingPeriodStart: periodStart,
        subtotal,
        taxTotal,
        discountTotal: 0,
        total,
        lines: { create: lines },
      },
    });
    await tx.subscription.update({
      where: { id: sub.id },
      data: { nextBillingDate: addPeriod(periodStart, sub.plan.billingPeriod) },
    });
    return tx.invoice.update({
      where: { id: inv.id },
      data: { number: `INV-${String(inv.id).padStart(5, "0")}` },
    });
  });
}

async function generateDueInvoices(asOf) {
  const subs = await prisma.subscription.findMany({
    where: { status: "ACTIVE", nextBillingDate: { lte: asOf } },
    include: { plan: true, lines: { include: { product: true, tax: true } } },
  });
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
        const inv = await billOnePeriod(sub);
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
  return { created, skipped };
}

module.exports = { generateDueInvoices };
