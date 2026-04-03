/**
 * static/js/cart.js  —  NexPC Cart Page
 * Handles: load cart, update qty, remove item, clear cart,
 *          summary panel, checkout modal, order placement, auth nav
 */
"use strict";

// ── Helpers ──────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const CAT_ICONS = {
  "cpu":         "🔲", "processors": "🔲",
  "gpu":         "🎮", "graphics":   "🎮",
  "ram":         "💾", "memory":     "💾",
  "ssd":         "💿", "storage":    "💿",
  "motherboard": "🖳",
  "psu":         "⚡", "power":      "⚡",
};

function getCatIcon(catName = "") {
  const lower = catName.toLowerCase();
  for (const [k, v] of Object.entries(CAT_ICONS)) {
    if (lower.includes(k)) return v;
  }
  return "🖥️";
}

function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function showToast(msg, type = "success") {
  const c    = $("#toastContainer");
  const el   = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${type === "success" ? "✅" : "❌"}</span>
                  <span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove());
  }, 3000);
}

// ── State ─────────────────────────────────────────────────────────
let cartData = { items: [], summary: { item_count:0, subtotal:0, tax:0, total:0 } };

// ── Render cart items ─────────────────────────────────────────────
function renderCart() {
  const wrap    = $("#cartItemsWrap");
  const actions = $("#cartActions");
  const label   = $("#cartCountLabel");

  const { items, summary } = cartData;

  if (!items || !items.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🛒</div>
        <h2>Your cart is empty</h2>
        <p>Looks like you haven't added any PC components yet.</p>
        <a href="/" class="btn-primary" style="margin-top:16px;display:inline-flex">
          🛒 Shop Components
        </a>
      </div>`;
    if (actions) actions.style.display = "none";
    if (label)   label.textContent = "0 items in your cart";
    updateSummaryUI(summary);
    if ($("#btnCheckout")) $("#btnCheckout").disabled = true;
    return;
  }

  if (label) label.textContent = `${summary.item_count} item${summary.item_count !== 1 ? "s" : ""} in your cart`;
  if (actions) actions.style.display = "flex";
  if ($("#btnCheckout")) $("#btnCheckout").disabled = false;

  wrap.innerHTML = items.map(buildItemCard).join("");

  // Bind qty buttons
  wrap.querySelectorAll(".qty-btn-dec").forEach(btn => {
    btn.addEventListener("click", () => updateQty(+btn.dataset.id, +btn.dataset.qty - 1));
  });
  wrap.querySelectorAll(".qty-btn-inc").forEach(btn => {
    btn.addEventListener("click", () => updateQty(+btn.dataset.id, +btn.dataset.qty + 1));
  });
  wrap.querySelectorAll(".btn-remove").forEach(btn => {
    btn.addEventListener("click", () => removeItem(+btn.dataset.id, btn.dataset.name));
  });

  updateSummaryUI(summary);
}

function buildItemCard(item) {
  const icon   = getCatIcon(item.category_name || "");
  const offPct = item.mrp > item.unit_price
    ? Math.round((item.mrp - item.unit_price) / item.mrp * 100) : 0;

  const imgHtml = item.image_url
    ? `<img src="${item.image_url}" alt="${item.product_name}"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
            style="width:75%;height:75%;object-fit:contain">
       <div class="img-fallback" style="display:none;font-size:36px;opacity:.7">${icon}</div>`
    : `<div class="img-fallback" style="font-size:36px;opacity:.7">${icon}</div>`;

  return `
    <div class="cart-item" id="cart-item-${item.cart_id}">
      <div class="cart-item-img">${imgHtml}</div>

      <div class="cart-item-info">
        <div class="cart-item-cat">${item.category_name || ""}</div>
        <div class="cart-item-brand">${item.brand}</div>
        <div class="cart-item-name">${item.product_name}</div>
        <div class="cart-item-price-row">
          <span class="cart-item-price">${fmt(item.unit_price)}</span>
          ${offPct ? `<span class="cart-item-mrp">${fmt(item.mrp)}</span>
            <span class="cart-item-off">${offPct}% off</span>` : ""}
        </div>
        <div style="margin-top:6px;font-size:12px;color:var(--text-muted)">
          Line total: <strong style="color:var(--text-primary)">${fmt(item.line_total)}</strong>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;flex-wrap:wrap">
        <!-- Qty stepper -->
        <div class="qty-stepper">
          <button class="qty-btn qty-btn-dec"
                  data-id="${item.cart_id}" data-qty="${item.quantity}"
                  ${item.quantity <= 1 ? "disabled style='opacity:.4;cursor:default'" : ""}>−</button>
          <span class="qty-val">${item.quantity}</span>
          <button class="qty-btn qty-btn-inc"
                  data-id="${item.cart_id}" data-qty="${item.quantity}"
                  ${item.quantity >= Math.min(item.stock, 10) ? "disabled style='opacity:.4;cursor:default'" : ""}>+</button>
        </div>
        <!-- Remove -->
        <button class="btn-remove" data-id="${item.cart_id}"
                data-name="${item.product_name}" title="Remove item">🗑️</button>
      </div>
    </div>`;
}

function updateSummaryUI(s) {
  const sd = (el, val) => { if ($(el)) $(el).textContent = val; };
  sd("#sumItemsCount", s.item_count || 0);
  sd("#sumSubtotal",   fmt(s.subtotal || 0));
  sd("#sumTax",        fmt(s.tax || 0));
  sd("#sumTotal",      fmt(s.total || 0));
  sd("#coTotalDisplay",fmt(s.total || 0));
}

// ── API calls ─────────────────────────────────────────────────────
async function fetchCart() {
  try {
    const res  = await fetch("/api/cart");
    const data = await res.json();
    if (data.success) {
      cartData = data;
      renderCart();
    }
  } catch (err) {
    console.error("Cart fetch error:", err);
    $("#cartItemsWrap").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h2>Could not load cart</h2>
        <p>Please check your connection and try again.</p>
      </div>`;
  }
}

async function updateQty(cartId, newQty) {
  if (newQty < 1) { removeItem(cartId); return; }
  try {
    const res = await fetch(`/api/cart/update/${cartId}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ quantity: newQty }),
    });
    const d = await res.json();
    if (d.success) await fetchCart();
    else showToast(d.message || "Could not update quantity", "error");
  } catch { showToast("Network error", "error"); }
}

async function removeItem(cartId, name = "Item") {
  try {
    const el = $(`#cart-item-${cartId}`);
    if (el) { el.style.opacity = ".4"; el.style.pointerEvents = "none"; }

    const res = await fetch(`/api/cart/remove/${cartId}`, { method: "DELETE" });
    const d   = await res.json();
    if (d.success) {
      showToast(`${name} removed from cart.`);
      await fetchCart();
    } else {
      showToast(d.message || "Could not remove item", "error");
      if (el) { el.style.opacity = "1"; el.style.pointerEvents = "auto"; }
    }
  } catch { showToast("Network error", "error"); }
}

async function clearCart() {
  if (!confirm("Remove all items from your cart?")) return;
  try {
    await fetch("/api/cart/clear", { method: "DELETE" });
    showToast("Cart cleared.");
    await fetchCart();
  } catch { showToast("Network error", "error"); }
}

// ── Checkout modal ────────────────────────────────────────────────
function openCheckout() {
  const overlay = $("#checkoutOverlay");
  if (!overlay) return;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  prefillCheckoutFields();
}

function closeCheckout() {
  const overlay = $("#checkoutOverlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}

async function prefillCheckoutFields() {
  try {
    const res  = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.logged_in) {
      const u = data.user;
      const nameEl  = $("#coName");
      const emailEl = $("#coEmail");
      if (nameEl  && !nameEl.value)  nameEl.value  = u.name  || "";
      if (emailEl && !emailEl.value) emailEl.value = u.email || "";
    }
  } catch { /* ignore */ }
}

async function placeOrder(e) {
  e.preventDefault();
  const btn  = $("#btnPlaceOrder");
  const name    = $("#coName").value.trim();
  const address = $("#coAddress").value.trim();
  const payment = document.querySelector("input[name='payment_method']:checked")?.value || "cod";

  if (!name || !address) {
    showToast("Name and shipping address are required.", "error");
    return;
  }

  btn.classList.add("loading");
  btn.disabled = true;

  const payload = {
    customer_name:     name,
    customer_email:    $("#coEmail")?.value.trim(),
    customer_phone:    $("#coPhone")?.value.trim(),
    shipping_address:  address,
    payment_method:    payment,
  };

  try {
    const res  = await fetch("/api/orders/place", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success) {
      closeCheckout();
      window.location.href = `/order-confirmation?order_number=${data.order_number}`;
    } else {
      showToast(data.message || "Order placement failed.", "error");
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  } catch {
    showToast("Network error. Please try again.", "error");
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

// ── Payment method UI ─────────────────────────────────────────────
function initPayMethodSelect() {
  $$("#payMethods .pay-method").forEach(label => {
    label.addEventListener("click", () => {
      $$("#payMethods .pay-method").forEach(l => l.classList.remove("selected"));
      label.classList.add("selected");
    });
  });
}

// ── Navbar auth ───────────────────────────────────────────────────
async function loadNavAuth() {
  try {
    const res  = await fetch("/api/auth/me");
    const data = await res.json();
    const area = $("#navAuthArea");
    if (!area) return;
    if (data.logged_in) {
      area.innerHTML = `
        <span class="nav-link" style="color:var(--accent-light)">
          👤 ${data.user.name.split(" ")[0]}
        </span>
        <button class="btn-nav-auth" id="logoutBtn">Sign Out</button>`;
      $("#logoutBtn")?.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
      });
    } else {
      area.innerHTML = `
        <a href="/login" class="nav-link">Sign In</a>
        <a href="/register" class="btn-nav-auth">Register →</a>`;
    }
  } catch { /* ignore */ }
}

// ── Coupon (UI only) ─────────────────────────────────────────────
function initCoupon() {
  $("#btnCoupon")?.addEventListener("click", () => {
    const code = $("#couponInput")?.value.trim();
    if (!code) { showToast("Enter a coupon code", "error"); return; }
    showToast(`Coupon "${code}" — feature coming soon!`);
  });
}

// ── Navbar scroll ─────────────────────────────────────────────────
window.addEventListener("scroll", () => {
  $("#mainNav")?.classList.toggle("scrolled", window.scrollY > 10);
}, { passive: true });

// ── Boot ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([fetchCart(), loadNavAuth()]);

  $("#btnCheckout")?.addEventListener("click", openCheckout);
  $("#checkoutClose")?.addEventListener("click", closeCheckout);
  $("#checkoutOverlay")?.addEventListener("click", (e) => {
    if (e.target === $("#checkoutOverlay")) closeCheckout();
  });
  $("#checkoutForm")?.addEventListener("submit", placeOrder);
  $("#btnClearCart")?.addEventListener("click", clearCart);

  initPayMethodSelect();
  initCoupon();

  // Close modal on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCheckout();
  });
});
