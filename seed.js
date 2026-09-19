require("dotenv").config();
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  image: String,
  active: { type: Boolean, default: true }
});

const Product = mongoose.model("Product", productSchema);

const products = [
  { name: "Es Teh", category: "TEA", price: 5000, image: "🧋" },
  { name: "Lemon Tea", category: "TEA", price: 7000, image: "🍋" },
  { name: "Thai Tea", category: "TEA", price: 8000, image: "🧋" },
  { name: "Original Milk Tea", category: "MILKTEA", price: 9000, image: "🥤" },
  { name: "Brown Sugar Milk Tea", category: "MILKTEA", price: 12000, image: "🧋" },
  { name: "Taro Milk", category: "MILKY", price: 10000, image: "🥛" },
  { name: "Cokelat Milk", category: "MILKY", price: 10000, image: "🍫" },
  { name: "Es Kopi Susu", category: "KOPI", price: 10000, image: "☕" },
  { name: "Kopi Gula Aren", category: "KOPI", price: 12000, image: "☕" },
  { name: "Pop Ice Cokelat", category: "POPICE", price: 7000, image: "🥤" },
  { name: "Pop Ice Taro", category: "POPICE", price: 7000, image: "🥤" }
];

async function seed() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/kasir_hp";
  await mongoose.connect(uri);
  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log("Produk contoh berhasil dimasukkan.");
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
