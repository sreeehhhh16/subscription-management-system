// Pure discount rules (no database), so they are easy to test.
//
// lines:     [{ productId, quantity, amount }]   amount = quantity * unitPrice, before tax
// discounts: Discount rows. Applied in the order given, and they stack.
//
// A discount applies to:
//   productId set       -> only lines of that product
//   subscriptionId set  -> only that subscription
//   both set            -> that product inside that subscription
//   neither set         -> every line of every subscription
const round = (n) => Math.round(n * 100) / 100;

function isUsable(d, date) {
  return (
    d.startDate <= date &&
    d.endDate >= date &&
    (d.usageLimit == null || d.timesUsed < d.usageLimit)
  );
}

function applyDiscounts(lines, discounts, subscriptionId, date) {
  const net = lines.map((l) => l.amount); // what is left of each line after discounts
  const applied = [];

  for (const d of discounts) {
    if (!isUsable(d, date)) continue;
    if (d.subscriptionId != null && d.subscriptionId !== subscriptionId) continue;

    const idx = [];
    lines.forEach((l, i) => {
      if (d.productId == null || l.productId === d.productId) idx.push(i);
    });
    if (idx.length === 0) continue;

    const grossBase = round(idx.reduce((s, i) => s + lines[i].amount, 0));
    const qty = idx.reduce((s, i) => s + lines[i].quantity, 0);
    if (d.minPurchase != null && grossBase < d.minPurchase) continue;
    if (d.minQuantity != null && qty < d.minQuantity) continue;

    const base = round(idx.reduce((s, i) => s + net[i], 0));
    if (base <= 0) continue;
    const wanted = d.type === "PERCENT" ? round((base * d.value) / 100) : d.value;
    const amount = Math.min(round(wanted), base);
    if (amount <= 0) continue;

    // Share the discount across the eligible lines so tax can be worked out on what is left
    let left = amount;
    let given = 0;
    idx.forEach((i, k) => {
      const share =
        k === idx.length - 1 ? Math.min(left, net[i]) : Math.min(left, round((amount * net[i]) / base));
      net[i] = round(net[i] - share);
      left = round(left - share);
      given = round(given + share);
    });
    if (given > 0) applied.push({ discount: d, amount: given });
  }

  const total = round(applied.reduce((s, a) => s + a.amount, 0));
  return { net, applied, total };
}

module.exports = { applyDiscounts, isUsable, round };
