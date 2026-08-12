"""
handlers.py
One function per ticket category. Each handler owns its own small
sub-conversation (ask for order id / product, validate, respond) and
returns a "deflected" boolean so the log can prove the bot resolved
the ticket without a human.
"""

from data import get_order, get_return_info, get_stock, is_within_return_window


def handle_order_status(ask):
    order_id = ask("Sure — what's your order ID? (e.g. N1001): ")
    order = get_order(order_id)
    if not order:
        print(f"Bot: I couldn't find order '{order_id.upper()}'. Double-check the "
              f"ID on your confirmation email, or type 'human' to escalate.")
        return False

    if order["status"] == "Delivered":
        print(f"Bot: Order {order_id.upper()} was delivered on {order['delivered_date']}. "
              f"Items: {', '.join(order['items'])}.")
    elif order["status"] == "Shipped":
        print(f"Bot: Order {order_id.upper()} shipped on {order['shipped_date']} via "
              f"{order['carrier']} (tracking: {order['tracking_number']}). "
              f"Estimated arrival: {order['eta']}.")
    else:  # Processing
        print(f"Bot: Order {order_id.upper()} is still being processed and hasn't "
              f"shipped yet. Estimated ship-by / arrival: {order['eta']}.")
    return True


def handle_returns_refund(ask):
    order_id = ask("No problem — what's the order ID you'd like to return? (e.g. N1002): ")
    result = get_return_info(order_id)
    if not result:
        print(f"Bot: I couldn't find order '{order_id.upper()}'. Type 'human' if you "
              f"need help locating it.")
        return False

    order = result["order"]

    if order["status"] != "Delivered":
        print(f"Bot: Order {order_id.upper()} hasn't been delivered yet (status: "
              f"{order['status']}), so it isn't eligible for a return until it "
              f"arrives. You're welcome to cancel instead — type 'human' to do that.")
        return True

    if not is_within_return_window(order):
        print(f"Bot: Sorry, order {order_id.upper()} was delivered on "
              f"{order['delivered_date']} and the {order['return_window_days']}-day "
              f"return window has closed.")
        return True

    refund_days = result["return"]["refund_days"]
    print(f"Bot: Order {order_id.upper()} is eligible for return. I've started the "
          f"return request — once we receive the item, your refund will be "
          f"processed within {refund_days} business days to your original "
          f"payment method.")
    return True


def handle_stock_availability(ask):
    product = ask("What product are you checking? (e.g. Running Shoes): ")
    item = get_stock(product)
    if not item:
        print(f"Bot: I couldn't find '{product}' in the catalog. Check the spelling "
              f"or type 'human' for help.")
        return False

    size = ask("Any specific size/variant you need? (or press Enter to see all): ").strip()

    if size:
        # allow numeric sizes or text variants (colors etc.)
        size_norm = size.lower()
        in_stock_norm = [str(s).lower() for s in item["sizes_in_stock"]]
        if size_norm in in_stock_norm:
            print(f"Bot: Good news — '{size}' is currently in stock for {product.title()}.")
        else:
            restock = item["restock_eta"] or "date to be confirmed"
            print(f"Bot: '{size}' is currently out of stock for {product.title()}. "
                  f"Expected restock: {restock}.")
    else:
        print(f"Bot: {product.title()} — in stock: {item['sizes_in_stock']}; "
              f"out of stock: {item['sizes_out_of_stock'] or 'none'}.")
    return True


def handle_human(ask):
    print("Bot: Got it — I'm escalating this to a human agent. "
          "Someone from the Northstar support team will reach out shortly.")
    return False  # NOT deflected — this is the whole point of tracking it