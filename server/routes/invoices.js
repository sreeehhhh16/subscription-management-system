const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { generateDueInvoices } = require("../utils/billing");
const { parsePage, pageResult, dateFilter } = require("../utils/paginate");
const { sendMail } = require("../utils/mailer");
const { round } = require("../utils/discounts");

const router = express.Router();
const team = [authenticate, requireRole("ADMIN", "STAFF")];

// PAID is set by recording a payment, not by hand
const NEXT = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

const customerSelect = { select: { id: true, email: true, name: true } };

// Adds how much is paid, how much is left, and whether it is overdue
function withBalance(inv) {
  const paidAmount = round(inv.payments.reduce((s, p) => s + p.amount, 0));
  const balance = inv.status === "CANCELLED" ? 0 : round(inv.total - paidAmount);
  return {
    ...inv,
    paidAmount,
    balance,
    isOverdue: inv.status === "CONFIRMED" && balance > 0 && inv.dueDate < new Date(),
  };
}

const detailInclude = {
  subscription: { select: { id: true, number: true, paymentTerms: true, customer: customerSelect } },
  lines: { include: { tax: true } },
  payments: { orderBy: { paidAt: "asc" } },
};

// GET /api/invoices?status=CONFIRMED&overdue=true&search=INV-00012&from=2026-10-01&to=2026-10-31&page=1
// Customers always get only their own.
router.get("/", authenticate, async (req, res) => {
  const q = req.query;
  const where = {};
  const subWhere = {};
  if (req.user.role === "CUSTOMER") subWhere.customerId = req.user.id;
  else if (q.customerId) subWhere.customerId = Number(q.customerId);
  if (Object.keys(subWhere).length) where.subscription = subWhere;
  if (q.subscriptionId) where.subscriptionId = Number(q.subscriptionId);
  if (q.status) where.status = String(q.status).toUpperCase();
  if (q.overdue === "true") {
    where.status = "CONFIRMED";
    where.dueDate = { lt: new Date() };
  }
  if (q.search) where.number = { contains: String(q.search).trim() };
  const d = dateFilter(q.from, q.to);
  if (d.error) return res.status(400).json({ error: d.error });
  if (d.filter) where.issueDate = d.filter;

  const p = parsePage(q);
  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        subscription: { select: { id: true, number: true, customer: customerSelect } },
        payments: { select: { amount: true } },
      },
      orderBy: { id: "desc" },
      skip: p.skip,
      take: p.take,
    }),
    prisma.invoice.count({ where }),
  ]);
  res.json(pageResult(rows.map(withBalance), total, p));
});

router.get("/:id", authenticate, async (req, res) => {
  const inv = await prisma.invoice.findUnique({ where: { id: Number(req.params.id) }, include: detailInclude });
  if (!inv || (req.user.role === "CUSTOMER" && inv.subscription.customer.id !== req.user.id)) {
    return res.status(404).json({ error: "Invoice not found" });
  }
  res.json(withBalance(inv));
});

// Bills every active subscription that is due. Safe to run again: a period is never billed twice.
router.post("/generate", team, async (req, res) => {
  const asOf = req.body.asOf ? new Date(req.body.asOf) : new Date();
  if (isNaN(asOf)) return res.status(400).json({ error: "asOf must be a valid date" });
  res.json(await generateDueInvoices(asOf));
});

router.post("/:id/status", team, async (req, res) => {
  const inv = await prisma.invoice.findUnique({ where: { id: Number(req.params.id) } });
  if (!inv) return res.status(404).json({ error: "Invoice not found" });
  const next = req.body.status;
  if (!(NEXT[inv.status] || []).includes(next)) {
    return res.status(400).json({ error: `Cannot move from ${inv.status} to ${next}` });
  }
  if (next === "CANCELLED" && (await prisma.payment.count({ where: { invoiceId: inv.id } })) > 0) {
    return res.status(400).json({ error: "This invoice already has payments, so it cannot be cancelled" });
  }
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: inv.id }, data: { status: next } });
    if (next === "CANCELLED") {
      // Give back the discount uses this invoice took
      const used = await tx.invoiceLine.findMany({ where: { invoiceId: inv.id, discountId: { not: null } } });
      for (const l of used) {
        await tx.discount.updateMany({ where: { id: l.discountId, timesUsed: { gt: 0 } }, data: { timesUsed: { decrement: 1 } } });
      }
    }
  });
  const updated = await prisma.invoice.findUnique({ where: { id: inv.id }, include: detailInclude });
  res.json(withBalance(updated));
});

// Emails the invoice to the customer (or prints it in the server terminal until SMTP is set up)
router.post("/:id/send", team, async (req, res) => {
  const inv = await prisma.invoice.findUnique({
    where: { id: Number(req.params.id) },
    include: detailInclude,
  });
  if (!inv) return res.status(404).json({ error: "Invoice not found" });
  if (inv.status !== "CONFIRMED") {
    return res.status(400).json({ error: "Only a confirmed invoice can be sent" });
  }
  const c = inv.subscription.customer;
  const lines = inv.lines.map((l) => `  ${l.description}: ${l.amount}`).join("\n");
  const result = await sendMail({
    to: c.email,
    subject: `Invoice ${inv.number} from Brightloop`,
    text:
      `Hello ${c.name || ""},\n\nYour invoice ${inv.number} for subscription ${inv.subscription.number} is ready.\n\n` +
      `${lines}\n\nTax: ${inv.taxTotal}\nTotal due: ${inv.total}\nDue date: ${inv.dueDate.toISOString().slice(0, 10)}\n`,
  });
  await prisma.invoice.update({ where: { id: inv.id }, data: { sentAt: new Date() } });
  const updated = await prisma.invoice.findUnique({ where: { id: inv.id }, include: detailInclude });
  res.json({ ...withBalance(updated), emailSent: result.sent });
});

module.exports = router;
