const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../db");
const { validPassword, PASSWORD_MESSAGE } = require("../utils/password");
const { sendMail } = require("../utils/mailer");

const router = express.Router();

function makeToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  if (!validPassword(password)) {
    return res.status(400).json({ error: PASSWORD_MESSAGE });
  }
  const cleanEmail = email.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (exists) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: cleanEmail, passwordHash, name, role: "CUSTOMER" },
  });
  res.status(201).json({ token: makeToken(user), user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = email
    ? await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    : null;
  const ok = user && (await bcrypt.compare(password || "", user.passwordHash));
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });
  res.json({ token: makeToken(user), user: publicUser(user) });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = email
    ? await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    : null;
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hash, resetExpires: new Date(Date.now() + 60 * 60 * 1000) },
    });
    // Sent by email when SMTP is set up (see utils/mailer.js); otherwise printed in the server terminal
    const base = process.env.CLIENT_URL || "http://localhost:5173";
    try {
      await sendMail({
        to: user.email,
        subject: "Reset your Brightloop password",
        text: `Use this link to choose a new password. It works for one hour.\n\n${base}/reset-password?token=${token}\n`,
      });
    } catch (e) {
      console.error("Could not send reset email:", e.message);
    }
  }
  res.json({ message: "If that email is registered, a reset link has been sent." });
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token) return res.status(400).json({ error: "Token is required" });
  if (!validPassword(password)) {
    return res.status(400).json({ error: PASSWORD_MESSAGE });
  }
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findFirst({
    where: { resetToken: hash, resetExpires: { gt: new Date() } },
  });
  if (!user) return res.status(400).json({ error: "Reset link is invalid or has expired" });
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      resetToken: null,
      resetExpires: null,
    },
  });
  res.json({ message: "Password updated. You can now log in." });
});

module.exports = router;
