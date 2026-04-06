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
        data       = request.get_json(silent=True) or {}
        question   = (data.get("input") or "").strip()
        lang       = data.get("lang", "en")   # "en" | "ta"
        session_id = session.get("chat_session", "chat_1")

        if not question:
            return jsonify({"response": "Please type a message."}), 400

        logging.info(f"[Chat] lang={lang} | Q: {question}")

        # ── Step 1: Tamil detection & translation ────────────────────
        english_query = question
        try:
            from src.utils.tamil_utils import is_tamil, translate_to_english
            if is_tamil(question) or lang == "ta":
                lang = "ta"
                english_query = translate_to_english(question)
                logging.info(f"[Chat] Tamil→EN: '{english_query[:60]}'")
        except Exception as te:
            logging.warning(f"[Chat] Tamil translation error: {te}")

        # ── Step 2: DB-first response (FAQ / product lookup) ─────────
        db_answer = None
        try:
            from src.utils.db_responder import get_db_response
            db_answer = get_db_response(english_query, lang=lang)
        except Exception as dbe:
            logging.warning(f"[Chat] DB responder error: {dbe}")

        if db_answer:
            # Wrap with Tamil prefix if original query was Tamil
            try:
                from src.utils.tamil_utils import maybe_tamil_prefix
                db_answer = maybe_tamil_prefix(db_answer, question)
            except Exception:
                pass

            logging.info(f"[Chat] DB hit. Answer: {db_answer[:80]}")
            _save_chat_log(session_id, question, db_answer, lang)
            return jsonify({"response": db_answer}), 200

        # ── Step 3: LLM / RAG fallback ───────────────────────────────
        bot = get_chatbot()
        if bot is None:
            return jsonify({
                "response": ("நான் இப்போது கிடைக்கவில்லை. பின்னர் முயற்சிக்கவும்."
                             if lang == "ta"
                             else "I'm temporarily unavailable. Please try again shortly.")
            }), 503

        try:
            config   = {"configurable": {"session_id": session_id}}
            # For Tamil, send the translated English query to LLM
            # but keep original Tamil in conversation context
            llm_input = english_query if lang == "ta" else question
            response  = bot.invoke({"input": llm_input}, config=config)
            answer    = response.get("answer", "I couldn't find a relevant answer.")
            logging.info(f"[Chat] LLM A: {answer[:120]}")

            _save_chat_log(session_id, question, answer, lang)
            return jsonify({"response": answer}), 200

        except Exception as exc:
            logging.error(f"Chat error: {exc}")
            return jsonify({"response": "Something went wrong. Please try again."}), 500


    def _save_chat_log(session_id, question, answer, lang):
        """Persist user + bot messages to chat_logs (best-effort)."""
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
            pass  # non-critical


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
        category = request.args.get("category")       # category slug filter
        q        = (request.args.get("q") or "").strip()  # text search
        limit    = min(int(request.args.get("limit", 100)), 200)

        params = []
        where  = ["p.is_active = 1"]

        if category:
            where.append("c.slug = %s")
            params.append(category)

        if q:
            # Server-side text search across name, brand, and category
            like = f"%{q}%"
            where.append(
                "(LOWER(p.name) LIKE %s OR LOWER(p.brand) LIKE %s "
                "OR LOWER(c.name) LIKE %s OR LOWER(p.slug) LIKE %s)"
            )
            params.extend([like, like, like, like])

        where_clause = " AND ".join(where)
        sql = f"""
            SELECT p.*, c.name AS category_name
            FROM products p JOIN categories c ON p.category_id = c.id
            WHERE {where_clause}
            ORDER BY p.rating DESC
            LIMIT {limit}
        """
        rows = query_all(sql, params if params else ())

        # Convert Decimal → float for JSON serialisation
        for r in rows:
            r["selling_price"] = float(r["selling_price"])
            r["mrp"]           = float(r["mrp"])
            r["rating"]        = float(r["rating"])

        return jsonify({"success": True, "products": rows, "count": len(rows)})


    @app.route("/api/faqs", methods=["GET"])
    def api_faqs():
        """Return all active FAQs, optionally filtered by category."""
        from database.db import query_all
        category = request.args.get("category")
        if category:
            rows = query_all(
                "SELECT id, question, answer, category FROM faqs "
                "WHERE is_active = 1 AND category = %s ORDER BY id",
                (category,)
            )
        else:
            rows = query_all(
                "SELECT id, question, answer, category FROM faqs "
                "WHERE is_active = 1 ORDER BY category, id",
                ()
            )
        return jsonify({"success": True, "faqs": rows, "count": len(rows)})


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
