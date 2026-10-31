const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { parsePage, pageResult, dateFilter } = require("../utils/paginate");
const { round } = require("../utils/discounts");

const router = express.Router();
const team = [authenticate, requireRole("ADMIN", "STAFF")];

const METHODS = ["CASH", "CARD", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"];
const paidSum = (payments) => round(payments.reduce((s, p) => s + p.amount, 0));

router.post("/", team, async (req, res) => {
  const b = req.body;
  const amount = Number(b.amount);
  const method = String(b.method || "").toUpperCase();
  if (!b.invoiceId || !amount || amount <= 0) {
    return res.status(400).json({ error: "invoiceId and a positive amount are required" });
  }
  if (!METHODS.includes(method)) {
    return res.status(400).json({ error: `method must be one of ${METHODS.join(", ")}` });
  }
  const paidAt = b.paidAt ? new Date(b.paidAt) : new Date();
  if (isNaN(paidAt)) return res.status(400).json({ error: "paidAt must be a valid date" });
  const result = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({
      where: { id: Number(b.invoiceId) },
      include: { payments: true },
    });
    if (!inv) return { code: 404, error: "Invoice not found" };
    if (inv.status !== "CONFIRMED") {
      return { code: 400, error: `Only a confirmed invoice can receive payments (this one is ${inv.status})` };
    }
    const balance = round(inv.total - paidSum(inv.payments));
    if (amount > balance) {
      return { code: 400, error: `Amount exceeds the outstanding balance of ${balance}` };
    }
    const payment = await tx.payment.create({
      data: { invoiceId: inv.id, method, amount, paidAt, note: b.note },
    });
    const newBalance = round(balance - amount);
    if (newBalance <= 0) {
      await tx.invoice.update({ where: { id: inv.id }, data: { status: "PAID" } });
    }
    return { payment, newBalance, invoiceStatus: newBalance <= 0 ? "PAID" : "CONFIRMED" };
  });
  if (result.error) return res.status(result.code).json({ error: result.error });
  res.status(201).json(result);
});

// GET /api/payments?method=UPI&invoiceId=3&from=2026-10-01&to=2026-10-31&page=1
// Customers always get only their own.
router.get("/", authenticate, async (req, res) => {
  const q = req.query;
  const where = {};
  if (req.user.role === "CUSTOMER") {
    where.invoice = { subscription: { customerId: req.user.id } };
  }
  if (q.invoiceId) where.invoiceId = Number(q.invoiceId);
  if (q.method) where.method = String(q.method).toUpperCase();
  const d = dateFilter(q.from, q.to);
  if (d.error) return res.status(400).json({ error: d.error });
  if (d.filter) where.paidAt = d.filter;
  const p = parsePage(q);
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            total: true,
            subscription: { select: { number: true, customer: { select: { id: true, email: true, name: true } } } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
      skip: p.skip,
      take: p.take,
    }),
    prisma.payment.count({ where }),
  ]);
  res.json(pageResult(items, total, p));
});

// A confirmed invoice always has something left to pay: once it is fully paid it becomes PAID
async function unpaidInvoices(query, onlyOverdue, asOf) {
  const where = { status: "CONFIRMED" };
  if (onlyOverdue) where.dueDate = { lt: asOf };
  const p = parsePage(query);
  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        payments: { select: { amount: true } },
        subscription: { select: { number: true, customer: { select: { id: true, email: true, name: true } } } },
      },
      orderBy: { dueDate: "asc" },
      skip: p.skip,
      take: p.take,
    }),
    prisma.invoice.count({ where }),
  ]);
  const items = rows.map((i) => {
    const paidAmount = paidSum(i.payments);
    const daysOverdue = Math.max(0, Math.floor((asOf - i.dueDate) / 86400000));
    return { ...i, paidAmount, balance: round(i.total - paidAmount), daysOverdue };
  });
  return pageResult(items, total, p);
}

router.get("/outstanding", team, async (req, res) => {
  res.json(await unpaidInvoices(req.query, false, new Date()));
});

router.get("/overdue", team, async (req, res) => {
  const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();
  if (isNaN(asOf)) return res.status(400).json({ error: "asOf must be a valid date" });
  res.json(await unpaidInvoices(req.query, true, asOf));
});

module.exports = router;
