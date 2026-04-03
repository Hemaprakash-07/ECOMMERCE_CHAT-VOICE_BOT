/**
 * static/js/orders.js  —  NexPC Orders History Page
 * Handles: load orders, filter by status, order detail modal,
 *          order cancellation, order tracking widget, auth nav
 */
"use strict";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ── Helpers ──────────────────────────────────────────────────────
function fmt(n) {
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function fmtDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function showToast(msg, type = "success") {
  const c = $("#toastContainer");
  if (!c) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${type === "success" ? "✅" : "❌"}</span>
                  <span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove());
  }, 3500);
}

// Status → human label + timeline steps
const STATUS_STEPS = ["placed", "confirmed", "processing", "shipped", "delivered"];
const STATUS_LABELS = {
  placed:           { label: "Order Placed",       icon: "📋" },
  confirmed:        { label: "Confirmed",           icon: "✅" },
  processing:       { label: "Processing",          icon: "⚙️" },
  shipped:          { label: "Shipped",             icon: "🚚" },
  delivered:        { label: "Delivered",           icon: "📦" },
  cancelled:        { label: "Cancelled",           icon: "❌" },
  return_requested: { label: "Return Requested",    icon: "↩️" },
  returned:         { label: "Returned",            icon: "↩️" },
};

function buildTimeline(currentStatus) {
  if (["cancelled", "return_requested", "returned"].includes(currentStatus)) {
    return `<div style="text-align:center;padding:16px;color:var(--red);font-weight:600">
      ${STATUS_LABELS[currentStatus]?.icon || "❌"}
      Order ${currentStatus.replace("_", " ")}
    </div>`;
  }
  const curIdx = STATUS_STEPS.indexOf(currentStatus);
  return `<div class="order-timeline">
    ${STATUS_STEPS.map((s, i) => {
      const isDone    = i <= curIdx;
      const isCurrent = i === curIdx;
      const info      = STATUS_LABELS[s];
      return `<div class="timeline-step ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}">
        <div class="timeline-dot">${info.icon}</div>
        <div class="timeline-label">${info.label}</div>
      </div>`;
    }).join("")}
  </div>`;
}

// ── State ─────────────────────────────────────────────────────────
let allOrders    = [];
let activeFilter = "all";

// ── Render orders list ────────────────────────────────────────────
function renderOrders(orders) {
  const list  = $("#ordersList");
  const label = $("#ordersCountLabel");

  if (!list) return;

  if (!orders || !orders.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h2>${activeFilter === "all" ? "No orders yet" : `No ${activeFilter} orders`}</h2>
        <p>
          ${activeFilter === "all"
            ? "Start shopping for PC components and your orders will appear here."
            : "Try a different filter or check back later."}
        </p>
        <a href="/" class="btn-primary" style="margin-top:16px;display:inline-flex">
          🛒 Shop Now
        </a>
      </div>`;
    if (label) label.textContent = "No orders found";
    return;
  }

  if (label) label.textContent =
    `${orders.length} order${orders.length !== 1 ? "s" : ""} found`;

  list.innerHTML = orders.map(buildOrderCard).join("");

  // Bind buttons
  list.querySelectorAll(".btn-view-order").forEach(btn => {
    btn.addEventListener("click", () => openOrderDetail(btn.dataset.num));
  });
  list.querySelectorAll(".btn-cancel-order").forEach(btn => {
    btn.addEventListener("click", () => cancelOrder(btn.dataset.num));
  });
}

function buildOrderCard(o) {
  const statusCls  = `status-${o.order_status}`;
  const payCls     = `pay-${o.payment_status}`;
  const statusInfo = STATUS_LABELS[o.order_status] || { label: o.order_status, icon: "📋" };
  const canCancel  = ["placed", "confirmed"].includes(o.order_status);

  // Show up to 3 items; rest = "+N more"
  const visibleItems = (o.items || []).slice(0, 3);
  const extraCount   = (o.items || []).length - visibleItems.length;

  const itemsHtml = visibleItems.map(item => `
    <div class="order-item-row">
      <div class="order-item-icon">🖥️</div>
      <div class="order-item-detail">
        <div class="order-item-name">${item.product_name}</div>
        <div class="order-item-brand">${item.brand} &nbsp;·&nbsp;
          <span class="order-item-qty">Qty: ${item.quantity}</span>
        </div>
      </div>
      <div class="order-item-price">${fmt(item.unit_price * item.quantity)}</div>
    </div>`).join("") +
    (extraCount > 0
      ? `<div style="font-size:12px;color:var(--text-muted);padding:4px 0">
           + ${extraCount} more item${extraCount > 1 ? "s" : ""}
         </div>`
      : "");

  return `
    <div class="order-card" id="order-card-${o.order_number}">
      <!-- Head -->
      <div class="order-card-head">
        <div>
          <div class="order-num">${o.order_number}</div>
          <div class="order-date">${fmtDate(o.placed_at)}</div>
        </div>
        <span class="status-badge ${statusCls}">
          ${statusInfo.icon} ${statusInfo.label}
        </span>
        <span class="pay-badge ${payCls}">
          💳 ${o.payment_status}
        </span>
        <div class="order-total">${fmt(o.total_amount)}</div>
      </div>

      <!-- Timeline -->
      ${buildTimeline(o.order_status)}

      <!-- Items -->
      <div class="order-card-items">${itemsHtml}</div>

      <!-- Footer -->
      <div class="order-card-foot">
        <button class="btn-view-order" data-num="${o.order_number}">
          🔍 View Details
        </button>
        ${canCancel
          ? `<button class="btn-cancel-order" data-num="${o.order_number}">
               ❌ Cancel Order
             </button>`
          : ""}
        <span style="margin-left:auto;font-size:12px;color:var(--text-muted)">
          via ${o.payment_method?.toUpperCase() || "—"}
        </span>
      </div>
    </div>`;
}

// ── Fetch orders from API ─────────────────────────────────────────
async function fetchOrders(status = "all") {
  const list = $("#ordersList");
  if (list) {
    list.innerHTML = `
      <div class="empty-state" style="padding:60px 0">
        <div class="empty-icon" style="animation:pulse-bg 1.2s ease infinite">📋</div>
        <p>Loading orders…</p>
      </div>`;
  }

  try {
    const url  = `/api/orders${status !== "all" ? `?status=${encodeURIComponent(status)}` : ""}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (data.success) {
      allOrders = data.orders;
      renderOrders(allOrders);
    } else {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h2>Could not load orders</h2>
          <p>Please try again shortly.</p>
        </div>`;
    }
  } catch {
    if (list) list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h2>Connection error</h2>
        <p>Check your connection and refresh the page.</p>
      </div>`;
  }
}

// ── Order detail modal ────────────────────────────────────────────
async function openOrderDetail(orderNumber) {
  const overlay = $("#orderDetailOverlay");
  const content = $("#orderDetailContent");
  if (!overlay || !content) return;

  content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">⏳ Loading…</div>`;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  try {
    const res  = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`);
    const data = await res.json();

    if (!data.success) {
      content.innerHTML = `<div style="color:var(--red)">❌ ${data.message || "Order not found"}</div>`;
      return;
    }

    const o          = data.order;
    const statusInfo = STATUS_LABELS[o.order_status] || { label: o.order_status, icon: "📋" };

    content.innerHTML = `
      <!-- Order meta -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);
                    border-radius:var(--radius-md);padding:16px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em">Order Number</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600;color:var(--accent-light)">${o.order_number}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);
                    border-radius:var(--radius-md);padding:16px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em">Status</div>
          <span class="status-badge status-${o.order_status}">${statusInfo.icon} ${statusInfo.label}</span>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);
                    border-radius:var(--radius-md);padding:16px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em">Placed On</div>
          <div style="font-size:13px;font-weight:500">${fmtDate(o.placed_at)}</div>
        </div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);
                    border-radius:var(--radius-md);padding:16px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em">Payment</div>
          <span class="pay-badge pay-${o.payment_status}">💳 ${o.payment_method} · ${o.payment_status}</span>
        </div>
      </div>

      <!-- Timeline -->
      <div style="margin-bottom:24px">${buildTimeline(o.order_status)}</div>

      <!-- Shipping -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);
                  border-radius:var(--radius-md);padding:16px;margin-bottom:20px">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em">
          📍 Shipping Address
        </div>
        <div style="font-size:14px;color:var(--text-secondary);line-height:1.6">
          <strong style="color:var(--text-primary)">${o.customer_name}</strong>
          ${o.customer_phone ? `<span style="color:var(--text-muted)"> · ${o.customer_phone}</span>` : ""}
          <br>${o.shipping_address}
        </div>
        ${o.tracking_number ? `
          <div style="margin-top:10px;font-size:13px;color:var(--accent-light)">
            🚚 Tracking: <code style="font-family:'JetBrains Mono',monospace">${o.tracking_number}</code>
          </div>` : ""}
      </div>

      <!-- Items -->
      <div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:12px;
                    text-transform:uppercase;letter-spacing:.08em">🛒 Order Items</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${(o.items || []).map(item => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;
                        background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:var(--radius-sm)">
              <div style="font-size:28px;width:44px;height:44px;display:flex;align-items:center;
                          justify-content:center;background:rgba(255,255,255,0.04);
                          border-radius:var(--radius-sm);flex-shrink:0">🖥️</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.product_name}</div>
                <div style="font-size:12px;color:var(--text-muted)">${item.brand}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:13px;font-weight:600;color:var(--accent-light)">${fmt(item.unit_price)}</div>
                <div style="font-size:12px;color:var(--text-muted)">× ${item.quantity}</div>
              </div>
              <div style="font-size:15px;font-weight:700;flex-shrink:0;min-width:70px;text-align:right">
                ${fmt(item.subtotal)}
              </div>
            </div>`).join("")}
        </div>
      </div>

      <!-- Totals -->
      <div style="background:rgba(124,58,237,0.07);border:1px solid rgba(124,58,237,0.2);
                  border-radius:var(--radius-md);padding:18px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--text-secondary)">
          <span>Subtotal</span><span>${fmt(o.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--text-secondary)">
          <span>Tax (5% GST)</span><span>${fmt(o.tax_amount)}</span>
        </div>
        <div style="height:1px;background:var(--border)"></div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800">
          <span>Total</span>
          <span style="color:var(--accent-light)">${fmt(o.total_amount)}</span>
        </div>
      </div>
    `;

  } catch (err) {
    content.innerHTML = `<div style="color:var(--red)">❌ Failed to load order details.</div>`;
  }
}

function closeOrderDetail() {
  const ov = $("#orderDetailOverlay");
  if (ov) ov.classList.remove("open");
  document.body.style.overflow = "";
}

// ── Cancel order ──────────────────────────────────────────────────
async function cancelOrder(orderNumber) {
  if (!confirm(`Cancel order ${orderNumber}? This cannot be undone.`)) return;

  try {
    const res  = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/cancel`, {
      method: "POST", headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Order ${orderNumber} cancelled.`);
      await fetchOrders(activeFilter);
    } else {
      showToast(data.message || "Could not cancel order.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
}

// ── Order tracker widget ──────────────────────────────────────────
async function trackOrderWidget() {
  const input    = $("#trackInput");
  const resultEl = $("#trackResult");
  if (!input || !resultEl) return;

  const num = input.value.trim().toUpperCase();
  if (!num) { showToast("Enter an order number", "error"); return; }

  const btn       = $("#btnTrack");
  if (btn) { btn.textContent = "Searching…"; btn.disabled = true; }
  resultEl.style.display = "none";

  try {
    const res  = await fetch(`/api/orders/track?order_number=${encodeURIComponent(num)}`);
    const data = await res.json();

    if (data.success) {
      const o    = data.order;
      const info = STATUS_LABELS[o.order_status] || { label: o.order_status, icon: "📋" };
      resultEl.style.display = "block";
      resultEl.innerHTML = `
        <div style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.25);
                    border-radius:var(--radius-md);padding:14px;margin-top:12px;font-size:13px">
          ✅ <strong>${o.order_number}</strong> &nbsp;—&nbsp;
          <span class="status-badge status-${o.order_status}">${info.icon} ${info.label}</span>
          &nbsp; Total: <strong>${fmt(o.total_amount)}</strong>
          ${o.tracking_number ? `&nbsp;|&nbsp; 🚚 <code>${o.tracking_number}</code>` : ""}
        </div>`;
    } else {
      resultEl.style.display = "block";
      resultEl.innerHTML = `
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);
                    border-radius:var(--radius-md);padding:12px;margin-top:12px;font-size:13px;color:var(--red)">
          ❌ No order found with number <strong>${num}</strong>.
        </div>`;
    }
  } catch {
    resultEl.style.display = "block";
    resultEl.innerHTML = `<div style="color:var(--red);padding:10px">❌ Connection error.</div>`;
  }

  if (btn) { btn.textContent = "Track"; btn.disabled = false; }
}

// ── Filter pills ──────────────────────────────────────────────────
function initFilters() {
  $$(".filter-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      $$(".filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      activeFilter = pill.dataset.status;
      fetchOrders(activeFilter);
    });
  });
}

// ── Auth nav ──────────────────────────────────────────────────────
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

// ── Boot ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([fetchOrders(), loadNavAuth()]);

  initFilters();

  // Order detail modal
  $("#closeOrderDetail")?.addEventListener("click", closeOrderDetail);
  $("#orderDetailOverlay")?.addEventListener("click", (e) => {
    if (e.target === $("#orderDetailOverlay")) closeOrderDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOrderDetail();
  });

  // Track widget
  $("#btnTrack")?.addEventListener("click", trackOrderWidget);
  $("#trackInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") trackOrderWidget();
  });

  // Navbar scroll
  window.addEventListener("scroll", () => {
    $("#mainNav")?.classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });
});
