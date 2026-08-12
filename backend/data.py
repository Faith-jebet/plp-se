"""
data.py
Mock 'backend' data for Northstar Retail Co. Same shape as the CLI
prototype's data.py so both surfaces (CLI + API) stay consistent.
Swap these dicts for real DB / order-management API calls later -
nothing outside this file needs to change.
"""

from datetime import date, timedelta

ORDERS = {
    "N1001": {
        "status": "Shipped",
        "shipped_date": "2026-08-10",
        "carrier": "DHL",
        "tracking_number": "DHL772311KE",
        "eta": "2026-08-15",
        "items": ["Running Shoes - Size 42"],
        "order_total": "KES 6,500",
        "return_window_days": 14,
        "delivered_date": None,
    },
    "N1002": {
        "status": "Delivered",
        "shipped_date": "2026-08-01",
        "carrier": "G4S",
        "tracking_number": "G4S998211KE",
        "eta": "2026-08-05",
        "items": ["Wireless Headphones"],
        "order_total": "KES 4,200",
        "return_window_days": 14,
        "delivered_date": "2026-08-05",
    },
    "N1003": {
        "status": "Processing",
        "shipped_date": None,
        "carrier": None,
        "tracking_number": None,
        "eta": "2026-08-18",
        "items": ["Office Chair - Black"],
        "order_total": "KES 12,000",
        "return_window_days": 14,
        "delivered_date": None,
    },
}

RETURNS = {
    "N1002": {"return_requested": False, "refund_status": None, "refund_days": 5}
}

STOCK = {
    "running shoes": {
        "sizes_in_stock": ["40", "41", "43", "44"],
        "sizes_out_of_stock": ["42"],
        "restock_eta": "2026-08-20",
    },
    "wireless headphones": {
        "sizes_in_stock": ["one-size"],
        "sizes_out_of_stock": [],
        "restock_eta": None,
    },
    "office chair": {
        "sizes_in_stock": ["black", "grey"],
        "sizes_out_of_stock": ["white"],
        "restock_eta": "2026-09-01",
    },
}


def get_order(order_id: str):
    return ORDERS.get(order_id.strip().upper())


def get_return_record(order_id: str):
    return RETURNS.setdefault(
        order_id.strip().upper(),
        {"return_requested": False, "refund_status": None, "refund_days": 5},
    )


def get_stock(product_name: str):
    return STOCK.get(product_name.strip().lower())


def is_within_return_window(order: dict) -> bool:
    if not order.get("delivered_date"):
        return False
    delivered = date.fromisoformat(order["delivered_date"])
    deadline = delivered + timedelta(days=order["return_window_days"])
    return date.today() <= deadline