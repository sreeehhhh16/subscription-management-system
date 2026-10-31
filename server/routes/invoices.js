const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { generateDueInvoices } = require("../utils/billing");

const router = express.Router();
const team = [authenticate, requireRole("ADMIN", "STAFF")];

// PAID is set by recording a payment (a later step), not by hand
const NEXT = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

const fullInclude = {
  subscription: {
    select: {
      id: true,
      number: true,
      customer: { select: { id: true, email: true, name: true } },
    },
  },
  lines: { include: { tax: true } },
  payments: true,
};

router.get("/", authenticate, async (req, res) => {
  const where = {};
  if (req.user.role === "CUSTOMER") where.subscription = { customerId: req.user.id };
  if (req.query.status) where.status = req.query.status;
  const invoices = await prisma.invoice.findMany({
    where,
    include: fullInclude,
    orderBy: { id: "desc" },
  });
  res.json(invoices);
});

router.get("/:id", authenticate, async (req, res) => {
  const inv = await prisma.invoice.findUnique({
    where: { id: Number(req.params.id) },
    include: fullInclude,
  });
  if (!inv || (req.user.role === "CUSTOMER" && inv.subscription.customer.id !== req.user.id)) {
    return res.status(404).json({ error: "Invoice not found" });
  }
  res.json(inv);
});

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
  const updated = await prisma.invoice.update({
    where: { id: inv.id },
    data: { status: next },
    include: fullInclude,
  });
  res.json(updated);
});

module.exports = router;
