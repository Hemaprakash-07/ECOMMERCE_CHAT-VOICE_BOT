"""
src/routes/cart.py
Cart Blueprint — full CRUD for cart management
Endpoints:
  GET    /api/cart                — fetch all cart items for session
  POST   /api/cart/add            — add product (or increment qty)
  PUT    /api/cart/update/<id>    — set new quantity for a cart row
  DELETE /api/cart/remove/<id>    — delete one cart row
  DELETE /api/cart/clear          — wipe entire cart for session
"""

import uuid
from flask import Blueprint, request, jsonify, session
from database.db import query_all, query_one, execute
from src.utils.logger import logging

cart_bp = Blueprint("cart", __name__)


# ── Helpers ─────────────────────────────────────────────────────────

def _get_sid() -> str:
    """Return a stable session identifier (user_id or guest UUID)."""
    if session.get("user_id"):
        return f"user_{session['user_id']}"
    if "guest_id" not in session:
        session["guest_id"] = str(uuid.uuid4())
    return session["guest_id"]


def _enrich_items(items: list) -> list:
    """Convert Decimal fields to float/int for JSON serialisation."""
    for item in items:
        item["unit_price"]   = float(item.get("unit_price", 0))
        item["line_total"]   = float(item.get("unit_price", 0)) * int(item.get("quantity", 1))
        item["mrp"]          = float(item.get("mrp", 0))
        item["quantity"]     = int(item.get("quantity", 1))
        item["stock"]        = int(item.get("stock", 10))
    return items


def _cart_summary(items: list) -> dict:
    subtotal = sum(i["unit_price"] * i["quantity"] for i in items)
    tax      = round(subtotal * 0.05, 2)
    total    = round(subtotal + tax, 2)
    count    = sum(i["quantity"] for i in items)
    return {
        "item_count": count,
        "subtotal":   round(subtotal, 2),
        "tax":        tax,
        "total":      total,
    }


# ── GET /api/cart ────────────────────────────────────────────────────

@cart_bp.route("/api/cart", methods=["GET"])
def get_cart():
    sid   = _get_sid()
    items = query_all("""
        SELECT
            c.id          AS cart_id,
            c.product_id,
            c.quantity,
            p.name        AS product_name,
            p.brand,
            p.selling_price AS unit_price,
            p.mrp,
            p.image_url,
            p.stock,
            p.specifications,
            cat.name      AS category_name
        FROM cart c
        JOIN products   p   ON c.product_id  = p.id
        JOIN categories cat ON p.category_id = cat.id
        WHERE c.session_id = %s
        ORDER BY c.added_at DESC
    """, (sid,))

    items = _enrich_items(items)
    return jsonify({
        "success": True,
        "items":   items,
        "summary": _cart_summary(items),
    })


# ── POST /api/cart/add ───────────────────────────────────────────────

@cart_bp.route("/api/cart/add", methods=["POST"])
def add_to_cart():
    data       = request.get_json(silent=True) or {}
    product_id = data.get("product_id")
    qty        = max(1, int(data.get("quantity", 1)))
    sid        = _get_sid()

    if not product_id:
        return jsonify({"success": False, "message": "product_id is required"}), 400

    # Validate product exists & has stock
    product = query_one(
        "SELECT id, name, stock FROM products WHERE id = %s AND is_active = 1",
        (product_id,)
    )
    if not product:
        return jsonify({"success": False, "message": "Product not found"}), 404

    # Check existing cart row
    existing = query_one(
        "SELECT id, quantity FROM cart WHERE session_id = %s AND product_id = %s",
        (sid, product_id)
    )

    if existing:
        new_qty = existing["quantity"] + qty
        if new_qty > min(product["stock"], 10):
            new_qty = min(product["stock"], 10)
        execute(
            "UPDATE cart SET quantity = %s WHERE id = %s",
            (new_qty, existing["id"])
        )
    else:
        execute(
            """INSERT INTO cart (session_id, user_id, product_id, quantity)
               VALUES (%s, %s, %s, %s)""",
            (sid, session.get("user_id"), product_id, qty)
        )

    logging.info(f"[Cart] Added product_id={product_id} qty={qty} sid={sid}")
    return jsonify({"success": True, "message": f"'{product['name']}' added to cart!"}), 201


# ── PUT /api/cart/update/<cart_id> ───────────────────────────────────

@cart_bp.route("/api/cart/update/<int:cart_id>", methods=["PUT"])
def update_cart(cart_id):
    data = request.get_json(silent=True) or {}
    qty  = int(data.get("quantity", 1))
    sid  = _get_sid()

    if qty < 1:
        return jsonify({"success": False, "message": "Quantity must be at least 1"}), 400

    row = query_one(
        "SELECT c.id, p.stock FROM cart c JOIN products p ON c.product_id=p.id "
        "WHERE c.id = %s AND c.session_id = %s",
        (cart_id, sid)
    )
    if not row:
        return jsonify({"success": False, "message": "Cart item not found"}), 404

    qty = min(qty, row["stock"], 10)
    execute("UPDATE cart SET quantity = %s WHERE id = %s", (qty, cart_id))
    return jsonify({"success": True, "quantity": qty})


# ── DELETE /api/cart/remove/<cart_id> ───────────────────────────────

@cart_bp.route("/api/cart/remove/<int:cart_id>", methods=["DELETE"])
def remove_from_cart(cart_id):
    sid = _get_sid()
    row = query_one(
        "SELECT id FROM cart WHERE id = %s AND session_id = %s", (cart_id, sid)
    )
    if not row:
        return jsonify({"success": False, "message": "Item not found"}), 404

    execute("DELETE FROM cart WHERE id = %s", (cart_id,))
    return jsonify({"success": True, "message": "Item removed from cart"})


# ── DELETE /api/cart/clear ───────────────────────────────────────────

@cart_bp.route("/api/cart/clear", methods=["DELETE"])
def clear_cart():
    sid = _get_sid()
    execute("DELETE FROM cart WHERE session_id = %s", (sid,))
    return jsonify({"success": True, "message": "Cart cleared"})
