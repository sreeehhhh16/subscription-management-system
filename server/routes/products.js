const express = require("express");
const prisma = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const adminOnly = [authenticate, requireRole("ADMIN")];

router.get("/", authenticate, async (req, res) => {
  const products = await prisma.product.findMany({
    include: { variants: true },
    orderBy: { id: "asc" },
  });
  res.json(products);
});

router.get("/:id", authenticate, async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: Number(req.params.id) },
    include: { variants: true },
  });
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

router.post("/", adminOnly, async (req, res) => {
  const { name, type, salesPrice, costPrice, notes } = req.body;
  if (!name || !type || salesPrice == null || costPrice == null) {
    return res.status(400).json({ error: "name, type, salesPrice and costPrice are required" });
  }
  const product = await prisma.product.create({
    data: { name, type, salesPrice: Number(salesPrice), costPrice: Number(costPrice), notes },
  });
  res.status(201).json(product);
});

router.put("/:id", adminOnly, async (req, res) => {
  const { name, type, salesPrice, costPrice, notes } = req.body;
  try {
    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        type,
        salesPrice: salesPrice == null ? undefined : Number(salesPrice),
        costPrice: costPrice == null ? undefined : Number(costPrice),
        notes,
      },
    });
    res.json(product);
  } catch (e) {
    res.status(404).json({ error: "Product not found" });
  }
});

router.delete("/:id", adminOnly, async (req, res) => {
  try {
    await prisma.productVariant.deleteMany({ where: { productId: Number(req.params.id) } });
    await prisma.product.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Product deleted" });
  } catch (e) {
    res.status(400).json({ error: "Cannot delete: product is used in subscriptions or discounts" });
  }
});

router.post("/:id/variants", adminOnly, async (req, res) => {
  const { attribute, value, extraPrice } = req.body;
  if (!attribute || !value) {
    return res.status(400).json({ error: "attribute and value are required" });
  }
  const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
  if (!product) return res.status(404).json({ error: "Product not found" });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      attribute,
      value,
      extraPrice: Number(extraPrice || 0),
    },
  });
  res.status(201).json(variant);
});

router.delete("/:id/variants/:variantId", adminOnly, async (req, res) => {
  try {
    await prisma.productVariant.delete({ where: { id: Number(req.params.variantId) } });
    res.json({ message: "Variant deleted" });
  } catch (e) {
    res.status(404).json({ error: "Variant not found" });
  }
});

module.exports = router;
