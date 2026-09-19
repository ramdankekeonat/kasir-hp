require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kasir_hp";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Koneksi MongoDB dibuat saat dibutuhkan lalu di-cache,
// supaya aman dijalankan di hosting serverless seperti Vercel.
let connectionPromise = null;

function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
      .catch((err) => {
        connectionPromise = null;
        throw err;
      });
  }

  return connectionPromise;
}

app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ message: "Gagal terhubung MongoDB: " + err.message });
  }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ["TEA", "MILKTEA", "MILKY", "KOPI", "POPICE"],
    required: true
  },
  price: { type: Number, required: true },
  image: { type: String, default: "🥤" },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const transactionSchema = new mongoose.Schema({
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: String,
    category: String,
    price: Number,
    qty: Number,
    subtotal: Number
  }],
  total: { type: Number, required: true },
  paid: { type: Number, required: true },
  change: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const expenseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  note: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model("Product", productSchema);
const Transaction = mongoose.model("Transaction", transactionSchema);
const Expense = mongoose.model("Expense", expenseSchema);

// Server cloud (Vercel/Render) memakai jam UTC. Semua batas hari/bulan dihitung
// dalam WIB (UTC+7) supaya "hari ini" dan pergantian bulan tepat di waktu Indonesia.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function wibNow() {
  // Baca hasilnya dengan getUTC* (bukan getFullYear/getMonth/getDate)
  return new Date(Date.now() + WIB_OFFSET_MS);
}

function wibToUtc(year, month, day) {
  return new Date(Date.UTC(year, month, day) - WIB_OFFSET_MS);
}

function dateRange() {
  const n = wibNow();
  const y = n.getUTCFullYear();
  const m = n.getUTCMonth();
  const d = n.getUTCDate();
  return { start: wibToUtc(y, m, d), end: wibToUtc(y, m, d + 1) };
}

function monthRange(year, month) {
  return { start: wibToUtc(year, month, 1), end: wibToUtc(year, month + 1, 1) };
}

function monthLabel(year, month) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month, 1));
}

// Products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({ active: true }).sort({ category: 1, name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Checkout
app.post("/api/transactions", async (req, res) => {
  try {
    const { items, paid } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Keranjang masih kosong." });
    }

    const total = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const uang = Number(paid);

    if (!Number.isFinite(uang) || uang < total) {
      return res.status(400).json({ message: "Jumlah uang kurang dari total." });
    }

    const transaction = await Transaction.create({
      items,
      total,
      paid: uang,
      change: uang - total
    });

    res.status(201).json({
      message: "Checkout berhasil",
      transaction
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Daily income
app.get("/api/dashboard/daily", async (req, res) => {
  try {
    const { start, end } = dateRange();
    const transactions = await Transaction.find({
      createdAt: { $gte: start, $lt: end }
    }).sort({ createdAt: -1 });

    const total = transactions.reduce((sum, t) => sum + t.total, 0);

    res.json({
      date: start.toISOString(),
      total,
      transactionCount: transactions.length,
      transactions
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Monthly summary (real time).
// We keep transaction data permanently. The app displays the current month
// and the next month, calculated from today's date on every request,
// so the months roll over automatically when the calendar month changes.
app.get("/api/dashboard/monthly", async (req, res) => {
  try {
    const now = wibNow();
    const months = [];

    for (let offset = 0; offset <= 1; offset++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const { start, end } = monthRange(year, month);

      const [sales, expenses] = await Promise.all([
        Transaction.aggregate([
          { $match: { createdAt: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } }
        ]),
        Expense.aggregate([
          { $match: { createdAt: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ])
      ]);

      const income = sales[0]?.total || 0;
      const expense = expenses[0]?.total || 0;

      months.push({
        year,
        month,
        label: monthLabel(year, month),
        income,
        expense,
        net: income - expense,
        transactionCount: sales[0]?.count || 0,
        expenseCount: expenses[0]?.count || 0
      });
    }

    res.json(months);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Expenses
app.get("/api/expenses", async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ createdAt: -1 }).limit(100);
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/expenses", async (req, res) => {
  try {
    const { name, amount, note } = req.body;

    if (!name || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ message: "Nama dan nominal pengeluaran wajib diisi." });
    }

    const expense = await Expense.create({
      name,
      amount: Number(amount),
      note: note || ""
    });

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Vercel mengimpor file ini sebagai fungsi (module.exports).
// Saat dijalankan langsung (npm start / node server.js), server listen seperti biasa.
module.exports = app;

if (require.main === module) {
  connectDB()
    .then(() => {
      console.log("MongoDB terhubung:", MONGO_URI.replace(/\/\/[^@]*@/, "//***@"));
      app.listen(PORT, () => {
        console.log(`Kasir berjalan di http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Gagal terhubung MongoDB:", err.message);
      process.exit(1);
    });
}
