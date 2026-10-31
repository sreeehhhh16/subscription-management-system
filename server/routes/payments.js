const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const team = [authenticate, requireRole("ADMIN", "STAFF")];

const METHODS = ["CASH", "CARD", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"];
const round = (n) => Math.round(n * 100) / 100;
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

router.get("/", authenticate, async (req, res) => {
  const where = {};
  if (req.user.role === "CUSTOMER") {
    where.invoice = { subscription: { customerId: req.user.id } };
  }
  const payments = await prisma.payment.findMany({
    where,
    include: { invoice: { select: { id: true, number: true, total: true } } },
    orderBy: { paidAt: "desc" },
  });
  res.json(payments);
});

async function unpaidInvoices(onlyOverdue, asOf) {
  const where = { status: "CONFIRMED" };
  if (onlyOverdue) where.dueDate = { lt: asOf };
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      payments: true,
      subscription: {
        select: { number: true, customer: { select: { id: true, email: true, name: true } } },
      },
    },
    orderBy: { dueDate: "asc" },
  });
  return invoices
    .map((i) => {
      const paidAmount = paidSum(i.payments);
      return { ...i, paidAmount, balance: round(i.total - paidAmount) };
    })
    .filter((i) => i.balance > 0);
}

router.get("/outstanding", team, async (req, res) => {
  res.json(await unpaidInvoices(false, new Date()));
});

router.get("/overdue", team, async (req, res) => {
  const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();
  if (isNaN(asOf)) return res.status(400).json({ error: "asOf must be a valid date" });
  res.json(await unpaidInvoices(true, asOf));
});

module.exports = router;
