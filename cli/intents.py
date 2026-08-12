"""
intents.py
Lightweight keyword matcher. No ML dependency needed for the MVP -
this is intentional: it keeps the bot demoable, debuggable, and easy
for Northstar's own team to extend after handover (see go-live note).
"""

import re

INTENT_KEYWORDS = {
    "order_status": [
        "where is my order", "track", "tracking", "shipped", "has it shipped",
        "order status", "when will it arrive", "delivery", "arrive",
    ],
    "returns_refund": [
        "return", "refund", "money back", "send it back", "exchange",
        "cancel my order", "how do i return",
    ],
    "stock_availability": [
        "in stock", "back in stock", "available", "different size",
        "do you have", "restock", "sold out",
    ],
    "exit": ["quit", "exit", "bye", "goodbye", "stop"],
    "human": ["human", "agent", "representative", "real person", "talk to someone"],
}


def classify(text: str):
    """Returns an intent key, or None if nothing matched (triggers menu fallback)."""
    text_lower = text.lower().strip()
    for intent, phrases in INTENT_KEYWORDS.items():
        for phrase in phrases:
            if re.search(r"\b" + re.escape(phrase) + r"\b", text_lower):
                return intent
    return None


MENU_TEXT = """
I couldn't quite match that to a topic. Choose a number instead:

  1) Order status / tracking
  2) Returns & refunds
  3) Stock availability
  4) Talk to a human agent
  5) Quit

"""

MENU_MAP = {
    "1": "order_status",
    "2": "returns_refund",
    "3": "stock_availability",
    "4": "human",
    "5": "exit",
}