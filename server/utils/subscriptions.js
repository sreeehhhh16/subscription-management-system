const prisma = require("../db");
const { round } = require("./discounts");

const fullInclude = {
  customer: { select: { id: true, email: true, name: true } },
  plan: true,
  lines: { include: { product: true, tax: true, variant: true } },
};

// Checks every line and works out its price.
// taxId left out  -> the default tax is used (if the admin set one)
// taxId null      -> no tax on this line
async function buildLines(plan, rawLines) {
  const defaultTax = await prisma.tax.findFirst({ where: { isDefault: true } });
  const lines = [];
  for (const l of rawLines) {
    const product = await prisma.product.findUnique({
      where: { id: Number(l.productId) },
      include: { variants: true },
    });
    if (!product) return { error: `Product ${l.productId} not found` };
    const qty = Number(l.quantity);
    if (!Number.isInteger(qty) || qty < plan.minQuantity) {
      return { error: `Quantity must be a whole number of at least ${plan.minQuantity}` };
    }
    let unitPrice = product.salesPrice;
    let variantId = null;
    if (l.variantId) {
      const variant = product.variants.find((v) => v.id === Number(l.variantId));
      if (!variant) return { error: "Variant does not belong to this product" };
      variantId = variant.id;
      unitPrice += variant.extraPrice;
    }
    let taxId = null;
    if (l.taxId === undefined) {
      taxId = defaultTax ? defaultTax.id : null;
    } else if (l.taxId !== null) {
      const tax = await prisma.tax.findUnique({ where: { id: Number(l.taxId) } });
      if (!tax) return { error: `Tax ${l.taxId} not found` };
      taxId = tax.id;
    }
    lines.push({
      productId: product.id,
      variantId,
      quantity: qty,
      unitPrice,
      taxId,
      amount: round(qty * unitPrice),
    });
  }
  return { lines };
}

// Used by the normal create route and by "create from template"
async function createSubscription(b) {
  if (!b.customerId || !b.planId || !b.startDate || !b.expiryDate ||
      !Array.isArray(b.lines) || b.lines.length === 0) {
    return { error: "customerId, planId, startDate, expiryDate and at least one line are required" };
  }
  const customer = await prisma.user.findUnique({ where: { id: Number(b.customerId) } });
  if (!customer || customer.role !== "CUSTOMER") return { error: "Customer not found" };

  const plan = await prisma.plan.findUnique({ where: { id: Number(b.planId) } });
  if (!plan || plan.status !== "ACTIVE") return { error: "Plan not found or not active" };

  const start = new Date(b.startDate);
  const expiry = new Date(b.expiryDate);
  if (isNaN(start) || isNaN(expiry)) return { error: "startDate and expiryDate must be valid dates" };
  if (expiry <= start) return { error: "expiryDate must be after startDate" };
  if (start < plan.startDate || (plan.endDate && start > plan.endDate)) {
    return { error: "This plan is not available on the chosen start date" };
  }

  const built = await buildLines(plan, b.lines);
  if (built.error) return { error: built.error };

  const subscription = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        number: `TMP-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        customerId: customer.id,
        planId: plan.id,
        startDate: start,
        expiryDate: expiry,
        paymentTerms: b.paymentTerms,
        quotationExpiresAt: b.quotationExpiresAt || null,
        lines: { create: built.lines },
      },
    });
    return tx.subscription.update({
      where: { id: sub.id },
      data: { number: `SUB-${String(sub.id).padStart(5, "0")}` },
      include: fullInclude,
    });
  });
  return { subscription };
}

module.exports = { buildLines, createSubscription, fullInclude };
