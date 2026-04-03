"""
src/routes/orders.py
Orders Blueprint
Endpoints:
  POST /api/orders/place           — checkout: create order from cart
  GET  /api/orders                 — user/session order history
  GET  /api/orders/<order_number>  — single order detail
  GET  /api/orders/track           — public order status lookup
"""

import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, session
from database.db import query_all, query_one, execute, get_db
from src.utils.logger import logging

orders_bp = Blueprint("orders", __name__)


# ── Helpers ─────────────────────────────────────────────────────────

def _get_sid() -> str:
    if session.get("user_id"):
        return f"user_{session['user_id']}"
    return session.get("guest_id", "guest")


def _gen_order_number() -> str:
    """Generate: ORD-YYYYMMDD-XXXX (e.g. ORD-20240329-A3F7)."""
    date_part = datetime.now().strftime("%Y%m%d")
    rand_part = uuid.uuid4().hex[:4].upper()
    return f"ORD-{date_part}-{rand_part}"


def _float(val) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


# ── POST /api/orders/place ──────────────────────────────────────────

@orders_bp.route("/api/orders/place", methods=["POST"])
def place_order():
    data = request.get_json(silent=True) or {}
    sid  = _get_sid()

    # 1. Fetch cart items
    items = query_all("""
        SELECT c.id AS cart_id, c.product_id, c.quantity,
               p.name, p.brand, p.selling_price, p.stock
        FROM cart c
        JOIN products p ON c.product_id = p.id
        WHERE c.session_id = %s
    """, (sid,))

    if not items:
        return jsonify({"success": False, "message": "Your cart is empty"}), 400

    # 2. Validate stock for every item
    for item in items:
        if item["quantity"] > item["stock"]:
            return jsonify({
                "success": False,
                "message": f"Only {item['stock']} units of '{item['name']}' available."
            }), 400

    # 3. Calculate totals
    subtotal = sum(_float(i["selling_price"]) * int(i["quantity"]) for i in items)
    tax      = round(subtotal * 0.05, 2)
    total    = round(subtotal + tax, 2)

    # 4. Validate checkout fields
    name    = (data.get("customer_name") or session.get("user_name") or "").strip()
    email   = (data.get("customer_email") or session.get("user_email") or "").strip()
    phone   = (data.get("customer_phone") or "").strip()
    address = (data.get("shipping_address") or "").strip()
    payment = data.get("payment_method", "cod")

    if not name or not address:
        return jsonify({
            "success": False,
            "message": "Name and shipping address are required."
        }), 400

    # 5. Insert order + items in a single transaction
    order_number = _gen_order_number()
    db  = get_db()
    cur = db.cursor()

    try:
        # Insert order
        cur.execute("""
            INSERT INTO orders
              (order_number, session_id, user_id, customer_name, customer_email,
               customer_phone, shipping_address, subtotal, tax_amount, total_amount,
               payment_method, payment_status, order_status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            order_number, sid, session.get("user_id"),
            name, email, phone, address,
            round(subtotal, 2), tax, total,
            payment,
            "paid" if payment != "cod" else "pending",
            "confirmed"
        ))
        order_id = cur.lastrowid

        # Insert order items + decrement stock
        for item in items:
            price = _float(item["selling_price"])
            cur.execute("""
                INSERT INTO order_items
                  (order_id, product_id, product_name, brand, quantity, unit_price)
                VALUES (%s,%s,%s,%s,%s,%s)
            """, (order_id, item["product_id"], item["name"],
                  item["brand"], item["quantity"], price))

            cur.execute(
                "UPDATE products SET stock = stock - %s WHERE id = %s",
                (item["quantity"], item["product_id"])
            )

        # Clear cart
        cur.execute("DELETE FROM cart WHERE session_id = %s", (sid,))

        db.commit()
        logging.info(f"[Order] Placed {order_number} total=₹{total} sid={sid}")

    except Exception as exc:
        db.rollback()
        logging.error(f"[Order] DB error placing order: {exc}")
        return jsonify({"success": False, "message": "Failed to place order. Please retry."}), 500

    return jsonify({
        "success":      True,
        "message":      "Order placed successfully! 🎉",
        "order_number": order_number,
        "total":        total,
        "items_count":  len(items),
    }), 201


# ── GET /api/orders ─────────────────────────────────────────────────

@orders_bp.route("/api/orders", methods=["GET"])
def get_orders():
    sid    = _get_sid()
    status = request.args.get("status")

    base_sql = """
        SELECT id, order_number, customer_name, subtotal, tax_amount, total_amount,
               payment_method, payment_status, order_status, tracking_number,
               placed_at, updated_at
        FROM orders
        WHERE session_id = %s
    """
    args = [sid]

    if status and status != "all":
        base_sql += " AND order_status = %s"
        args.append(status)

    base_sql += " ORDER BY placed_at DESC LIMIT 50"
    orders = query_all(base_sql, tuple(args))

    # Enrich each order with its items
    for o in orders:
        o["subtotal"]    = _float(o["subtotal"])
        o["tax_amount"]  = _float(o["tax_amount"])
        o["total_amount"]= _float(o["total_amount"])
        o["placed_at"]   = str(o["placed_at"])
        o["updated_at"]  = str(o["updated_at"])

        items = query_all("""
            SELECT product_name, brand, quantity, unit_price, subtotal
            FROM order_items WHERE order_id = %s
        """, (o["id"],))
        for i in items:
            i["unit_price"] = _float(i["unit_price"])
            i["subtotal"]   = _float(i["subtotal"])
        o["items"] = items

    return jsonify({"success": True, "orders": orders, "count": len(orders)})


# ── GET /api/orders/<order_number> ──────────────────────────────────

@orders_bp.route("/api/orders/<order_number>", methods=["GET"])
def get_order_detail(order_number):
    sid   = _get_sid()
    order = query_one("""
        SELECT * FROM orders
        WHERE order_number = %s AND session_id = %s
    """, (order_number.upper(), sid))

    if not order:
        return jsonify({"success": False, "message": "Order not found"}), 404

    items = query_all(
        "SELECT * FROM order_items WHERE order_id = %s", (order["id"],)
    )
    for col in ["subtotal", "tax_amount", "total_amount"]:
        order[col] = _float(order[col])
    for i in items:
        i["unit_price"] = _float(i["unit_price"])
        i["subtotal"]   = _float(i["subtotal"])
    order["placed_at"]  = str(order["placed_at"])
    order["updated_at"] = str(order["updated_at"])
    order["items"]      = items

    return jsonify({"success": True, "order": order})


# ── GET /api/orders/track ────────────────────────────────────────────

@orders_bp.route("/api/orders/track", methods=["GET"])
def track_order():
    """Public endpoint — anyone can look up by order number."""
    order_number = (request.args.get("order_number") or "").strip().upper()
    if not order_number:
        return jsonify({"success": False, "message": "order_number param required"}), 400

    order = query_one("""
        SELECT order_number, customer_name, order_status, payment_status,
               payment_method, total_amount, tracking_number, placed_at, updated_at
        FROM orders WHERE order_number = %s
    """, (order_number,))

    if not order:
        return jsonify({"success": False, "message": "Order not found"}), 404

    order["total_amount"] = _float(order["total_amount"])
    order["placed_at"]    = str(order["placed_at"])
    order["updated_at"]   = str(order["updated_at"])

    items = query_all("""
        SELECT product_name, brand, quantity, unit_price
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.order_number = %s
    """, (order_number,))
    for i in items:
        i["unit_price"] = _float(i["unit_price"])
    order["items"] = items

    return jsonify({"success": True, "order": order})


# ── POST /api/orders/<order_number>/cancel ───────────────────────────

@orders_bp.route("/api/orders/<order_number>/cancel", methods=["POST"])
def cancel_order(order_number):
    sid   = _get_sid()
    order = query_one(
        "SELECT id, order_status FROM orders WHERE order_number=%s AND session_id=%s",
        (order_number.upper(), sid)
    )
    if not order:
        return jsonify({"success": False, "message": "Order not found"}), 404

    if order["order_status"] not in ("placed", "confirmed"):
        return jsonify({
            "success": False,
            "message": "Order cannot be cancelled — it may already be shipped or delivered."
        }), 400

    execute(
        "UPDATE orders SET order_status='cancelled' WHERE id=%s", (order["id"],)
    )
    return jsonify({"success": True, "message": "Order cancelled successfully."})
