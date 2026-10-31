require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/products", require("./routes/products"));
app.use("/api/plans", require("./routes/plans"));
app.use("/api/taxes", require("./routes/taxes"));
app.use("/api/discounts", require("./routes/discounts"));
app.use("/api/templates", require("./routes/templates"));
app.use("/api/subscriptions", require("./routes/subscriptions"));
app.use("/api/invoices", require("./routes/invoices"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/reports", require("./routes/reports"));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Anything unexpected comes back as JSON, never an HTML error page
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON in request" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Optional: bill due subscriptions every hour. Turn on with AUTO_BILLING=true in .env
if (process.env.AUTO_BILLING === "true") {
  const { generateDueInvoices } = require("./utils/billing");
  const run = () =>
    generateDueInvoices(new Date())
      .then((r) => console.log(`Auto billing: ${r.created.length} invoices created`))
      .catch((e) => console.error("Auto billing failed:", e.message));
  setInterval(run, 60 * 60 * 1000);
  run();
}
