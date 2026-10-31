const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  res.json(await prisma.tax.findMany({ orderBy: { id: "asc" } }));
});

router.post("/", authenticate, requireRole("ADMIN"), async (req, res) => {
  const { name, ratePct } = req.body;
  if (!name || ratePct == null) {
    return res.status(400).json({ error: "name and ratePct are required" });
  }
  const tax = await prisma.tax.create({ data: { name, ratePct: Number(ratePct) } });
  res.status(201).json(tax);
});

module.exports = router;
