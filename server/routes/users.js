const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");
const { validPassword, PASSWORD_MESSAGE } = require("../utils/password");
const { parsePage, pageResult } = require("../utils/paginate");

const router = express.Router();
const team = [authenticate, requireRole("ADMIN", "STAFF")];

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

// GET /api/users?role=CUSTOMER&search=acme&page=1
// Staff and admin can list customers. Only the admin can list staff.
router.get("/", team, async (req, res) => {
  const role = String(req.query.role || "CUSTOMER").toUpperCase();
  if (!["CUSTOMER", "STAFF"].includes(role)) {
    return res.status(400).json({ error: "role must be CUSTOMER or STAFF" });
  }
  if (role === "STAFF" && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Only the admin can see the staff list" });
  }
  const where = { role };
  const search = String(req.query.search || "").trim();
  if (search) where.OR = [{ email: { contains: search } }, { name: { contains: search } }];
  const p = parsePage(req.query);
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, createdAt: true, _count: { select: { subscriptions: true } } },
      orderBy: { id: "desc" },
      skip: p.skip,
      take: p.take,
    }),
    prisma.user.count({ where }),
  ]);
  res.json(pageResult(items, total, p));
});

async function createUser(req, res, role) {
  const { email, password, name } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  if (!validPassword(password)) return res.status(400).json({ error: PASSWORD_MESSAGE });
  const cleanEmail = email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (exists) return res.status(409).json({ error: "Email already in use" });
  const user = await prisma.user.create({
    data: { email: cleanEmail, passwordHash: await bcrypt.hash(password, 10), name, role },
  });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
}

// Only the admin can add a new member of staff
router.post("/staff", authenticate, requireRole("ADMIN"), (req, res) => createUser(req, res, "STAFF"));

// Staff can set up an account for a customer who has not signed up themselves
router.post("/customers", team, (req, res) => createUser(req, res, "CUSTOMER"));

module.exports = router;
