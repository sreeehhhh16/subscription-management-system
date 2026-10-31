const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { parsePage, pageResult } = require("../utils/paginate");
const { createSubscription, fullInclude } = require("../utils/subscriptions");
const { round } = require("../utils/discounts");

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

// Lighter than fullInclude, for list pages
const listInclude = {
  customer: { select: { id: true, email: true, name: true } },
  plan: { select: { id: true, name: true, billingPeriod: true } },
  lines: { select: { amount: true } },
};

// GET /api/subscriptions?status=ACTIVE&search=acme&planId=1&customerId=5&page=1&limit=20
// Customers always get only their own.
router.get("/", authenticate, async (req, res) => {
  const isCustomer = req.user.role === "CUSTOMER";
  const q = req.query;
  const where = {};
  if (isCustomer) where.customerId = req.user.id;
  else if (q.customerId) where.customerId = Number(q.customerId);
  if (q.status) where.status = String(q.status).toUpperCase();
  if (q.planId) where.planId = Number(q.planId);
  const search = String(q.search || "").trim();
  if (search) {
    where.OR = [{ number: { contains: search } }];
    if (!isCustomer) {
      where.OR.push({ customer: { email: { contains: search } } }, { customer: { name: { contains: search } } });
    }
  }
  const p = parsePage(q);
  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({ where, include: listInclude, orderBy: { id: "desc" }, skip: p.skip, take: p.take }),
    prisma.subscription.count({ where }),
  ]);
  const items = rows.map(({ lines, ...s }) => ({
    ...s,
    lineCount: lines.length,
    amount: round(lines.reduce((sum, l) => sum + l.amount, 0)),
  }));
  res.json(pageResult(items, total, p));
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
  const result = await createSubscription(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json(result.subscription);
});

router.post("/:id/status", team, async (req, res) => {
  const sub = await prisma.subscription.findUnique({ where: { id: Number(req.params.id) } });
  if (!sub) return res.status(404).json({ error: "Subscription not found" });
  const next = req.body.status;
  if (!(NEXT[sub.status] || []).includes(next)) {
    return res.status(400).json({ error: `Cannot move from ${sub.status} to ${next}` });
  }
  if (next === "CONFIRMED" && sub.quotationExpiresAt && sub.quotationExpiresAt < new Date()) {
    return res.status(400).json({
      error: `This quotation expired on ${sub.quotationExpiresAt.toISOString().slice(0, 10)}`,
    });
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

// A customer can close their own active subscription, if its plan allows early closing
router.post("/:id/cancel", authenticate, requireRole("CUSTOMER"), async (req, res) => {
  const sub = await prisma.subscription.findUnique({
    where: { id: Number(req.params.id) },
    include: { plan: true },
  });
  if (!sub || sub.customerId !== req.user.id) {
    return res.status(404).json({ error: "Subscription not found" });
  }
  if (sub.status !== "ACTIVE") {
    return res.status(400).json({ error: "Only an active subscription can be closed" });
  }
  if (!sub.plan.allowEarlyClose) {
    return res.status(400).json({ error: "This plan cannot be closed early. Please contact us." });
  }
  res.json(
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CLOSED" }, include: fullInclude })
  );
});

module.exports = router;
