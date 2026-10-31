const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { parsePage, pageResult } = require("../utils/paginate");

const router = express.Router();
const adminOnly = [authenticate, requireRole("ADMIN")];
const team = [authenticate, requireRole("ADMIN", "STAFF")];
const TYPES = ["PERCENT", "FIXED"];

const optNumber = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

// Checks a discount body (used by create and update). Returns { error } or { data }.
async function clean(b, existing = {}) {
  const m = { ...existing, ...b };
  const type = String(m.type || "").toUpperCase();
  if (!m.name) return { error: "name is required" };
  if (!TYPES.includes(type)) return { error: "type must be PERCENT or FIXED" };
  const value = Number(m.value);
  if (!(value > 0)) return { error: "value must be greater than 0" };
  if (type === "PERCENT" && value > 100) return { error: "A percentage cannot be more than 100" };
  const startDate = new Date(m.startDate);
  const endDate = new Date(m.endDate);
  if (isNaN(startDate) || isNaN(endDate)) return { error: "startDate and endDate are required" };
  if (endDate < startDate) return { error: "endDate cannot be before startDate" };
  const minPurchase = optNumber(m.minPurchase);
  const minQuantity = optNumber(m.minQuantity);
  const usageLimit = optNumber(m.usageLimit);
  if (minPurchase != null && minPurchase < 0) return { error: "minPurchase cannot be negative" };
  if (minQuantity != null && (!Number.isInteger(minQuantity) || minQuantity < 1)) {
    return { error: "minQuantity must be a whole number of at least 1" };
  }
  if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
    return { error: "usageLimit must be a whole number of at least 1" };
  }
  const productId = optNumber(m.productId);
  const subscriptionId = optNumber(m.subscriptionId);
  if (productId != null && !(await prisma.product.findUnique({ where: { id: productId } }))) {
    return { error: "Product not found" };
  }
  if (subscriptionId != null && !(await prisma.subscription.findUnique({ where: { id: subscriptionId } }))) {
    return { error: "Subscription not found" };
  }
  return {
    data: { name: m.name, type, value, minPurchase, minQuantity, startDate, endDate, usageLimit, productId, subscriptionId },
  };
}

// GET /api/discounts?active=true&page=1
router.get("/", team, async (req, res) => {
  const where = {};
  if (req.query.active === "true") {
    const now = new Date();
    where.startDate = { lte: now };
    where.endDate = { gte: now };
  }
  const p = parsePage(req.query);
  const [rows, total] = await Promise.all([
    prisma.discount.findMany({
      where,
      include: { product: { select: { id: true, name: true } }, subscription: { select: { id: true, number: true } } },
      orderBy: { id: "desc" },
      skip: p.skip,
      take: p.take,
    }),
    prisma.discount.count({ where }),
  ]);
  const now = new Date();
  const items = rows.map((d) => ({
    ...d,
    isActive:
      d.startDate <= now && d.endDate >= now && (d.usageLimit == null || d.timesUsed < d.usageLimit),
  }));
  res.json(pageResult(items, total, p));
});

router.post("/", adminOnly, async (req, res) => {
  const c = await clean(req.body);
  if (c.error) return res.status(400).json({ error: c.error });
  res.status(201).json(await prisma.discount.create({ data: c.data }));
});

router.put("/:id", adminOnly, async (req, res) => {
  const existing = await prisma.discount.findUnique({ where: { id: Number(req.params.id) } });
  if (!existing) return res.status(404).json({ error: "Discount not found" });
  const c = await clean(req.body, existing);
  if (c.error) return res.status(400).json({ error: c.error });
  res.json(await prisma.discount.update({ where: { id: existing.id }, data: c.data }));
});

router.delete("/:id", adminOnly, async (req, res) => {
  try {
    await prisma.discount.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Discount deleted" });
  } catch (e) {
    res.status(404).json({ error: "Discount not found" });
  }
});

module.exports = router;
