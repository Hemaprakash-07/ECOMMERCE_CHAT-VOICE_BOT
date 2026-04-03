"""
app.py — Main Flask application
E-commerce Chat & Voice Bot for Assisting Customer Queries
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()  # must be first — loads .env before anything else

from flask import Flask, request, render_template, jsonify, session, redirect, url_for

from database.db import init_app as init_db
from src.routes.auth import auth_bp
from src.routes.cart import cart_bp
from src.routes.orders import orders_bp
from src.utils.logger import logging
from src.utils.exception import Custom_exception

# ── App factory ────────────────────────────────────────────────────
def create_app() -> Flask:
    app = Flask(__name__)

    # ── Secret key & session config ─────────────────────────────────
    app.secret_key = os.getenv("SECRET_KEY", "ecom-chatbot-dev-secret")
    app.permanent_session_lifetime = timedelta(days=7)

    # ── Register DB teardown ─────────────────────────────────────────
    init_db(app)

    # ── Register blueprints ──────────────────────────────────────────
    app.register_blueprint(auth_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(orders_bp)

    # ── Chatbot (lazy-loaded) ────────────────────────────────────────
    chatbot_instance = {"bot": None}

    def get_chatbot():
        if chatbot_instance["bot"] is None:
            try:
                from src.utils.chatbot_utils import BuildChatbot
                utils = BuildChatbot()
                chatbot_instance["bot"] = utils.initialize_chatbot()
                logging.info("Chatbot initialized successfully.")
            except Exception as exc:
                logging.error(f"Chatbot init failed: {exc}")
        return chatbot_instance["bot"]

    # ────────────────────────────────────────────────────────────────
    # Page routes
    # ────────────────────────────────────────────────────────────────

    @app.route("/")
    def home():
        return render_template("home_page.html",
                               user_name=session.get("user_name"),
                               user_id=session.get("user_id"))

    @app.route("/cart")
    def cart_page():
        return render_template("cart.html",
                               user_name=session.get("user_name"),
                               user_id=session.get("user_id"))

    @app.route("/orders")
    def orders_page():
        return render_template("orders.html",
                               user_name=session.get("user_name"),
                               user_id=session.get("user_id"))

    @app.route("/order-confirmation")
    def order_confirmation_page():
        order_number = request.args.get("order_number", "")
        return render_template("order_confirmation.html",
                               order_number=order_number,
                               user_name=session.get("user_name"),
                               user_id=session.get("user_id"))

    @app.route("/contact")
    def contact_page():
        return render_template("contact.html",
                               user_name=session.get("user_name"),
                               user_id=session.get("user_id"))

    # ────────────────────────────────────────────────────────────────
    # Chatbot API (existing + extended)
    # ────────────────────────────────────────────────────────────────

    @app.route("/chat", methods=["POST"])
    def chat():
        data     = request.get_json(silent=True) or {}
        question = (data.get("input") or "").strip()
        lang     = data.get("lang", "en")       # "en" | "ta"
        session_id = session.get("chat_session", "chat_1")

        if not question:
            return jsonify({"response": "Please type a message."}), 400

        logging.info(f"[Chat] lang={lang} | Q: {question}")

        bot = get_chatbot()
        if bot is None:
            return jsonify({
                "response": ("நான் இப்போது கிடைக்கவில்லை. பின்னர் முயற்சிக்கவும்."
                             if lang == "ta"
                             else "I'm temporarily unavailable. Please try again shortly.")
            }), 503

        try:
            config   = {"configurable": {"session_id": session_id}}
            response = bot.invoke({"input": question}, config=config)
            answer   = response.get("answer", "I couldn't find a relevant answer.")
            logging.info(f"[Chat] A: {answer[:120]}...")

            # Persist to DB (best-effort)
            try:
                from database.db import get_db
                db  = get_db()
                cur = db.cursor()
                cur.execute(
                    "INSERT INTO chat_logs (session_id, user_id, role, message, language) VALUES (%s,%s,%s,%s,%s)",
                    (session_id, session.get("user_id"), "user", question, lang)
                )
                cur.execute(
                    "INSERT INTO chat_logs (session_id, user_id, role, message, language) VALUES (%s,%s,%s,%s,%s)",
                    (session_id, session.get("user_id"), "bot", answer, lang)
                )
                db.commit()
            except Exception:
                pass   # non-critical

            return jsonify({"response": answer}), 200

        except Exception as exc:
            logging.error(f"Chat error: {exc}")
            return jsonify({"response": "Something went wrong. Please try again."}), 500


    @app.route("/chatbot", methods=["POST"])
    def chatbot():
        """Alias kept for compatibility with older front-end calls."""
        return chat()


    @app.route("/voicebot", methods=["POST"])
    def voicebot():
        """Voice transcript arrives as JSON {transcript, lang}; same RAG pipeline."""
        data       = request.get_json(silent=True) or {}
        transcript = (data.get("transcript") or "").strip()
        lang       = data.get("lang", "en")
        if not transcript:
            return jsonify({"response": "No voice input received."}), 400
        # Delegate to chat logic
        request._cached_json = ({"input": transcript, "lang": lang}, True)
        return chat()


    # ── Cart & Order APIs are handled by blueprints ─────────────────
    # cart_bp  → /api/cart/*
    # orders_bp → /api/orders/*

    # ────────────────────────────────────────────────────────────────
    # Product API
    # ────────────────────────────────────────────────────────────────

    @app.route("/api/products", methods=["GET"])
    def api_products():
        from database.db import query_all
        category = request.args.get("category")
        if category:
            rows = query_all("""
                SELECT p.*, c.name AS category_name
                FROM products p JOIN categories c ON p.category_id = c.id
                WHERE c.slug = %s AND p.is_active = 1
                ORDER BY p.rating DESC
            """, (category,))
        else:
            rows = query_all("""
                SELECT p.*, c.name AS category_name
                FROM products p JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = 1
                ORDER BY c.id, p.rating DESC
            """)
        # Convert Decimal to float for JSON
        for r in rows:
            r["selling_price"] = float(r["selling_price"])
            r["mrp"]           = float(r["mrp"])
            r["rating"]        = float(r["rating"])
        return jsonify({"success": True, "products": rows})


    # Order tracking is handled by orders_bp → /api/orders/track


    # ────────────────────────────────────────────────────────────────
    # Error handlers
    # ────────────────────────────────────────────────────────────────

    @app.errorhandler(404)
    def not_found(_):
        return render_template("home_page.html",
                               user_name=session.get("user_name"),
                               user_id=session.get("user_id")), 404

    @app.errorhandler(500)
    def server_error(_):
        return jsonify({"error": "Internal server error"}), 500

    return app


# ── Entry point ─────────────────────────────────────────────────────
app = create_app()

if __name__ == "__main__":
    print("=" * 60)
    print("  E-commerce Chat & Voice Bot — Starting Server")
    print("=" * 60)
    app.run(host="0.0.0.0", port=8000, debug=True)
