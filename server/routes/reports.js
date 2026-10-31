const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { dateFilter } = require("../utils/paginate");
const { round } = require("../utils/discounts");

const router = express.Router();
const team = [authenticate, requireRole("ADMIN", "STAFF")];

// How many billing periods fit in a month, to turn any plan into "per month"
const PER_MONTH = { DAILY: 30, WEEKLY: 52 / 12, MONTHLY: 1, YEARLY: 1 / 12 };

const sum = (agg, field) => round(agg._sum[field] || 0);

// GET /api/reports/summary?from=2026-10-01&to=2026-10-31
// from/to filter the money that came in and the invoices issued (default: this month so far).
// Subscription counts, recurring revenue, outstanding and overdue always show how things stand right now.
router.get("/summary", team, async (req, res) => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const d = dateFilter(req.query.from || monthStart.toISOString(), req.query.to);
  if (d.error) return res.status(400).json({ error: d.error });
  const range = { gte: d.filter.gte, lte: d.filter.lte || now };

  const [byStatus, collected, invoiced, outstanding, outstandingPaid, overdue, overduePaid, activeLines] =
    await Promise.all([
      prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.payment.aggregate({ where: { paidAt: range }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.invoice.aggregate({
        where: { status: { in: ["CONFIRMED", "PAID"] }, issueDate: range },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.invoice.aggregate({ where: { status: "CONFIRMED" }, _sum: { total: true }, _count: { _all: true } }),
      prisma.payment.aggregate({ where: { invoice: { status: "CONFIRMED" } }, _sum: { amount: true } }),
      prisma.invoice.aggregate({
        where: { status: "CONFIRMED", dueDate: { lt: now } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        where: { invoice: { status: "CONFIRMED", dueDate: { lt: now } } },
        _sum: { amount: true },
      }),
      prisma.subscriptionLine.findMany({
        where: { subscription: { status: "ACTIVE" } },
        select: { amount: true, subscription: { select: { plan: { select: { billingPeriod: true } } } } },
      }),
    ]);

  const counts = { DRAFT: 0, QUOTATION: 0, CONFIRMED: 0, ACTIVE: 0, CLOSED: 0 };
  byStatus.forEach((g) => (counts[g.status] = g._count._all));

  // Recurring revenue from active subscriptions, before tax and discounts
  const mrr = round(
    activeLines.reduce((s, l) => s + l.amount * (PER_MONTH[l.subscription.plan.billingPeriod] || 0), 0)
  );

  res.json({
    range: { from: range.gte, to: range.lte },
    subscriptions: { active: counts.ACTIVE, byStatus: counts },
    recurring: { mrr, arr: round(mrr * 12) },
    invoiced: { count: invoiced._count._all, total: sum(invoiced, "total") },
    collected: { count: collected._count._all, total: sum(collected, "amount") },
    outstanding: { count: outstanding._count._all, amount: round(sum(outstanding, "total") - sum(outstandingPaid, "amount")) },
    overdue: { count: overdue._count._all, amount: round(sum(overdue, "total") - sum(overduePaid, "amount")) },
  });
});

// GET /api/reports/revenue-by-month?months=12  -> data for a chart
router.get("/revenue-by-month", team, async (req, res) => {
  const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 12));
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const key = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

  const buckets = {};
  for (let i = 0; i < months; i++) {
    buckets[key(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)))] = { month: null, invoiced: 0, collected: 0 };
  }
  Object.keys(buckets).forEach((k) => (buckets[k].month = k));

  const [payments, invoices] = await Promise.all([
    prisma.payment.findMany({ where: { paidAt: { gte: start } }, select: { paidAt: true, amount: true } }),
    prisma.invoice.findMany({
      where: { status: { in: ["CONFIRMED", "PAID"] }, issueDate: { gte: start } },
      select: { issueDate: true, total: true },
    }),
  ]);
  payments.forEach((p) => { const b = buckets[key(p.paidAt)]; if (b) b.collected = round(b.collected + p.amount); });
  invoices.forEach((i) => { const b = buckets[key(i.issueDate)]; if (b) b.invoiced = round(b.invoiced + i.total); });

  res.json(Object.values(buckets));
});

module.exports = router;
