"""
app.py
Northstar Support Deflection MVP - Flask API.

Run:
    pip install -r requirements.txt
    python app.py

Serves on http://localhost:5000 by default. CORS is enabled so the
React dev server (usually http://localhost:5173) can call it directly.

Endpoints
---------
GET  /api/health
GET  /api/orders/<order_id>
GET  /api/orders/<order_id>/return-eligibility
POST /api/orders/<order_id>/return
GET  /api/stock/<product>?size=<size>
POST /api/tickets                 - log a resolved/escalated interaction
GET  /api/tickets                 - list logged interactions + summary counts
"""

import csv
import os
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS

from data import get_order, get_return_record, get_stock, is_within_return_window

app = Flask(__name__)
CORS(app)

LOG_FILE = os.path.join(os.path.dirname(__file__), "deflection_log.csv")
LOG_FIELDS = ["timestamp", "user_message", "intent", "deflected"]


def ensure_log_file():
    if not os.path.isfile(LOG_FILE):
        with open(LOG_FILE, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(LOG_FIELDS)


def append_log(user_message: str, intent: str, deflected: bool):
    ensure_log_file()
    with open(LOG_FILE, "a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(
            [datetime.now().isoformat(timespec="seconds"), user_message, intent, deflected]
        )


def read_log():
    ensure_log_file()
    with open(LOG_FILE, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# Order status
# ---------------------------------------------------------------------------
@app.get("/api/orders/<order_id>")
def order_status(order_id):
    order = get_order(order_id)
    if not order:
        return jsonify({"error": f"Order {order_id.upper()} not found"}), 404
    return jsonify({"order_id": order_id.upper(), **order})


# ---------------------------------------------------------------------------
# Returns & refunds
# ---------------------------------------------------------------------------
@app.get("/api/orders/<order_id>/return-eligibility")
def return_eligibility(order_id):
    order = get_order(order_id)
    if not order:
        return jsonify({"error": f"Order {order_id.upper()} not found"}), 404

    if order["status"] != "Delivered":
        return jsonify({
            "eligible": False,
            "reason": f"Order hasn't been delivered yet (status: {order['status']}).",
        })

    if not is_within_return_window(order):
        return jsonify({
            "eligible": False,
            "reason": f"Return window of {order['return_window_days']} days has closed.",
        })

    record = get_return_record(order_id)
    return jsonify({
        "eligible": True,
        "refund_days": record["refund_days"],
    })


@app.post("/api/orders/<order_id>/return")
def initiate_return(order_id):
    order = get_order(order_id)
    if not order:
        return jsonify({"error": f"Order {order_id.upper()} not found"}), 404

    if order["status"] != "Delivered" or not is_within_return_window(order):
        return jsonify({"error": "Order is not eligible for return"}), 400

    record = get_return_record(order_id)
    record["return_requested"] = True
    record["refund_status"] = "pending"

    return jsonify({
        "order_id": order_id.upper(),
        "return_requested": True,
        "refund_status": "pending",
        "refund_days": record["refund_days"],
    })


# ---------------------------------------------------------------------------
# Stock availability
# ---------------------------------------------------------------------------
@app.get("/api/stock/<product>")
def stock_availability(product):
    item = get_stock(product)
    if not item:
        return jsonify({"error": f"'{product}' not found in catalog"}), 404

    size = request.args.get("size")
    if size:
        in_stock = size.lower() in [s.lower() for s in item["sizes_in_stock"]]
        return jsonify({
            "product": product,
            "size": size,
            "in_stock": in_stock,
            "restock_eta": item["restock_eta"] if not in_stock else None,
        })

    return jsonify({"product": product, **item})


# ---------------------------------------------------------------------------
# Ticket / deflection logging (the audit trail Assignment 2 needs)
# ---------------------------------------------------------------------------
@app.post("/api/tickets")
def log_ticket():
    body = request.get_json(silent=True) or {}
    user_message = body.get("user_message", "")
    intent = body.get("intent", "unknown")
    deflected = bool(body.get("deflected", False))

    if not user_message:
        return jsonify({"error": "user_message is required"}), 400

    append_log(user_message, intent, deflected)
    return jsonify({"logged": True}), 201


@app.get("/api/tickets")
def list_tickets():
    rows = read_log()
    deflected_count = sum(1 for r in rows if r["deflected"].lower() == "true")
    escalated_count = len(rows) - deflected_count
    return jsonify({
        "tickets": rows,
        "summary": {
            "total": len(rows),
            "deflected": deflected_count,
            "escalated": escalated_count,
        },
    })


if __name__ == "__main__":
    ensure_log_file()
    app.run(debug=True, port=5000)