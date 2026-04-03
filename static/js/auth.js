/**
 * static/js/auth.js
 * Shared JS for login.html and register.html
 * ─ Live validation, password strength, API calls, redirects
 */

"use strict";

// ── Helpers ────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s\-]{7,15}$/;

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function setFieldState(groupEl, state, msg = "") {
  groupEl.classList.remove("error", "success");
  if (state) groupEl.classList.add(state);
  const msgEl = groupEl.querySelector(".field-msg");
  if (msgEl) msgEl.textContent = msg;
}

function showAlert(alertEl, type, message) {
  alertEl.className = `auth-alert ${type} show`;
  alertEl.querySelector(".alert-msg").innerHTML = message;
  alertEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideAlert(alertEl) {
  alertEl.className = "auth-alert";
}

function setLoading(btn, loading) {
  btn.classList.toggle("loading", loading);
  btn.disabled = loading;
}

// Password visibility toggle
function initPasswordToggles() {
  $all(".toggle-pwd").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling;
      if (input && input.type) {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "🙈" : "👁️";
      }
    });
  });
}

// ── Password strength ───────────────────────────────────────────────
function calcStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score; // 0–5
}

function renderStrength(pwd, barFill, label) {
  const score = calcStrength(pwd);
  const map = [
    { w: "0%",   bg: "transparent", txt: "" },
    { w: "20%",  bg: "#ef4444",     txt: "Very Weak" },
    { w: "40%",  bg: "#f59e0b",     txt: "Weak" },
    { w: "60%",  bg: "#eab308",     txt: "Fair" },
    { w: "80%",  bg: "#22c55e",     txt: "Strong" },
    { w: "100%", bg: "#16a34a",     txt: "Very Strong" },
  ];
  const s = map[score] || map[0];
  barFill.style.width      = s.w;
  barFill.style.background = s.bg;
  if (label) label.textContent = s.txt ? `Strength: ${s.txt}` : "";
}

// ── Field validators ────────────────────────────────────────────────
const validators = {
  name(v) {
    if (!v || v.trim().length < 2) return "Name must be at least 2 characters.";
    return "";
  },
  email(v) {
    if (!v || !EMAIL_RE.test(v.trim())) return "Enter a valid email address.";
    return "";
  },
  password(v) {
    if (!v || v.length < 8)         return "Minimum 8 characters required.";
    if (!/[A-Z]/.test(v))           return "Include at least one uppercase letter.";
    if (!/\d/.test(v))              return "Include at least one number.";
    return "";
  },
  confirm_password(v, form) {
    const pwd = (form.querySelector("#password") || {}).value || "";
    if (v !== pwd) return "Passwords do not match.";
    return "";
  },
  phone(v) {
    if (v && !PHONE_RE.test(v.trim())) return "Enter a valid phone number.";
    return "";
  },
};

function validateField(inputEl, form) {
  const name  = inputEl.name || inputEl.id;
  const value = inputEl.value;
  const fn    = validators[name];
  if (!fn) return true;
  const err = fn(value, form);
  const grp = inputEl.closest(".form-group");
  if (err) {
    setFieldState(grp, "error", err);
    return false;
  } else if (value) {
    setFieldState(grp, "success", "✓");
    return true;
  } else {
    setFieldState(grp, null, "");
    return true;
  }
}

// ── Registration page ───────────────────────────────────────────────
function initRegisterPage() {
  const form     = $("#registerForm");
  const alertEl  = $("#authAlert");
  const submitBtn= $("#submitBtn");
  if (!form) return;

  initPasswordToggles();

  // Strength meter
  const pwdInput  = $("#password");
  const barFill   = $(".strength-bar-fill");
  const strengthLb= $(".strength-label");
  if (pwdInput) {
    pwdInput.addEventListener("input", () => {
      renderStrength(pwdInput.value, barFill, strengthLb);
    });
  }

  // Live validation
  form.querySelectorAll("input").forEach(input => {
    input.addEventListener("blur",  () => validateField(input, form));
    input.addEventListener("input", () => {
      const grp = input.closest(".form-group");
      if (grp && grp.classList.contains("error")) validateField(input, form);
    });
  });

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert(alertEl);

    // Validate all fields
    let allValid = true;
    form.querySelectorAll("input[name], input[id]").forEach(input => {
      if (!validateField(input, form)) allValid = false;
    });
    if (!allValid) {
      showAlert(alertEl, "error",
        "⚠️ Please fix the highlighted errors before continuing.");
      return;
    }

    setLoading(submitBtn, true);

    const payload = {
      name:     $("#fullName")?.value.trim(),
      email:    $("#email")?.value.trim().toLowerCase(),
      password: $("#password")?.value,
      phone:    $("#phone")?.value.trim(),
    };

    try {
      const res  = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        showAlert(alertEl, "success",
          `🎉 Account created! Redirecting to your dashboard…`);
        setTimeout(() => window.location.href = "/", 1600);
      } else {
        const msgs = (data.errors || ["Registration failed."]).join("<br>");
        showAlert(alertEl, "error", msgs);
        setLoading(submitBtn, false);
      }
    } catch {
      showAlert(alertEl, "error", "Network error. Please try again.");
      setLoading(submitBtn, false);
    }
  });
}

// ── Login page ──────────────────────────────────────────────────────
function initLoginPage() {
  const form     = $("#loginForm");
  const alertEl  = $("#authAlert");
  const submitBtn= $("#submitBtn");
  if (!form) return;

  initPasswordToggles();

  form.querySelectorAll("input").forEach(input => {
    input.addEventListener("blur",  () => validateField(input, form));
    input.addEventListener("input", () => {
      const grp = input.closest(".form-group");
      if (grp && grp.classList.contains("error")) validateField(input, form);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert(alertEl);
    setLoading(submitBtn, true);

    const payload = {
      email:    $("#email")?.value.trim().toLowerCase(),
      password: $("#password")?.value,
    };

    if (!payload.email || !payload.password) {
      showAlert(alertEl, "error", "Email and password are required.");
      setLoading(submitBtn, false);
      return;
    }

    try {
      const res  = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        showAlert(alertEl, "success",
          `👋 ${data.message} Redirecting…`);
        setTimeout(() => window.location.href = "/", 1400);
      } else {
        const msgs = (data.errors || ["Login failed."]).join("<br>");
        showAlert(alertEl, "error", msgs);
        setLoading(submitBtn, false);
      }
    } catch {
      showAlert(alertEl, "error", "Network error. Please try again.");
      setLoading(submitBtn, false);
    }
  });
}

// ── Init ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initRegisterPage();
  initLoginPage();
});
