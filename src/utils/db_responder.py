"""
src/utils/db_responder.py
=========================
DB-first chatbot response layer for NexPC.

Architecture
------------
User query
   │
   ├─► 1. Intent detection (keyword-based)
   │        • "faq"     → search faqs table
   │        • "product" → search products table
   │        • "order"   → delegate to order tracker
   │        • "unknown" → skip DB, let LLM handle
   │
   ├─► 2. FAQ search  (LIKE-based keyword match)
   │        Hit → return formatted FAQ answer immediately
   │        Miss → fall through to product search
   │
   ├─► 3. Product search (name / brand / category LIKE)
   │        Hit → return formatted product card(s)
   │        Miss → return None (caller falls back to LLM/RAG)
   │
   └─► 4. None returned → caller uses Pinecone + Groq LLM

No LLM calls are made inside this module — it is purely MySQL-driven.
Tamil queries should be translated to English before calling this module.
"""

import re
from typing import Optional
from src.utils.logger import logging

# ── Intent keyword groups ─────────────────────────────────────────────────────
_FAQ_KEYWORDS = {
    "return", "refund", "money back", "exchange",
    "ship", "shipping", "deliver", "delivery", "days",
    "warranty", "guarant", "defect",
    "cancel", "cancell",
    "payment", "pay", "upi", "emi", "installment", "card", "cod",
    "track", "tracking", "order number", "ord-",
    "account", "login", "register", "sign up", "sign in",
    "policy", "policies",
    "invoice", "receipt",
    "international", "abroad",
    "gift", "gift wrap",
    "price match", "price adjustment",
    "discount code", "promo code", "coupon",
    "bulk", "wholesale",
    "review", "rating",
    "support", "contact", "help", "customer",
}

_PRODUCT_KEYWORDS = {
    # Generic
    "recommend", "suggest", "best", "buy", "purchase",
    "price", "cost", "how much", "cheap", "budget", "affordable",
    "spec", "specification", "feature",
    "compare", "vs", "versus", "comparison",
    # Categories
    "cpu", "processor", "core", "ryzen", "intel", "amd",
    "gpu", "graphics", "rtx", "gtx", "radeon", "rx ", "geforce", "nvidia",
    "ram", "memory", "ddr4", "ddr5", "gb ram", "dimm",
    "ssd", "nvme", "sata", "storage", "hard", "hdd", "drive",
    "motherboard", "mobo", "socket", "chipset", "lga", "am4", "am5",
    "psu", "power supply", "watt", "450w", "550w", "650w", "750w",
    "cooler", "cooling", "fan", "aio", "heatsink",
    "case", "cabinet", "tower", "chassis",
    # Budget signals
    "under ₹", "under rs", "below ₹", "₹10000", "₹20000", "₹30000",
    "gaming pc", "workstation", "build",
}

_ORDER_KEYWORDS = {
    "track my order", "where is my order", "order status",
    "ord-", "order #", "order number",
    "my order", "my purchase",
}


def detect_intent(query: str) -> str:
    """
    Classify user query intent.

    Returns one of: "order", "faq", "product", "unknown"
    Priority: order > faq > product > unknown
    """
    q = query.lower()

    # Order tracking has highest priority
    for kw in _ORDER_KEYWORDS:
        if kw in q:
            return "order"

    # Check FAQ keywords
    for kw in _FAQ_KEYWORDS:
        if kw in q:
            return "faq"

    # Check product keywords
    for kw in _PRODUCT_KEYWORDS:
        if kw in q:
            return "product"

    return "unknown"


# ── DB Search helpers ─────────────────────────────────────────────────────────

def _get_db():
    """Get current Flask request DB connection."""
    from database.db import get_db
    return get_db()


def _extract_keywords(query: str, min_len: int = 3) -> list[str]:
    """
    Extract meaningful words from query for LIKE searches.
    Removes common stop-words and very short words.
    """
    stop_words = {
        "the", "is", "are", "for", "and", "or", "in", "of", "a", "an",
        "to", "me", "my", "do", "you", "can", "will", "what", "how",
        "i", "it", "its", "with", "on", "at", "by", "from", "get",
        "please", "tell", "about", "any", "some", "have", "has",
    }
    words = re.findall(r'\b[a-zA-Z0-9₹]+\b', query.lower())
    return [w for w in words if len(w) >= min_len and w not in stop_words]


def search_faq(query: str, max_results: int = 2) -> Optional[str]:
    """
    Search the faqs table using keyword LIKE matching.

    Returns formatted answer string if found, else None.
    """
    try:
        keywords = _extract_keywords(query)
        if not keywords:
            return None

        db = _get_db()
        cur = db.cursor()

        # Build OR conditions across question + answer + category
        # Use the first 3 most meaningful keywords for performance
        search_kws = keywords[:4]
        conditions = []
        params = []
        for kw in search_kws:
            conditions.append(
                "(LOWER(question) LIKE %s OR LOWER(answer) LIKE %s OR LOWER(category) LIKE %s)"
            )
            like_val = f"%{kw}%"
            params.extend([like_val, like_val, like_val])

        # Also try exact phrase matching for higher precision
        phrase_like = f"%{query[:80].lower()}%"

        # Build the WHERE clause: phrase match OR individual keyword conditions
        kw_clause = " OR ".join(conditions) if conditions else "1=0"
        sql = f"""
            SELECT question, answer, category
            FROM faqs
            WHERE is_active = 1
              AND (question LIKE %s OR ({kw_clause}))
            ORDER BY
              CASE WHEN LOWER(question) LIKE %s THEN 0 ELSE 1 END,
              LENGTH(answer) ASC
            LIMIT {max_results}
        """
        # Params: phrase_like (for WHERE), keyword params, phrase_like again (for ORDER BY)
        all_params = [phrase_like] + params + [phrase_like]
        cur.execute(sql, all_params)
        rows = cur.fetchall()

        if not rows:
            return None

        if len(rows) == 1:
            return _format_faq_response(rows[0])
        else:
            # Multiple hits → return best one (shortest answer = most specific)
            return _format_faq_response(rows[0])

    except Exception as e:
        logging.error(f"[DBResponder] FAQ search error: {e}")
        return None


def search_products(query: str, max_results: int = 3) -> Optional[str]:
    """
    Search the products table by name, brand, or category.

    Returns formatted product card(s) if found, else None.
    """
    try:
        keywords = _extract_keywords(query)
        if not keywords:
            return None

        db = _get_db()
        cur = db.cursor()

        # Build search across product name, brand, and category name
        search_kws = keywords[:5]
        conditions = []
        params = []
        for kw in search_kws:
            like_val = f"%{kw}%"
            conditions.append(
                "(LOWER(p.name) LIKE %s OR LOWER(p.brand) LIKE %s "
                "OR LOWER(c.name) LIKE %s OR LOWER(p.slug) LIKE %s)"
            )
            params.extend([like_val, like_val, like_val, like_val])

        if not conditions:
            return None

        sql = f"""
            SELECT p.name, p.brand, p.selling_price, p.mrp,
                   p.rating, p.description, p.specifications,
                   p.image_url, p.stock, c.name AS category_name, p.slug
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
              AND ({' OR '.join(conditions)})
            ORDER BY p.rating DESC, p.stock DESC
            LIMIT {max_results}
        """
        cur.execute(sql, params)
        rows = cur.fetchall()

        if not rows:
            return None

        return _format_product_response(rows)

    except Exception as e:
        logging.error(f"[DBResponder] Product search error: {e}")
        return None


# ── Response formatters ───────────────────────────────────────────────────────

def _format_faq_response(row: dict) -> str:
    """Format a single FAQ row into a clean chatbot response."""
    question = row.get("question", "")
    answer   = row.get("answer", "")
    category = row.get("category", "")

    # Category emoji mapping
    cat_emoji = {
        "returns":       "↩️",
        "shipping":      "🚚",
        "warranty":      "🛡️",
        "payment":       "💳",
        "orders":        "📦",
        "products":      "🖥️",
        "compatibility": "🔧",
        "general":       "ℹ️",
        "account":       "👤",
        "availability":  "📋",
    }
    emoji = cat_emoji.get(category, "ℹ️")

    return f"{emoji} **{answer}**"


def _format_product_response(rows: list[dict]) -> str:
    """Format product row(s) into chatbot product card format."""
    lines = []

    for p in rows:
        name   = p.get("name", "Unknown")
        brand  = p.get("brand", "")
        price  = float(p.get("selling_price", 0))
        mrp    = float(p.get("mrp", price))
        rating = float(p.get("rating", 4.0))
        stock  = p.get("stock", 0)
        cat    = p.get("category_name", "")
        desc   = p.get("description", "")

        # Discount calculation
        discount = round((mrp - price) / mrp * 100) if mrp > price else 0
        price_str = f"₹{price:,.0f}"
        mrp_str   = f"₹{mrp:,.0f}" if mrp > price else ""

        # Build spec chips from JSON
        spec_str = ""
        try:
            import json
            specs = p.get("specifications")
            if isinstance(specs, str):
                specs = json.loads(specs)
            if isinstance(specs, dict):
                chips = list(specs.values())[:3]
                spec_str = " | ".join(str(c) for c in chips if c)
        except Exception:
            pass

        # Stock badge
        stock_badge = ""
        if stock is not None:
            if stock == 0:
                stock_badge = " ❌ Out of stock"
            elif stock <= 3:
                stock_badge = f" ⚠️ Only {stock} left"

        card = (
            f"**{brand} {name}**\n"
            f"Category: {cat}\n"
            f"Price: **{price_str}**"
            + (f" ~~{mrp_str}~~ ({discount}% OFF)" if discount > 0 else "")
            + f"\nRating: {'★' * int(rating)}{'☆' * (5 - int(rating))} {rating:.1f}"
            + (f"\nSpecs: {spec_str}" if spec_str else "")
            + (f"\n{stock_badge}" if stock_badge else "")
            + (f"\n_{desc[:100]}..._" if desc and len(desc) > 20 else "")
        )
        lines.append(card)

    if len(lines) == 1:
        return lines[0]

    header = f"🖥️ Found **{len(lines)} matching products**:\n\n"
    return header + "\n\n---\n\n".join(lines)


# ── Main entry point ──────────────────────────────────────────────────────────

def get_db_response(query: str, lang: str = "en") -> Optional[str]:
    """
    Main entry point for DB-first chatbot responses.

    1. Detect intent from query
    2. Run appropriate DB search
    3. Return answer string or None (caller uses LLM fallback)

    Args:
        query: The user's query (should already be translated to English
               by tamil_utils if it was Tamil input)
        lang:  Original language ("en" or "ta")

    Returns:
        str  → DB answer found, return this to user
        None → No DB match, caller should use LLM/RAG pipeline
    """
    if not query or len(query.strip()) < 2:
        return None

    intent = detect_intent(query)
    logging.info(f"[DBResponder] intent='{intent}' for query='{query[:60]}'")

    if intent == "order":
        # Order tracking is handled by the /api/orders/track endpoint
        # Provide a helpful hint to the user
        return (
            "📦 To track your order, please enter your order number "
            "(e.g. ORD-20240001) in the **Track Your Order** section below, "
            "or type: **Track my order ORD-XXXXX**"
        )

    if intent == "faq":
        result = search_faq(query)
        if result:
            return result
        # FAQ miss → try product search as fallback (some FAQs mention products)
        return search_products(query)

    if intent == "product":
        result = search_products(query)
        if result:
            return result
        # Product miss → try FAQ (e.g. "what GPU do you sell?")
        return search_faq(query)

    # intent == "unknown" → no DB lookup, return None for LLM
    return None
