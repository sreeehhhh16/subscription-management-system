const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const team = [authenticate, requireRole("ADMIN", "STAFF")];

// Each status can only move to the ones listed here
const NEXT = {
  DRAFT: ["QUOTATION", "CLOSED"],
  QUOTATION: ["CONFIRMED", "CLOSED"],
  CONFIRMED: ["ACTIVE", "CLOSED"],
  ACTIVE: ["CLOSED"],
  CLOSED: [],
};

const fullInclude = {
  customer: { select: { id: true, email: true, name: true } },
  plan: true,
  lines: { include: { product: true, tax: true } },
};

router.get("/", authenticate, async (req, res) => {
  const where = {};
  if (req.user.role === "CUSTOMER") where.customerId = req.user.id;
  if (req.query.status) where.status = req.query.status;
  const subs = await prisma.subscription.findMany({
    where,
    include: fullInclude,
    orderBy: { id: "desc" },
  });
  res.json(subs);
});

router.get("/:id", authenticate, async (req, res) => {
  const sub = await prisma.subscription.findUnique({
    where: { id: Number(req.params.id) },
    include: fullInclude,
  });
  if (!sub || (req.user.role === "CUSTOMER" && sub.customerId !== req.user.id)) {
    return res.status(404).json({ error: "Subscription not found" });
  }
  res.json(sub);
});

router.post("/", team, async (req, res) => {
  const b = req.body;
  if (!b.customerId || !b.planId || !b.startDate || !b.expiryDate ||
      !Array.isArray(b.lines) || b.lines.length === 0) {
    return res.status(400).json({
      error: "customerId, planId, startDate, expiryDate and at least one line are required",
    });
  }
  const customer = await prisma.user.findUnique({ where: { id: Number(b.customerId) } });
  if (!customer || customer.role !== "CUSTOMER") {
    return res.status(400).json({ error: "Customer not found" });
  }
  const plan = await prisma.plan.findUnique({ where: { id: Number(b.planId) } });
  if (!plan || plan.status !== "ACTIVE") {
    return res.status(400).json({ error: "Plan not found or not active" });
  }
  const start = new Date(b.startDate);
  const expiry = new Date(b.expiryDate);
  if (expiry <= start) {
    return res.status(400).json({ error: "expiryDate must be after startDate" });
  }
  const lines = [];
  for (const l of b.lines) {
    const product = await prisma.product.findUnique({
      where: { id: Number(l.productId) },
      include: { variants: true },
    });
    if (!product) return res.status(400).json({ error: `Product ${l.productId} not found` });
    const qty = Number(l.quantity);
    if (!qty || qty < plan.minQuantity) {
      return res.status(400).json({ error: `Quantity must be at least ${plan.minQuantity}` });
    }
    let unitPrice = product.salesPrice;
    if (l.variantId) {
      const variant = product.variants.find((v) => v.id === Number(l.variantId));
      if (!variant) return res.status(400).json({ error: "Variant does not belong to this product" });
      unitPrice += variant.extraPrice;
    }
    if (l.taxId) {
      const tax = await prisma.tax.findUnique({ where: { id: Number(l.taxId) } });
      if (!tax) return res.status(400).json({ error: `Tax ${l.taxId} not found` });
    }
    lines.push({
      productId: product.id,
      quantity: qty,
      unitPrice,
      taxId: l.taxId ? Number(l.taxId) : null,
      amount: qty * unitPrice,
    });
  }
  const sub = await prisma.subscription.create({
    data: {
      number: "TMP-" + Date.now(),
      customerId: customer.id,
      planId: plan.id,
      startDate: start,
      expiryDate: expiry,
      paymentTerms: b.paymentTerms,
      lines: { create: lines },
    },
  });
  const saved = await prisma.subscription.update({
    where: { id: sub.id },
    data: { number: `SUB-${String(sub.id).padStart(5, "0")}` },
    include: fullInclude,
  });
  res.status(201).json(saved);
});

router.post("/:id/status", team, async (req, res) => {
  const sub = await prisma.subscription.findUnique({ where: { id: Number(req.params.id) } });
  if (!sub) return res.status(404).json({ error: "Subscription not found" });
  const next = req.body.status;
  if (!NEXT[sub.status].includes(next)) {
    return res.status(400).json({ error: `Cannot move from ${sub.status} to ${next}` });
  }
  const data = { status: next };
  if (next === "ACTIVE") data.nextBillingDate = sub.startDate;
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data,
    include: fullInclude,
  });
  res.json(updated);
});

module.exports = router;
