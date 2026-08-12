# Northstar Support Deflection MVP

A one-week prototype built for **Northstar Retail Co.**, a mid-size e-commerce
client whose support team is drowning in three repetitive ticket types. This
MVP deflects those tickets automatically — without a human — and hands off to
one cleanly when the bot can't help.

Built as part of the [Power Learn Project](https://powerlearnproject.org)
Northstar Sprint simulation.

## What it does

Covers all three assessed ticket categories end-to-end:

| Category | Example question | Resolved by |
|---|---|---|
| Order status | "Where is my order?" / "Has this shipped yet?" | Looks up order by ID, returns status, carrier, tracking, ETA |
| Returns & refunds | "How do I return this?" / "When will I get my refund?" | Checks delivery status + return window, starts the return, quotes refund timeline |
| Stock availability | "Is this back in stock?" / "Do you have this in a different size?" | Checks per-size/variant stock, returns restock ETA if unavailable |

When the bot can't resolve the request (or the user asks directly), it
escalates to a human agent instead of dead-ending the conversation.

## Two implementations

This repo contains two working prototypes of the same product, built to
compare a scriptable CLI flow against a customer-facing web experience.

### 1. CLI prototype (`chatbot.py`)

A terminal-based version for fast iteration and demoing the conversation
logic without any frontend dependencies.

```
chatbot.py      - main loop: reads input, classifies intent, dispatches to a handler, logs the interaction
intents.py      - keyword-based intent classifier + numbered-menu fallback for unmatched input
handlers.py     - one function per ticket category (order status, returns, stock, human handoff)
data.py         - mock order/return/stock data
deflection_log.csv - append-only audit log of every interaction (auto-created on first run)
```

Run it:

```bash
pip install -r requirements.txt
python chatbot.py
```

Type a question naturally (e.g. "where is my order N1001") or `human` to
escalate. If nothing matches, you get a numbered menu instead of a dead end.
Type `quit` to exit.

### 2. Web app (React + Flask)

A customer-facing chat widget backed by a small Flask API, for a realistic
support-widget experience.

```
app.py              - Flask API: order lookup, return eligibility/initiation, stock lookup, ticket logging
data.py             - mock order/return/stock data (shared shape with the CLI's data.py)
NorthstarChat.jsx    - React chat UI: sidebar history, quick-topic chips, human-escalation modal
```

**Backend**

```bash
pip install -r requirements.txt
python app.py
```

Serves on `http://localhost:5000`. CORS is enabled for a local React dev
server (default `http://localhost:5173`).

**Frontend**

Drop `NorthstarChat.jsx` into a React app with Tailwind CSS and
`lucide-react` installed, and render it as your root component. It talks to
the API via the `API_BASE` constant at the top of the file — update this if
your backend runs somewhere other than `localhost:5000`.

**Web app features**

- Conversation history sidebar (like a chat app) — start new conversations, revisit old ones, each keeps its own state
- Responsive layout — sidebar collapses to a drawer on mobile, opened via a menu button
- Quick-topic chips for the three ticket categories plus human handoff
- "Talk to a human" opens an in-chat modal collecting name, email, and message, rather than dead-ending the conversation

## API reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/orders/<order_id>` | Order status, items, carrier, ETA |
| GET | `/api/orders/<order_id>/return-eligibility` | Whether an order can be returned, and why not if not |
| POST | `/api/orders/<order_id>/return` | Initiates a return, returns refund timeline |
| GET | `/api/stock/<product>?size=<size>` | Stock availability, optionally for a specific size/variant |
| POST | `/api/tickets` | Logs a resolved or escalated interaction |
| GET | `/api/tickets` | Lists logged interactions + deflected/escalated summary counts |

All interactions — resolved or escalated — are logged to
`deflection_log.csv` with a timestamp, the user's message, the matched
intent, and whether it was deflected. This is the audit trail the pitch to
Northstar leans on.

## Sample data

Try these against either prototype:

- Orders: `N1001`, `N1002`, `N1003`
- Products: `Running Shoes`, `Wireless Headphones`, `Office Chair`

## Known issues / go-live notes

- The CLI (`handlers.py`) and the web API (`app.py`) currently expect
  slightly different function names from `data.py` (`get_return_info` vs
  `get_return_record`) — confirm both point at the same, consistently-named
  module before handing off.
- The web app's human-escalation modal posts to `/api/escalations`, which
  doesn't exist on the backend yet. It currently falls back to logging via
  `/api/tickets` so the demo doesn't break, but a real deployment needs that
  route (writing to a log and/or emailing the support team) before
  escalations actually reach anyone.
- Intent keyword lists differ slightly between the CLI (`intents.py`) and
  the web app's inline classifier — worth consolidating into one shared
  source of truth so both prototypes stay in sync as keywords are tuned.
- Neither prototype currently deduplicates or rate-limits repeat tickets
  from the same user in a session.
- This is an MVP: intent matching is keyword-based, not ML-based, by design
  — see the docstring in `intents.py` for the reasoning (debuggable, easy
  for Northstar's own team to extend without a data science background).

## Tech stack

- **Backend:** Python, Flask, Flask-CORS
- **Frontend:** React, Tailwind CSS, lucide-react
- **Storage:** CSV-based audit log (no database — intentional for MVP scope)

## Team

_Add your pod's names and roles here._
