/**
 * static/js/main.js
 * NexPC — Main page logic
 * Handles: product fetch, category filter, cart, order tracker, contact form
 */
"use strict";

// ── Category config ──────────────────────────────────────────
const CATEGORIES = [
  { slug: "all",         label: "All Products", icon: "🖥️" },
  { slug: "cpu",         label: "CPUs",         icon: "🔲" },
  { slug: "gpu",         label: "GPUs",         icon: "🎮" },
  { slug: "ram",         label: "RAM",           icon: "💾" },
  { slug: "ssd",         label: "Storage",       icon: "💿" },
  { slug: "motherboard", label: "Motherboards",  icon: "🖳"  },
  { slug: "psu",         label: "PSUs",          icon: "⚡" },
];

// Category icon fallback map
const CAT_ICONS = {
  cpu: "🔲", gpu: "🎮", ram: "💾", ssd: "💿",
  motherboard: "🖳", psu: "⚡", cooler: "❄️", case: "🗄️",
};

// ── All products cache & current filter ─────────────────────
let allProducts   = [];
let activeCategory = "all";
let cartItems      = {};     // { productId: qty }
let cartTotal      = 0;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ── Toast helper ─────────────────────────────────────────────
function showToast(msg, type = "success", duration = 3000) {
  const container = $("#toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span>
    <span class="toast-text">${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("out");
    toast.addEventListener("animationend", () => toast.remove());
  }, duration);
}

// ── Price formatter ──────────────────────────────────────────
function formatPrice(n) {
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// ── Star rating ──────────────────────────────────────────────
function renderStars(rating) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}

// ── Spec extractor from JSON ─────────────────────────────────
function getSpecChips(specs, categorySlug) {
  if (!specs || typeof specs !== "object") return [];
  const chips = [];
  const keys  = {
    cpu:         ["cores","boost_clock","socket"],
    gpu:         ["vram","boost_clock"],
    ram:         ["capacity","speed","type"],
    ssd:         ["capacity","interface","read"],
    motherboard: ["socket","chipset","form_factor"],
    psu:         ["wattage","efficiency","modular"],
  };
  const wanted = keys[categorySlug] || Object.keys(specs).slice(0, 3);
  for (const k of wanted) {
    if (specs[k]) chips.push(specs[k]);
  }
  return chips.slice(0, 3);
}

// ── Build product card HTML ──────────────────────────────────
function buildProductCard(p) {
  const specs   = typeof p.specifications === "string"
                    ? JSON.parse(p.specifications || "{}")
                    : (p.specifications || {});
  const catSlug = (p.category_name || "").toLowerCase().split(" / ")[0]
                    .replace(/\s+/g, "");
  const icon    = CAT_ICONS[catSlug] || "🖥️";
  const chips   = getSpecChips(specs, catSlug);
  const offPct  = Math.round((p.mrp - p.selling_price) / p.mrp * 100);
  const isHot   = offPct >= 30 || p.rating >= 4.8;

  const chipHtml = chips.map(c =>
    `<span class="spec-chip">${c}</span>`).join("");

  let imgPath = p.image_url;
  if (!imgPath) {
    if (p.slug?.includes("intel") || p.name?.toLowerCase().includes("intel")) 
      imgPath = "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=500&q=80"; // Intel CPU
    else if (p.slug?.includes("amd") || p.slug?.includes("ryzen")) 
      imgPath = "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&q=80"; // AMD CPU
    else if (p.slug?.includes("gpu") || p.name?.toLowerCase().includes("rtx") || p.name?.toLowerCase().includes("rx")) 
      imgPath = "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=500&q=80"; // GPU
    else if (p.slug?.includes("ram") || p.name?.toLowerCase().includes("ddr")) 
      imgPath = "https://images.unsplash.com/photo-1563770660941-20978e870e26?w=500&q=80"; // RAM
    else if (p.slug?.includes("ssd") || p.slug?.includes("nvme") || p.name?.toLowerCase().includes("pro")) 
      imgPath = "https://images.unsplash.com/photo-1628557044797-f21a177c37ec?w=500&q=80"; // SSD
    else if (p.slug?.includes("motherboard") || p.slug?.includes("z790") || p.slug?.includes("b650")) 
      imgPath = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80"; // Motherboard
    else 
      imgPath = "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=500&q=80"; // Generic PC Hardware
  }

  const imgHtml = imgPath
    ? `<img src="${imgPath}" alt="${p.name}" class="product-real-img"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
       <div class="product-img-fallback" style="display:none;align-items:center;justify-content:center;height:100%;font-size:4rem">${icon}</div>`
    : `<div class="product-img-fallback" style="display:flex;align-items:center;justify-content:center;height:100%;font-size:4rem">${icon}</div>`;

  return `
    <div class="product-card" data-id="${p.id}" data-name="${p.name}">
      ${offPct > 0 ? `<div class="product-badge ${isHot ? 'hot' : ''}">${offPct}% OFF</div>` : ""}
      <div class="product-img-wrap">${imgHtml}</div>
      <div class="product-body">
        <span class="product-cat-badge">${p.category_name || ""}</span>
        <span class="product-brand">${p.brand}</span>
        <h3 class="product-name">${p.name}</h3>
        <div class="product-specs">${chipHtml}</div>
        <div class="product-rating">
          <span class="stars">${renderStars(parseFloat(p.rating || 4))}</span>
          <span class="rating-val">${parseFloat(p.rating || 4).toFixed(1)}</span>
          <span class="rating-count">(${(p.rating_count || 0).toLocaleString()})</span>
        </div>
        <div class="product-price-row">
          <span class="price-current">${formatPrice(p.selling_price)}</span>
          ${p.mrp > p.selling_price
            ? `<span class="price-mrp">${formatPrice(p.mrp)}</span>
               <span class="price-off">Save ${offPct}%</span>`
            : ""}
        </div>
        <button class="btn-add-cart" data-id="${p.id}" data-price="${p.selling_price}"
                data-name="${p.name}">
          🛒 Add to Cart
        </button>
      </div>
    </div>`;
}

// ── Skeleton loader ──────────────────────────────────────────
function showSkeletons(grid, count = 6) {
  grid.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skel-img"></div>
      <div class="skel-body">
        <div class="skel-line w40"></div>
        <div class="skel-line w80"></div>
        <div class="skel-line w60"></div>
        <div class="skel-line w40"></div>
        <div class="skel-line w60"></div>
      </div>
    </div>`).join("");
}

// ── Render products ──────────────────────────────────────────
function renderProducts(products) {
  const grid = $("#productsGrid");
  if (!grid) return;

  if (!products || !products.length) {
    const isSearching = _currentSearchQuery && _currentSearchQuery.length > 0;
    grid.innerHTML = `
      <div class="products-empty">
        <div class="empty-icon">${isSearching ? "🔍" : "📦"}</div>
        ${isSearching
          ? `<p>No products found for <strong>"${_currentSearchQuery}"</strong>.</p>
             <button onclick="clearSearch()"
               style="margin-top:12px;padding:8px 20px;border:1px solid rgba(255,255,255,0.2);
                      background:rgba(124,140,248,0.15);border-radius:8px;cursor:pointer;
                      font-size:0.9rem;color:var(--accent,#7c8cf8);">
               ✕ Clear Search
             </button>`
          : `<p>No products found in this category.</p>`
        }
      </div>`;
    return;
  }
  grid.innerHTML = products.map(buildProductCard).join("");

  // Bind add-to-cart buttons
  grid.querySelectorAll(".btn-add-cart").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(
        parseInt(btn.dataset.id),
        btn.dataset.name,
        parseFloat(btn.dataset.price),
        btn
      );
    });
  });
}

// ── Filter products by category ──────────────────────────────
function filterProducts(slug) {
  activeCategory = slug;
  const filtered = slug === "all"
    ? allProducts
    : allProducts.filter(p => {
        const cat = (p.category_name || "").toLowerCase();
        return cat.includes(slug) ||
               (p.slug || "").includes(slug);
      });
  renderProducts(filtered);
}

// ── Fetch from API ───────────────────────────────────────────
async function fetchProducts() {
  const grid = $("#productsGrid");
  if (!grid) return;
  showSkeletons(grid);

  try {
    const res  = await fetch("/api/products");
    const data = await res.json();
    if (data.success && data.products.length) {
      allProducts = data.products;
      renderProducts(allProducts);
    } else {
      grid.innerHTML = `
        <div class="products-empty">
          <div class="empty-icon">📦</div>
          <p>No products available. Check back soon!</p>
        </div>`;
    }
  } catch (err) {
    console.error("Product fetch failed:", err);
    // Fallback: use static data
    allProducts = getStaticProducts();
    renderProducts(allProducts);
  }
}

// ── Static fallback products (shown when DB is unreachable) ─
function getStaticProducts() {
  return [
    { id:1, brand:"Intel", name:"Core i9-14900K", category_name:"CPU / Processors",
      slug:"intel-i9-14900k", selling_price:39999, mrp:54999, rating:4.8, rating_count:1240,
      specifications:'{"cores":"24C/32T","boost_clock":"6.0GHz","socket":"LGA1700"}' },
    { id:2, brand:"AMD", name:"Ryzen 9 7950X", category_name:"CPU / Processors",
      slug:"amd-ryzen9-7950x", selling_price:44999, mrp:59999, rating:4.9, rating_count:876,
      specifications:'{"cores":"16C/32T","boost_clock":"5.7GHz","socket":"AM5"}' },
    { id:3, brand:"NVIDIA", name:"RTX 4090", category_name:"Graphics Cards",
      slug:"nvidia-rtx-4090", selling_price:149999, mrp:189999, rating:4.9, rating_count:532,
      specifications:'{"vram":"24GB GDDR6X","boost_clock":"2.52GHz"}' },
    { id:4, brand:"NVIDIA", name:"RTX 4060", category_name:"Graphics Cards",
      slug:"nvidia-rtx-4060", selling_price:27999, mrp:34999, rating:4.6, rating_count:4120,
      specifications:'{"vram":"8GB GDDR6","boost_clock":"2.46GHz"}' },
    { id:5, brand:"Corsair", name:"Vengeance DDR5 32GB", category_name:"RAM / Memory",
      slug:"corsair-vengeance-ddr5-32gb", selling_price:8999, mrp:12999, rating:4.7, rating_count:1890,
      specifications:'{"capacity":"32GB","type":"DDR5","speed":"5200MHz"}' },
    { id:6, brand:"Samsung", name:"990 Pro NVMe 1TB", category_name:"SSD / Storage",
      slug:"samsung-990-pro-1tb", selling_price:8999, mrp:12999, rating:4.9, rating_count:3241,
      specifications:'{"capacity":"1TB","interface":"PCIe 4.0","read":"7450 MB/s"}' },
    { id:7, brand:"ASUS", name:"ROG Strix Z790-E WiFi", category_name:"Motherboards",
      slug:"asus-rog-strix-z790e", selling_price:34999, mrp:44999, rating:4.8, rating_count:643,
      specifications:'{"socket":"LGA1700","chipset":"Z790","form_factor":"ATX"}' },
    { id:8, brand:"AMD", name:"Ryzen 5 7600X", category_name:"CPU / Processors",
      slug:"amd-ryzen5-7600x", selling_price:18999, mrp:24999, rating:4.7, rating_count:2134,
      specifications:'{"cores":"6C/12T","boost_clock":"5.3GHz","socket":"AM5"}' },
  ];
}

// ── Cart logic ───────────────────────────────────────────────
async function addToCart(productId, name, price, btn) {
  // Optimistic UI
  const orig = btn.innerHTML;
  btn.innerHTML = "✅ Added!";
  btn.classList.add("added");
  btn.disabled = true;

  // Update local count
  cartItems[productId] = (cartItems[productId] || 0) + 1;
  cartTotal += price;
  updateCartBadge();

  try {
    await fetch("/api/cart/add", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ product_id: productId, quantity: 1 }),
    });
  } catch { /* silent */ }

  showToast(`<strong>${name}</strong> added to cart!`);

  setTimeout(() => {
    btn.innerHTML = orig;
    btn.classList.remove("added");
    btn.disabled = false;
  }, 1800);
}

function updateCartBadge() {
  const total = Object.values(cartItems).reduce((a, b) => a + b, 0);
  $$(".cart-badge").forEach(el => {
    el.textContent = total;
    el.style.display = total ? "flex" : "none";
  });
}

// Load cart from server
async function loadCartCount() {
  try {
    const res  = await fetch("/api/cart");
    const data = await res.json();
    if (data.success) {
      const count = data.items.reduce((a, i) => a + i.quantity, 0);
      $$(".cart-badge").forEach(el => {
        el.textContent = count;
        el.style.display = count ? "flex" : "none";
      });
    }
  } catch { /* ignored */ }
}

// ── Order tracker ────────────────────────────────────────────
async function trackOrder() {
  const input  = $("#orderInput");
  const result = $("#trackerResult");
  const btn    = $("#btnTrack");
  if (!input || !result) return;

  const num = input.value.trim().toUpperCase();
  if (!num) { showToast("Enter an order number", "error"); return; }

  btn.textContent = "Searching…";
  btn.disabled    = true;
  result.className = "tracker-result";

  try {
    const res  = await fetch(`/api/orders/track?order_number=${encodeURIComponent(num)}`);
    const data = await res.json();
    if (data.success) {
      const o = data.order;
      result.className = "tracker-result found";
      result.innerHTML = `
        <strong>✅ Order Found</strong><br>
        Order #: <code>${o.order_number}</code><br>
        Status: <strong>${o.order_status?.replace(/_/g," ").toUpperCase()}</strong><br>
        Payment: ${o.payment_status}<br>
        Total: <strong>₹${parseFloat(o.total_amount).toLocaleString("en-IN")}</strong>
        ${o.tracking_number
          ? `<br>Tracking: <code>${o.tracking_number}</code>` : ""}`;
    } else {
      result.className = "tracker-result not-found";
      result.innerHTML = `❌ No order found with number <strong>${num}</strong>. Please check and try again.`;
    }
  } catch {
    result.className = "tracker-result not-found";
    result.innerHTML = "❌ Unable to fetch order. Please try again.";
  }

  btn.textContent = "Track";
  btn.disabled    = false;
}

// ── Contact form ─────────────────────────────────────────────
function initContactForm() {
  const form = $("#contactForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector(".btn-send");
    btn.textContent = "Sending…";
    btn.disabled    = true;
    await new Promise(r => setTimeout(r, 900));
    form.style.display = "none";
    const success = form.parentElement.querySelector(".form-success");
    if (success) success.classList.add("show");
    showToast("Message sent! We'll reply within 24 hours. 📬");
  });
}

// ── Navbar scroll effect ─────────────────────────────────────
function initNavbar() {
  const nav = $(".navbar");
  if (!nav) return;
  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 20);
    const backTop = $(".back-top");
    if (backTop) backTop.classList.toggle("show", window.scrollY > 400);
  }, { passive: true });

  // Hamburger
  const ham    = $(".nav-hamburger");
  const mobile = $(".mobile-nav");
  if (ham && mobile) {
    ham.addEventListener("click", () => {
      mobile.classList.toggle("open");
    });
    // Close on link click
    mobile.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => mobile.classList.remove("open"));
    });
  }
}

// ── Category tab init ─────────────────────────────────────────
function initCategoryTabs() {
  const container = $("#catTabs");
  if (!container) return;

  CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `cat-tab${cat.slug === "all" ? " active" : ""}`;
    btn.dataset.slug = cat.slug;
    btn.innerHTML = `<span class="tab-icon">${cat.icon}</span>${cat.label}`;
    btn.addEventListener("click", () => {
      $$(".cat-tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      filterProducts(cat.slug);
    });
    container.appendChild(btn);
  });
}

// ── Search handler ────────────────────────────────────────────
// Tracks active search term so empty-state can offer a "Clear" button
let _currentSearchQuery = "";

function clearSearch() {
  const inp = $("#navSearch");
  if (inp) inp.value = "";
  _currentSearchQuery = "";
  _hideSearchBadge();
  $$(".cat-tab").forEach(t => t.classList.remove("active"));
  $(".cat-tab[data-slug='all']")?.classList.add("active");
  activeCategory = "all";
  renderProducts(allProducts);
}

function _showSearchBadge(count, q) {
  let badge = $("#searchResultBadge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "searchResultBadge";
    badge.style.cssText = [
      "display:flex","align-items:center","gap:10px",
      "padding:8px 16px","margin-bottom:12px",
      "background:var(--glass-bg,rgba(255,255,255,0.07))",
      "border:1px solid var(--border,rgba(255,255,255,0.1))",
      "border-radius:8px","font-size:0.85rem",
      "color:var(--text-muted,#aaa)",
    ].join(";");
    const grid = $("#productsGrid");
    if (grid && grid.parentNode) grid.parentNode.insertBefore(badge, grid);
  }
  const label = q.length > 24 ? q.slice(0, 24) + "…" : q;
  badge.innerHTML = `
    <span>🔍 Showing <strong style="color:var(--accent,#7c8cf8)">${count}</strong>
      result${count !== 1 ? "s" : ""} for <em>"${label}"</em></span>
    <button onclick="clearSearch()"
      style="margin-left:auto;padding:4px 12px;border:1px solid rgba(255,255,255,0.2);
             background:transparent;border-radius:6px;cursor:pointer;
             font-size:0.8rem;color:inherit;">✕ Clear</button>`;
  badge.style.display = "flex";
}

function _hideSearchBadge() {
  const badge = $("#searchResultBadge");
  if (badge) badge.style.display = "none";
}

function initSearch() {
  const inp = $("#navSearch");
  if (!inp) return;

  let timer;

  inp.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = inp.value.trim();
      _currentSearchQuery = q;

      if (!q) {
        _hideSearchBadge();
        $$(".cat-tab").forEach(t => t.classList.remove("active"));
        $(".cat-tab[data-slug='all']")?.classList.add("active");
        activeCategory = "all";
        renderProducts(allProducts);
        return;
      }

      const ql = q.toLowerCase();
      const filtered = allProducts.filter(p =>
        (p.name          || "").toLowerCase().includes(ql) ||
        (p.brand         || "").toLowerCase().includes(ql) ||
        (p.category_name || "").toLowerCase().includes(ql) ||
        (p.slug          || "").toLowerCase().includes(ql) ||
        // Search inside specification values too (e.g. "AM4", "GDDR6", "NVMe")
        (p.specifications && typeof p.specifications === "object" &&
          Object.values(p.specifications).some(v =>
            String(v).toLowerCase().includes(ql)
          )
        )
      );

      // Reset active tab
      $$(".cat-tab").forEach(t => t.classList.remove("active"));
      $(".cat-tab[data-slug='all']")?.classList.add("active");
      activeCategory = "all";

      // Show result count badge above grid
      _showSearchBadge(filtered.length, q);

      renderProducts(filtered);

      // Auto-scroll to products section
      const grid = $("#productsGrid");
      if (grid) setTimeout(() =>
        grid.scrollIntoView({ behavior: "smooth", block: "start" }), 60);

    }, 280);  // 280ms debounce
  });

  // Escape clears search
  inp.addEventListener("keydown", e => {
    if (e.key === "Escape") clearSearch();
  });
}

// ── Auth user info in nav ──────────────────────────────────────
async function loadUserInfo() {
  try {
    const res  = await fetch("/api/auth/me");
    const data = await res.json();
    const authArea = $("#navAuthArea");
    if (!authArea) return;
    if (data.logged_in) {
      authArea.innerHTML = `
        <span class="nav-link" style="color:var(--accent-light)">👤 ${data.user.name.split(" ")[0]}</span>
        <button class="btn-nav-auth" id="logoutBtn">Sign Out</button>`;
      $("#logoutBtn")?.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.reload();
      });
    } else {
      authArea.innerHTML = `
        <a href="/login" class="nav-link">Sign In</a>
        <a href="/register" class="btn-nav-auth">Register →</a>`;
    }
  } catch { /* ignore */ }
}

// ── Animate on scroll ─────────────────────────────────────────
function initScrollAnimate() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = "1";
        e.target.style.transform = "translateY(0)";
      }
    });
  }, { threshold: 0.1 });

  $$(".feature-card, .about-stat-card, .policy-card").forEach(el => {
    el.style.opacity    = "0";
    el.style.transform  = "translateY(20px)";
    el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
    observer.observe(el);
  });
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initNavbar();
  initCategoryTabs();
  initSearch();
  initContactForm();
  initScrollAnimate();

  await Promise.all([fetchProducts(), loadUserInfo(), loadCartCount()]);

  // Track order button
  $("#btnTrack")?.addEventListener("click", trackOrder);
  $("#orderInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter") trackOrder();
  });

  // Back to top
  $(".back-top")?.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );
});
