"""
chatbot.py
Northstar Support Deflection MVP — CLI prototype.

Run:
    python chatbot.py

Covers all 3 ticket categories:
    1) Order status
    2) Returns & refunds
    3) Stock availability

Matching strategy: keyword matching first; if nothing matches, the user
gets a numbered menu instead of a dead end (combo approach). Every
resolved conversation is logged to deflection_log.csv so the team can
prove ticket deflection to Northstar during the Day-5 demo.
"""

import csv
import os
from datetime import datetime

from intents import classify, MENU_TEXT, MENU_MAP
from handlers import (
    handle_order_status,
    handle_returns_refund,
    handle_stock_availability,
    handle_human,
)

LOG_FILE = os.path.join(os.path.dirname(__file__), "deflection_log.csv")

HANDLERS = {
    "order_status": handle_order_status,
    "returns_refund": handle_returns_refund,
    "stock_availability": handle_stock_availability,
    "human": handle_human,
}

WELCOME = """
============================================================
 Northstar Retail Co. — Support Bot (MVP prototype)
============================================================
Ask me about an order, a return/refund, or product stock.
Type 'quit' any time to exit.
"""


def log_interaction(user_text: str, intent: str, deflected: bool):
    file_exists = os.path.isfile(LOG_FILE)
    with open(LOG_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["timestamp", "user_message", "matched_intent", "deflected"])
        writer.writerow([datetime.now().isoformat(timespec="seconds"), user_text, intent, deflected])


def ask(prompt: str) -> str:
    """Wrapper around input() so handlers stay testable/swappable later (e.g. for a web UI)."""
    return input(f"You: " if prompt is None else prompt)


def run_menu_fallback():
    print(MENU_TEXT)
    choice = input("Your choice (1-5): ").strip()
    return MENU_MAP.get(choice)


def main():
    print(WELCOME)
    while True:
        user_text = input("\nYou: ").strip()
        if not user_text:
            continue

        intent = classify(user_text)

        if intent is None:
            intent = run_menu_fallback()

        if intent == "exit" or intent is None:
            print("Bot: Thanks for contacting Northstar Retail — goodbye!")
            log_interaction(user_text, "exit", True)
            break

        handler = HANDLERS.get(intent)
        if not handler:
            print("Bot: Sorry, I'm not sure how to help with that. Type 'human' to escalate.")
            log_interaction(user_text, intent or "unmatched", False)
            continue

        deflected = handler(ask)
        log_interaction(user_text, intent, deflected)


if __name__ == "__main__":
    main()