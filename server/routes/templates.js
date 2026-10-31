const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { buildLines, createSubscription } = require("../utils/subscriptions");

const router = express.Router();
const adminOnly = [authenticate, requireRole("ADMIN")];
const team = [authenticate, requireRole("ADMIN", "STAFF")];

// linesJson is stored as text; the API always shows it as a "lines" array
const present = ({ linesJson, ...t }) => ({ ...t, lines: JSON.parse(linesJson) });

// Checks the lines against the plan, and keeps only the fields we need
async function checkLines(planId, rawLines) {
  const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
  if (!plan) return { error: "Plan not found" };
  if (!Array.isArray(rawLines) || rawLines.length === 0) return { error: "At least one line is required" };
  const built = await buildLines(plan, rawLines);
  if (built.error) return { error: built.error };
  const lines = rawLines.map((l) => ({
    productId: Number(l.productId),
    variantId: l.variantId ? Number(l.variantId) : undefined,
    quantity: Number(l.quantity),
    taxId: l.taxId === null ? null : l.taxId === undefined ? undefined : Number(l.taxId),
  }));
  return { lines };
}

router.get("/", team, async (req, res) => {
  const templates = await prisma.quotationTemplate.findMany({
    include: { plan: { select: { id: true, name: true, billingPeriod: true } } },
    orderBy: { id: "asc" },
  });
  res.json(templates.map(present));
});

router.get("/:id", team, async (req, res) => {
  const t = await prisma.quotationTemplate.findUnique({
    where: { id: Number(req.params.id) },
    include: { plan: true },
  });
  if (!t) return res.status(404).json({ error: "Template not found" });
  res.json(present(t));
});

router.post("/", adminOnly, async (req, res) => {
  const { name, planId, validityDays, lines } = req.body;
  const days = Number(validityDays);
  if (!name || !planId || !Number.isInteger(days) || days < 1) {
    return res.status(400).json({ error: "name, planId and validityDays (a whole number of days) are required" });
  }
  const checked = await checkLines(planId, lines);
  if (checked.error) return res.status(400).json({ error: checked.error });
  const t = await prisma.quotationTemplate.create({
    data: { name, planId: Number(planId), validityDays: days, linesJson: JSON.stringify(checked.lines) },
  });
  res.status(201).json(present(t));
});

router.put("/:id", adminOnly, async (req, res) => {
  const existing = await prisma.quotationTemplate.findUnique({ where: { id: Number(req.params.id) } });
  if (!existing) return res.status(404).json({ error: "Template not found" });
  const b = req.body;
  const planId = b.planId ?? existing.planId;
  const data = { name: b.name, planId: Number(planId) };
  if (b.validityDays != null) {
    const days = Number(b.validityDays);
    if (!Number.isInteger(days) || days < 1) return res.status(400).json({ error: "validityDays must be a whole number of at least 1" });
    data.validityDays = days;
  }
  if (b.lines != null || b.planId != null) {
    const checked = await checkLines(planId, b.lines ?? JSON.parse(existing.linesJson));
    if (checked.error) return res.status(400).json({ error: checked.error });
    data.linesJson = JSON.stringify(checked.lines);
  }
  res.json(present(await prisma.quotationTemplate.update({ where: { id: existing.id }, data })));
});

router.delete("/:id", adminOnly, async (req, res) => {
  try {
    await prisma.quotationTemplate.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Template deleted" });
  } catch (e) {
    res.status(404).json({ error: "Template not found" });
  }
});

// Start a subscription from a template.
// body: { customerId, startDate, expiryDate?, paymentTerms? }
// expiryDate falls back to the plan's end date. The quotation is valid for validityDays from now.
router.post("/:id/create-subscription", team, async (req, res) => {
  const t = await prisma.quotationTemplate.findUnique({
    where: { id: Number(req.params.id) },
    include: { plan: true },
  });
  if (!t) return res.status(404).json({ error: "Template not found" });
  const b = req.body;
  const result = await createSubscription({
    customerId: b.customerId,
    planId: t.planId,
    startDate: b.startDate,
    expiryDate: b.expiryDate || t.plan.endDate,
    paymentTerms: b.paymentTerms,
    lines: JSON.parse(t.linesJson),
    quotationExpiresAt: new Date(Date.now() + t.validityDays * 24 * 60 * 60 * 1000),
  });
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json(result.subscription);
});

module.exports = router;
