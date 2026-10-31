const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { validPassword, PASSWORD_MESSAGE } = require("../utils/password");

const router = express.Router();

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

// Only the admin can add a new member of staff
router.post("/staff", authenticate, requireRole("ADMIN"), async (req, res) => {
  const { email, password, name } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  if (!validPassword(password)) {
    return res.status(400).json({ error: PASSWORD_MESSAGE });
  }
  const cleanEmail = email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (exists) return res.status(409).json({ error: "Email already in use" });
  const user = await prisma.user.create({
    data: {
      email: cleanEmail,
      passwordHash: await bcrypt.hash(password, 10),
      name,
      role: "STAFF",
    },
  });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

module.exports = router;
