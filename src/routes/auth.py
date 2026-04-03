"""
src/routes/auth.py
Flask Blueprint for user authentication:
  POST /api/auth/register  — create account
  POST /api/auth/login     — log in, set session
  POST /api/auth/logout    — clear session
  GET  /api/auth/me        — current user info (JSON)
  GET  /login              — serve login page
  GET  /register           — serve register page
"""

import re
from flask import (Blueprint, request, jsonify, session,
                   render_template, redirect, url_for)
from werkzeug.security import generate_password_hash, check_password_hash
from database.db import query_one, execute
from src.utils.logger import logging

auth_bp = Blueprint("auth", __name__)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PHONE_RE = re.compile(r"^\+?[\d\s\-]{7,15}$")


def _validate_register(data: dict) -> list[str]:
    errors = []
    name  = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    pwd   = data.get("password") or ""
    phone = (data.get("phone") or "").strip()

    if not name or len(name) < 2:
        errors.append("Name must be at least 2 characters.")
    if not email or not EMAIL_RE.match(email):
        errors.append("Enter a valid email address.")
    if len(pwd) < 8:
        errors.append("Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", pwd):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r"\d", pwd):
        errors.append("Password must contain at least one number.")
    if phone and not PHONE_RE.match(phone):
        errors.append("Enter a valid phone number.")
    return errors


def _safe_user(row: dict) -> dict:
    """Return user dict without password_hash."""
    return {k: v for k, v in row.items() if k != "password_hash"}


# ------------------------------------------------------------------
# Page routes
# ------------------------------------------------------------------
@auth_bp.route("/login")
def login_page():
    if session.get("user_id"):
        return redirect(url_for("home"))
    return render_template("login.html")


@auth_bp.route("/register")
def register_page():
    if session.get("user_id"):
        return redirect(url_for("home"))
    return render_template("register.html")


# ------------------------------------------------------------------
# API: Register
# ------------------------------------------------------------------
@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data  = request.get_json(silent=True) or {}
    errors = _validate_register(data)
    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    name  = data["name"].strip()
    email = data["email"].strip().lower()
    pwd   = data["password"]
    phone = (data.get("phone") or "").strip()

    # Check duplicate email
    existing = query_one("SELECT id FROM users WHERE email = %s", (email,))
    if existing:
        return jsonify({"success": False,
                        "errors": ["An account with this email already exists."]}), 409

    # Hash & insert
    pwd_hash = generate_password_hash(pwd, method="pbkdf2:sha256", salt_length=16)
    try:
        user_id = execute(
            "INSERT INTO users (name, email, password_hash, phone) VALUES (%s,%s,%s,%s)",
            (name, email, pwd_hash, phone or None)
        )
    except Exception as exc:
        logging.error(f"Register DB error: {exc}")
        return jsonify({"success": False, "errors": ["Server error. Try again later."]}), 500

    # Auto-login after registration
    session.clear()
    session.permanent = True
    session["user_id"]   = user_id
    session["user_name"] = name
    session["user_email"]= email

    logging.info(f"New user registered: {email} (id={user_id})")
    return jsonify({
        "success": True,
        "message": "Account created successfully!",
        "user": {"id": user_id, "name": name, "email": email}
    }), 201


# ------------------------------------------------------------------
# API: Login
# ------------------------------------------------------------------
@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    pwd   = data.get("password") or ""

    if not email or not pwd:
        return jsonify({"success": False,
                        "errors": ["Email and password are required."]}), 400

    user = query_one("SELECT * FROM users WHERE email = %s AND is_active = 1", (email,))
    if not user or not check_password_hash(user["password_hash"], pwd):
        return jsonify({"success": False,
                        "errors": ["Invalid email or password."]}), 401

    session.clear()
    session.permanent = True
    session["user_id"]   = user["id"]
    session["user_name"] = user["name"]
    session["user_email"]= user["email"]

    logging.info(f"User logged in: {email}")
    return jsonify({
        "success": True,
        "message": f"Welcome back, {user['name']}!",
        "user": _safe_user(user)
    }), 200


# ------------------------------------------------------------------
# API: Logout
# ------------------------------------------------------------------
@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    name = session.get("user_name", "User")
    session.clear()
    logging.info(f"User '{name}' logged out")
    return jsonify({"success": True, "message": "Logged out successfully."}), 200


# ------------------------------------------------------------------
# API: Current user
# ------------------------------------------------------------------
@auth_bp.route("/api/auth/me", methods=["GET"])
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "logged_in": False}), 401

    user = query_one("SELECT * FROM users WHERE id = %s", (user_id,))
    if not user:
        session.clear()
        return jsonify({"success": False, "logged_in": False}), 401

    return jsonify({"success": True, "logged_in": True, "user": _safe_user(user)}), 200
