const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const adminOnly = [authenticate, requireRole("ADMIN")];

// Only one tax can be the default. It is used on any subscription line that does not name a tax.
async function makeOnlyDefault(id) {
  await prisma.tax.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
}

router.get("/", authenticate, async (req, res) => {
  res.json(await prisma.tax.findMany({ orderBy: { id: "asc" } }));
});

router.post("/", adminOnly, async (req, res) => {
  const { name, ratePct, isDefault } = req.body;
  if (!name || ratePct == null || Number(ratePct) < 0 || Number(ratePct) > 100) {
    return res.status(400).json({ error: "name and a ratePct between 0 and 100 are required" });
  }
  const tax = await prisma.tax.create({
    data: { name, ratePct: Number(ratePct), isDefault: !!isDefault },
  });
  if (tax.isDefault) await makeOnlyDefault(tax.id);
  res.status(201).json(tax);
});

router.put("/:id", adminOnly, async (req, res) => {
  const { name, ratePct, isDefault } = req.body;
  if (ratePct != null && (Number(ratePct) < 0 || Number(ratePct) > 100)) {
    return res.status(400).json({ error: "ratePct must be between 0 and 100" });
  }
  try {
    const tax = await prisma.tax.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        ratePct: ratePct == null ? undefined : Number(ratePct),
        isDefault: isDefault == null ? undefined : !!isDefault,
      },
    });
    if (tax.isDefault) await makeOnlyDefault(tax.id);
    res.json(tax);
  } catch (e) {
    res.status(404).json({ error: "Tax not found" });
  }
});

router.delete("/:id", adminOnly, async (req, res) => {
  try {
    await prisma.tax.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Tax deleted" });
  } catch (e) {
    res.status(400).json({ error: "Cannot delete: this tax is used on subscription or invoice lines" });
  }
});

module.exports = router;
