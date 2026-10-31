// Fills the database with demo data so the dashboard has something to show and you can test speed.
//   node seed-demo.js          (300 customers and subscriptions)
//   node seed-demo.js 2000
// Safe to run more than once: it only adds more. Demo customers use the password Demo@12345
const bcrypt = require("bcrypt");
const prisma = require("./db");
const { generateDueInvoices } = require("./utils/billing");

const N = Number(process.argv[2]) || 300;
const pick = (arr, i) => arr[i % arr.length];
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

async function main() {
  console.log(`Seeding ${N} customers and subscriptions...`);
  const tag = Date.now().toString(36);

  let tax = await prisma.tax.findFirst({ where: { isDefault: true } });
  if (!tax) tax = await prisma.tax.create({ data: { name: "GST 18%", ratePct: 18, isDefault: true } });

  const products = [];
  for (const [name, type, price, cost] of [
    ["Brightloop CRM", "Software", 1200, 300],
    ["Brightloop Analytics", "Software", 800, 200],
    ["Extra seats pack", "Add-on", 300, 60],
  ]) {
    products.push(await prisma.product.create({ data: { name: `${name} ${tag}`, type, salesPrice: price, costPrice: cost } }));
  }
  await prisma.productVariant.create({ data: { productId: products[0].id, attribute: "Brand", value: "Odoo", extraPrice: 560 } });

  const plans = [];
  for (const [name, price, period] of [["Monthly Starter", 1200, "MONTHLY"], ["Yearly Business", 12000, "YEARLY"], ["Weekly Trial", 300, "WEEKLY"]]) {
    plans.push(await prisma.plan.create({
      data: { name: `${name} ${tag}`, price, billingPeriod: period, startDate: daysAgo(400), allowPause: true, allowRenew: true, allowEarlyClose: true },
    }));
  }

  await prisma.discount.create({
    data: { name: `Volume discount ${tag}`, type: "PERCENT", value: 10, minQuantity: 5, startDate: daysAgo(30), endDate: new Date(Date.now() + 180 * 86400000), usageLimit: 200 },
  });

  const passwordHash = await bcrypt.hash("Demo@12345", 10);
  for (let i = 0; i < N; i++) {
    const customer = await prisma.user.create({
      data: { email: `demo-${tag}-${i}@example.com`, name: `Demo Customer ${i + 1}`, passwordHash, role: "CUSTOMER" },
    });
    const plan = pick(plans, i);
    const start = daysAgo(20 + ((i * 7) % 150));
    const qty = 1 + (i % 8);
    const product = pick(products, i);
    const sub = await prisma.subscription.create({
      data: {
        number: `TMP-${tag}-${i}`,
        customerId: customer.id,
        planId: plan.id,
        status: "ACTIVE",
        startDate: start,
        expiryDate: new Date(Date.now() + 365 * 86400000),
        paymentTerms: "Net 15",
        nextBillingDate: start,
        lines: { create: [{ productId: product.id, quantity: qty, unitPrice: product.salesPrice, taxId: tax.id, amount: qty * product.salesPrice }] },
      },
    });
    await prisma.subscription.update({ where: { id: sub.id }, data: { number: `SUB-${String(sub.id).padStart(5, "0")}` } });
  }

  console.log("Generating invoices...");
  const result = await generateDueInvoices(new Date());
  console.log(`  ${result.created.length} invoices created, ${result.skipped.length} skipped`);

  // Confirm everything that is still a draft, then pay about 60% of them in full
  await prisma.invoice.updateMany({ where: { status: "DRAFT" }, data: { status: "CONFIRMED" } });
  const open = await prisma.invoice.findMany({ where: { status: "CONFIRMED" }, select: { id: true, total: true, dueDate: true }, orderBy: { id: "asc" } });
  const methods = ["CARD", "BANK_TRANSFER", "UPI", "CASH"];
  const toPay = open.filter((_, i) => i % 5 < 3);
  await prisma.payment.createMany({
    data: toPay.map((inv, i) => ({ invoiceId: inv.id, method: pick(methods, i), amount: inv.total, paidAt: daysAgo(i % 60), note: "Demo payment" })),
  });
  await prisma.invoice.updateMany({ where: { id: { in: toPay.map((i) => i.id) } }, data: { status: "PAID" } });
  console.log(`  ${toPay.length} invoices paid, ${open.length - toPay.length} left outstanding`);
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
