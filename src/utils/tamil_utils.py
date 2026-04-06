"""
src/utils/tamil_utils.py
========================
Tamil language detection and translation utilities.

Strategy:
  1. Detect Tamil input via Unicode range U+0B80–U+0BFF.
  2. Translate Tamil → English using the Groq LLM (already configured),
     so no extra API keys are needed.
  3. Return translated English text for DB queries.
  4. Optionally wrap English answers back into Tamil preamble.

If Groq is unavailable, fall back to a keyword-map dictionary.
"""

import os
import re
from src.utils.logger import logging

# ── Tamil Unicode detection ───────────────────────────────────────────────────
TAMIL_UNICODE_RANGE = re.compile(r'[\u0B80-\u0BFF]')


def is_tamil(text: str) -> bool:
    """Return True if the text contains Tamil Unicode characters."""
    return bool(TAMIL_UNICODE_RANGE.search(text))


# ── Static Tamil → English keyword map (fallback) ────────────────────────────
TAMIL_KEYWORD_MAP: dict[str, str] = {
    # Products
    "ப்ரோசஸர்": "processor",
    "செயலி": "processor",
    "பிரோசஸர்": "processor",
    "ஜிபியு": "gpu",
    "கிராபிக்ஸ் கார்டு": "graphics card",
    "வரைகலை அட்டை": "graphics card",
    "ராம்": "ram",
    "நினைவகம்": "memory ram",
    "சேமிப்பு": "storage",
    "எஸ்எஸ்டி": "ssd",
    "மதர்போர்டு": "motherboard",
    "தாய்பலகை": "motherboard",
    "பவர் சப்ளை": "power supply",
    "மின்சாரம்": "power supply",
    "கூலர்": "cooler",
    "கேபிள்": "cabinet case",

    # Brands
    "இன்டெல்": "intel",
    "என்விடியா": "nvidia",
    "ஏஏம்டி": "amd",
    "சாம்சங்": "samsung",
    "கோர்சேர்": "corsair",

    # Queries
    "விலை": "price",
    "விலை என்ன": "what is the price",
    "சிறந்த": "best",
    "பரிந்துரை": "recommend",
    "பரிந்துரைக்க": "recommend",
    "வாங்க": "buy",
    "வாங்கலாமா": "can i buy",
    "ஒப்பிடு": "compare",
    "ஒப்பீடு": "comparison versus",
    "என் ஆர்டர்": "my order",
    "ஆர்டர் நிலை": "order status",
    "டெலிவரி": "delivery",
    "திரும்பப் பெறும்": "return",
    "திரும்ப": "return",
    "கொள்கை": "policy",
    "திரும்பப் பெறும் கொள்கை": "return policy",
    "உத்தரவாதம்": "warranty",
    "தள்ளுபடி": "discount",
    "இலவச": "free",
    "கட்டணம்": "payment",
    "ஈஎம்ஐ": "emi installment",
    "கட்டணம் எப்படி": "how to pay",
    "கணக்கு": "account",
    "பதிவு": "register",
    "உள்நுழை": "login",
    "உதவி": "help support",
    "தொலைபேசி": "phone contact",
    "வாட்ஸ்அப்": "whatsapp contact",
    "என்ன": "what",
    "எப்படி": "how",
    "எங்கே": "where",
    "எவ்வளவு": "how much",
    "நல்ல": "good best",
    "மலிவான": "cheap budget",
    "அதிக": "high maximum",
    "குறைந்த": "low minimum budget",
}


def keyword_translate(text: str) -> str:
    """
    Simple keyword-level Tamil → English translation using the static map.
    Used as a fallback when Groq is unavailable.
    """
    result = text
    # Longest-match first to avoid substring conflicts
    for tamil_kw, eng_kw in sorted(TAMIL_KEYWORD_MAP.items(),
                                   key=lambda x: len(x[0]), reverse=True):
        result = result.replace(tamil_kw, eng_kw)
    return result


# ── Groq-based translation ────────────────────────────────────────────────────
def translate_to_english(text: str) -> str:
    """
    Translate a Tamil (or mixed) query to English for DB keyword search.

    Priority:
      1. Groq LLM translation (fast, accurate)
      2. Static keyword map (fallback)

    Returns: English string for downstream DB search.
    """
    if not is_tamil(text):
        return text  # Already English — no translation needed

    # ── Try Groq translation ─────────────────────────────────────────────────
    try:
        from langchain_groq import ChatGroq
        llm = ChatGroq(
            temperature=0,
            model_name="llama-3.1-8b-instant",   # fast lightweight model
            groq_api_key=os.getenv("GROQ_API_KEY"),
            max_tokens=256,
        )
        prompt = (
            "Translate the following Tamil text to English. "
            "Output ONLY the English translation — no explanation, no prefix.\n\n"
            f"Tamil text: {text}\n\nEnglish:"
        )
        response = llm.invoke(prompt)
        translated = response.content.strip()
        if translated:
            logging.info(f"[Tamil→EN] '{text[:40]}' → '{translated[:60]}'")
            return translated
    except Exception as e:
        logging.warning(f"[TamilUtils] Groq translation failed: {e}. Using keyword map.")

    # ── Fallback: static keyword map ─────────────────────────────────────────
    return keyword_translate(text)


# ── Format response for Tamil users ──────────────────────────────────────────
def maybe_tamil_prefix(answer: str, original_query: str) -> str:
    """
    If the original query was in Tamil but the answer is in English,
    add a short Tamil preamble directing users to read on.
    Used when DB returns a raw English answer for a Tamil query.
    (The LLM pipeline handles full Tamil responses; this is only for
    the pure DB-hit path where we bypass the LLM.)
    """
    if not is_tamil(original_query):
        return answer
    # If answer already contains Tamil chars, return as-is
    if is_tamil(answer):
        return answer
    # Prepend a simple Tamil note
    return (
        "📋 நீங்கள் கேட்டதற்கான பதில்:\n\n"
        + answer
        + "\n\n(மேலும் தகவலுக்கு தமிழில் கேலுங்கள் அல்லது AI உதவியாளரிடம் கேளுங்கள்.)"
    )
