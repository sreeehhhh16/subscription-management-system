const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const adminOnly = [authenticate, requireRole("ADMIN")];
const PERIODS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

async function closeExpiredPlans() {
  await prisma.plan.updateMany({
    where: { autoClose: true, endDate: { lt: new Date() }, status: { not: "CLOSED" } },
    data: { status: "CLOSED" },
  });
}

router.get("/", authenticate, async (req, res) => {
  await closeExpiredPlans();
  const plans = await prisma.plan.findMany({ orderBy: { id: "asc" } });
  res.json(plans);
});

router.get("/:id", authenticate, async (req, res) => {
  await closeExpiredPlans();
  const plan = await prisma.plan.findUnique({ where: { id: Number(req.params.id) } });
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  res.json(plan);
});

router.post("/", adminOnly, async (req, res) => {
  const b = req.body;
  if (!b.name || b.price == null || !b.startDate) {
    return res.status(400).json({ error: "name, price and startDate are required" });
  }
  if (!PERIODS.includes(b.billingPeriod)) {
    return res.status(400).json({ error: "billingPeriod must be DAILY, WEEKLY, MONTHLY or YEARLY" });
  }
  const plan = await prisma.plan.create({
    data: {
      name: b.name,
      price: Number(b.price),
      billingPeriod: b.billingPeriod,
      minQuantity: Number(b.minQuantity || 1),
      startDate: new Date(b.startDate),
      endDate: b.endDate ? new Date(b.endDate) : null,
      autoClose: !!b.autoClose,
      allowPause: !!b.allowPause,
      allowRenew: !!b.allowRenew,
      allowEarlyClose: !!b.allowEarlyClose,
    },
  });
  res.status(201).json(plan);
});

router.put("/:id", adminOnly, async (req, res) => {
  const b = req.body;
  if (b.billingPeriod && !PERIODS.includes(b.billingPeriod)) {
    return res.status(400).json({ error: "billingPeriod must be DAILY, WEEKLY, MONTHLY or YEARLY" });
  }
  try {
    const plan = await prisma.plan.update({
      where: { id: Number(req.params.id) },
      data: {
        name: b.name,
        price: b.price == null ? undefined : Number(b.price),
        billingPeriod: b.billingPeriod,
        minQuantity: b.minQuantity == null ? undefined : Number(b.minQuantity),
        startDate: b.startDate ? new Date(b.startDate) : undefined,
        endDate: b.endDate ? new Date(b.endDate) : undefined,
        autoClose: b.autoClose,
        allowPause: b.allowPause,
        allowRenew: b.allowRenew,
        allowEarlyClose: b.allowEarlyClose,
      },
    });
    res.json(plan);
  } catch (e) {
    res.status(404).json({ error: "Plan not found" });
  }
});

async function getPlan(req, res) {
  const plan = await prisma.plan.findUnique({ where: { id: Number(req.params.id) } });
  if (!plan) res.status(404).json({ error: "Plan not found" });
  return plan;
}

router.post("/:id/close", adminOnly, async (req, res) => {
  const plan = await getPlan(req, res);
  if (!plan) return;
  if (!plan.allowEarlyClose) {
    return res.status(400).json({ error: "This plan cannot be closed early" });
  }
  res.json(await prisma.plan.update({ where: { id: plan.id }, data: { status: "CLOSED" } }));
});

router.post("/:id/pause", adminOnly, async (req, res) => {
  const plan = await getPlan(req, res);
  if (!plan) return;
  if (!plan.allowPause) {
    return res.status(400).json({ error: "This plan cannot be paused" });
  }
  if (plan.status !== "ACTIVE") {
    return res.status(400).json({ error: "Only an active plan can be paused" });
  }
  res.json(await prisma.plan.update({ where: { id: plan.id }, data: { status: "PAUSED" } }));
});

router.post("/:id/renew", adminOnly, async (req, res) => {
  const plan = await getPlan(req, res);
  if (!plan) return;
  if (!plan.allowRenew) {
    return res.status(400).json({ error: "This plan cannot be renewed" });
  }
  const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
  if (!endDate || endDate <= new Date()) {
    return res.status(400).json({ error: "Provide a new endDate in the future" });
  }
  res.json(await prisma.plan.update({ where: { id: plan.id }, data: { status: "ACTIVE", endDate } }));
});

module.exports = router;
