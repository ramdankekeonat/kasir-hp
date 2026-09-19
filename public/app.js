const state = {
  products: [],
  category: "ALL",
  cart: {}
};

const rupiah = (n) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
}).format(n || 0);

const $ = (selector) => document.querySelector(selector);

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Terjadi kesalahan.");
  }

  return data;
}

function setToday() {
  $("#today").textContent = new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date());
}

async function loadProducts() {
  try {
    state.products = await api("/api/products");
    renderProducts();
  } catch (error) {
    $("#products").innerHTML = `<div class="empty">Gagal mengambil produk.<br>${error.message}</div>`;
  }
}

function renderProducts() {
  const list = state.products.filter(p =>
    state.category === "ALL" || p.category === state.category
  );

  if (!list.length) {
    $("#products").innerHTML = `<div class="empty">Belum ada produk.</div>`;
    return;
  }

  $("#products").innerHTML = list.map(p => {
    const qty = state.cart[p._id] || 0;

    return `
      <article class="product">
        <div class="product-image">${p.image || "🥤"}</div>
        <div class="product-info">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${rupiah(p.price)}</p>
        </div>
        <div class="qty">
          <button onclick="changeQty('${p._id}', -1)">−</button>
          <span class="number">${qty}</span>
          <button onclick="changeQty('${p._id}', 1)">+</button>
        </div>
      </article>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.changeQty = function(id, amount) {
  state.cart[id] = Math.max(0, (state.cart[id] || 0) + amount);

  if (state.cart[id] === 0) delete state.cart[id];

  renderProducts();
  updateTotal();
};

function getCartItems() {
  return Object.entries(state.cart).map(([id, qty]) => {
    const product = state.products.find(p => p._id === id);
    return {
      productId: product._id,
      name: product.name,
      category: product.category,
      price: product.price,
      qty,
      subtotal: product.price * qty
    };
  });
}

function getTotal() {
  return getCartItems().reduce((sum, item) => sum + item.subtotal, 0);
}

function updateTotal() {
  const total = getTotal();
  const paid = Number($("#paid").value || 0);
  const difference = paid - total;

  $("#total").textContent = rupiah(total);

  if (total === 0) {
    $("#changeLabel").textContent = "Kembalian";
    $("#change").textContent = rupiah(0);
    $("#change").parentElement.classList.remove("is-debt");
    return;
  }

  if (difference < 0) {
    $("#changeLabel").textContent = "Kurang";
    $("#change").textContent = rupiah(Math.abs(difference));
    $("#change").parentElement.classList.add("is-debt");
  } else if (difference === 0) {
    $("#changeLabel").textContent = "Status";
    $("#change").textContent = "PAS";
    $("#change").parentElement.classList.remove("is-debt");
  } else {
    $("#changeLabel").textContent = "Kembalian";
    $("#change").textContent = rupiah(difference);
    $("#change").parentElement.classList.remove("is-debt");
  }
}

async function checkout() {
  const items = getCartItems();
  const total = getTotal();
  const paid = Number($("#paid").value || 0);

  if (!items.length) {
    showToast("Tambahkan produk terlebih dahulu.");
    return;
  }

  if (!paid || paid < total) {
    showToast("Uang pelanggan masih kurang.");
    return;
  }

  try {
    await api("/api/transactions", {
      method: "POST",
      body: JSON.stringify({ items, paid })
    });

    state.cart = {};
    $("#paid").value = "";
    renderProducts();
    updateTotal();

    showToast("Checkout berhasil disimpan.");
    loadDaily();
    loadMonthly();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadDaily() {
  try {
    const data = await api("/api/dashboard/daily");

    $("#dailyTotal").textContent = rupiah(data.total);
    $("#dailyCount").textContent = `${data.transactionCount} transaksi`;

    if (!data.transactions.length) {
      $("#dailyHistory").innerHTML = `<div class="empty">Belum ada transaksi hari ini.</div>`;
      return;
    }

    $("#dailyHistory").innerHTML = data.transactions.map(t => {
      const time = new Date(t.createdAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      });

      const itemText = t.items.map(i => `${i.name} ×${i.qty}`).join(", ");

      return `
        <div class="history-item">
          <div class="history-top">
            <strong>${rupiah(t.total)}</strong>
            <span>${time}</span>
          </div>
          <small>${escapeHtml(itemText)}</small>
          <small>Bayar ${rupiah(t.paid)} · Kembali ${rupiah(t.change)}</small>
        </div>
      `;
    }).join("");
  } catch (error) {
    $("#dailyHistory").innerHTML = `<div class="empty">${error.message}</div>`;
  }
}

async function loadMonthly() {
  try {
    const months = await api("/api/dashboard/monthly");

    $("#monthlyCards").innerHTML = months.map(m => `
      <div class="month-card">
        <div class="month-title">
          <h3>${escapeHtml(m.label)}</h3>
          <span class="net ${m.net < 0 ? "negative" : ""}">${rupiah(m.net)}</span>
        </div>

        <div class="money-grid">
          <div class="money-mini">
            <span>Total pemasukan</span>
            <strong>${rupiah(m.income)}</strong>
          </div>
          <div class="money-mini">
            <span>Total pengeluaran</span>
            <strong>${rupiah(m.expense)}</strong>
          </div>
          <div class="money-mini">
            <span>Transaksi</span>
            <strong>${m.transactionCount}</strong>
          </div>
          <div class="money-mini">
            <span>Pengeluaran</span>
            <strong>${m.expenseCount}</strong>
          </div>
        </div>
      </div>
    `).join("");

    const expenses = await api("/api/expenses");

    if (!expenses.length) {
      $("#expenseList").innerHTML = `<div class="empty">Belum ada pengeluaran.</div>`;
      return;
    }

    $("#expenseList").innerHTML = expenses.map(e => `
      <div class="history-item">
        <div class="history-top">
          <strong>${escapeHtml(e.name)}</strong>
          <span>-${rupiah(e.amount)}</span>
        </div>
        <small>${escapeHtml(e.note || "Tanpa keterangan")}</small>
        <small>${new Date(e.createdAt).toLocaleDateString("id-ID")}</small>
      </div>
    `).join("");
  } catch (error) {
    $("#monthlyCards").innerHTML = `<div class="empty">${error.message}</div>`;
  }
}

async function saveExpense() {
  const name = $("#expenseName").value.trim();
  const amount = Number($("#expenseAmount").value);
  const note = $("#expenseNote").value.trim();

  if (!name || !amount || amount <= 0) {
    showToast("Isi nama dan nominal pengeluaran.");
    return;
  }

  try {
    await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ name, amount, note })
    });

    $("#expenseName").value = "";
    $("#expenseAmount").value = "";
    $("#expenseNote").value = "";
    $("#expenseModal").classList.add("hidden");

    await loadMonthly();
    showToast("Pengeluaran berhasil disimpan.");
  } catch (error) {
    showToast(error.message);
  }
}

function openPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));

  $("#" + pageId).classList.add("active");
  document.querySelector(`.nav-item[data-page="${pageId}"]`).classList.add("active");

  if (pageId === "dataPage") {
    loadDaily();
    loadMonthly();
  }
}

document.querySelectorAll(".category").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".category").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    state.category = button.dataset.category;
    renderProducts();
  });
});

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => openPage(button.dataset.page));
});

document.querySelectorAll(".data-tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".data-tab").forEach(b => b.classList.remove("active"));
    button.classList.add("active");

    $("#dailyPanel").classList.toggle("hidden", button.dataset.tab !== "daily");
    $("#monthlyPanel").classList.toggle("hidden", button.dataset.tab !== "monthly");
  });
});

$("#paid").addEventListener("input", updateTotal);
$("#checkoutBtn").addEventListener("click", checkout);
$("#refreshData").addEventListener("click", () => {
  loadDaily();
  loadMonthly();
});

$("#expenseBtn").addEventListener("click", () => {
  $("#expenseModal").classList.remove("hidden");
});

$("#closeExpense").addEventListener("click", () => {
  $("#expenseModal").classList.add("hidden");
});

$("#expenseModal").addEventListener("click", (e) => {
  if (e.target.id === "expenseModal") {
    $("#expenseModal").classList.add("hidden");
  }
});

$("#saveExpense").addEventListener("click", saveExpense);

// Bulan real time: ringkasan bulanan diperbarui otomatis saat halaman Data terbuka
function isDataPageOpen() {
  return $("#dataPage").classList.contains("active");
}

setInterval(() => {
  if (!document.hidden && isDataPageOpen()) loadMonthly();
}, 30000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isDataPageOpen()) loadMonthly();
});

setToday();
loadProducts();
updateTotal();
