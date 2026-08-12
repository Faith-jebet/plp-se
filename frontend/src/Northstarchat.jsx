import { useState, useRef, useEffect } from "react";
import {
  Package,
  Truck,
  RotateCcw,
  Search,
  UserRound,
  Send,
  CircleCheck,
  Plus,
  Menu,
  X,
  MessageSquare,
  Mail,
} from "lucide-react";

// Point this at your Flask backend. Override via env var in a real build setup.
const API_BASE = "http://localhost:5000/api";

// ---------------------------------------------------------------------------
// Intent matching (client-side only - the actual data now lives in Flask)
// ---------------------------------------------------------------------------
const INTENT_KEYWORDS = {
  order_status: ["where is my order", "track", "tracking", "shipped", "order status", "arrive", "delivery"],
  returns_refund: ["return", "refund", "money back", "exchange", "cancel my order"],
  stock_availability: ["in stock", "back in stock", "available", "different size", "do you have", "restock", "sold out"],
  human: ["human", "agent", "representative", "real person"],
};

function classify(text) {
  const t = text.toLowerCase();
  for (const [intent, phrases] of Object.entries(INTENT_KEYWORDS)) {
    if (phrases.some((p) => t.includes(p))) return intent;
  }
  return null;
}

const CATEGORIES = [
  { key: "order_status", label: "Track an order", icon: Truck },
  { key: "returns_refund", label: "Return or refund", icon: RotateCcw },
  { key: "stock_availability", label: "Check stock", icon: Search },
  { key: "human", label: "Talk to a human", icon: UserRound },
];

let idCounter = 0;
const nextId = () => ++idCounter;

const WELCOME_MESSAGE = {
  id: nextId(),
  sender: "bot",
  text: "Hi, I'm the Northstar support bot. I can help with order status, returns and refunds, or stock availability. What do you need?",
};

function makeThread() {
  return {
    id: nextId(),
    title: "New conversation",
    createdAt: Date.now(),
    messages: [{ ...WELCOME_MESSAGE, id: nextId() }],
    awaiting: null,
    pendingProduct: null,
  };
}

function threadPreview(thread) {
  const lastUser = [...thread.messages].reverse().find((m) => m.sender === "user");
  return lastUser ? lastUser.text : "No messages yet";
}

export default function NorthstarChat() {
  const [threads, setThreads] = useState(() => [makeThread()]);
  const [activeId, setActiveId] = useState(() => threads[0]?.id);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [deflected, setDeflected] = useState(0);
  const [escalated, setEscalated] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [humanModal, setHumanModal] = useState({ open: false, threadId: null });
  const [humanForm, setHumanForm] = useState({ name: "", email: "", message: "" });
  const [humanFormErrors, setHumanFormErrors] = useState({});
  const [humanSubmitting, setHumanSubmitting] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const humanNameRef = useRef(null);

  const activeThread = threads.find((t) => t.id === activeId) ?? threads[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages, isBusy, activeId]);

  useEffect(() => {
    refreshSummary();
  }, []);

  useEffect(() => {
    if (humanModal.open) {
      const t = setTimeout(() => humanNameRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [humanModal.open]);

  // ---- thread-scoped helpers -------------------------------------------
  function patchThread(id, patch) {
    setThreads((ts) => ts.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
  }

  function addBot(text, threadId = activeId) {
    patchThread(threadId, (t) => ({ messages: [...t.messages, { id: nextId(), sender: "bot", text }] }));
  }

  function addUser(text, threadId = activeId) {
    patchThread(threadId, (t) => ({
      messages: [...t.messages, { id: nextId(), sender: "user", text }],
      title: t.title === "New conversation" ? text.slice(0, 42) + (text.length > 42 ? "…" : "") : t.title,
    }));
  }

  function setAwaiting(value, threadId = activeId) {
    patchThread(threadId, { awaiting: value });
  }

  function setPendingProduct(value, threadId = activeId) {
    patchThread(threadId, { pendingProduct: value });
  }

  function startNewChat() {
    const t = makeThread();
    setThreads((ts) => [t, ...ts]);
    setActiveId(t.id);
    setSidebarOpen(false);
    setInput("");
    inputRef.current?.focus();
  }

  // ---- backend calls ------------------------------------------------------
  async function refreshSummary() {
    try {
      const res = await fetch(`${API_BASE}/tickets`);
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      setDeflected(data.summary.deflected);
      setEscalated(data.summary.escalated);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }

  async function logTicket(userMessage, intent, wasDeflected) {
    try {
      await fetch(`${API_BASE}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_message: userMessage, intent, deflected: wasDeflected }),
      });
      refreshSummary();
    } catch {
      setOffline(true);
      if (wasDeflected) setDeflected((n) => n + 1);
      else setEscalated((n) => n + 1);
    }
  }

  function connectionErrorMessage(threadId) {
    addBot(
      "I can't reach the Northstar systems right now. Make sure the Flask backend is running on http://localhost:5000, then try again.",
      threadId
    );
  }

  function startOrderStatus(threadId) {
    addBot("Sure, what's your order ID? (try N1001, N1002, or N1003)", threadId);
    setAwaiting("order_id", threadId);
  }
  function startReturn(threadId) {
    addBot("What's the order ID you'd like to return? (try N1001 or N1002)", threadId);
    setAwaiting("return_id", threadId);
  }
  function startStock(threadId) {
    addBot("Which product are you checking? (try Running Shoes, Wireless Headphones, or Office Chair)", threadId);
    setAwaiting("stock_product", threadId);
  }
  function startHuman(threadId) {
    setHumanForm({ name: "", email: "", message: "" });
    setHumanFormErrors({});
    setHumanModal({ open: true, threadId });
  }

  function closeHumanModal() {
    setHumanModal({ open: false, threadId: null });
  }

  function handleHumanFormChange(field, value) {
    setHumanForm((f) => ({ ...f, [field]: value }));
    if (humanFormErrors[field]) {
      setHumanFormErrors((e) => ({ ...e, [field]: undefined }));
    }
  }

  async function submitHumanForm() {
    const errors = {};
    if (!humanForm.name.trim()) errors.name = "Enter your name";
    if (!humanForm.email.trim()) {
      errors.email = "Enter your email";
    } else if (!/^\S+@\S+\.\S+$/.test(humanForm.email.trim())) {
      errors.email = "Enter a valid email";
    }
    if (!humanForm.message.trim()) errors.message = "Tell us what you need help with";

    if (Object.keys(errors).length > 0) {
      setHumanFormErrors(errors);
      return;
    }

    const threadId = humanModal.threadId ?? activeId;
    setHumanSubmitting(true);
    try {
      await fetch(`${API_BASE}/escalations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(humanForm),
      });
    } catch {
      // Backend may not have this route yet - still confirm to the user below,
      // the interaction is also logged via /api/tickets as a fallback record.
    } finally {
      setHumanSubmitting(false);
    }

    addBot(
      `Thanks ${humanForm.name.split(" ")[0]}, I've passed this to a human agent. They'll follow up at ${humanForm.email} shortly.`,
      threadId
    );
    logTicket(humanForm.message, "human", false);
    closeHumanModal();
  }

  async function resolveOrderId(text, threadId) {
    const id = text.trim().toUpperCase();
    setIsBusy(true);
    try {
      const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}`);
      if (res.status === 404) {
        addBot(`I couldn't find order ${id}. Double check the ID, or ask to talk to a human.`, threadId);
        logTicket(text, "order_status", false);
        return;
      }
      if (!res.ok) throw new Error("request failed");
      const order = await res.json();

      if (order.status === "Delivered") {
        addBot(`Order ${id} was delivered on ${order.delivered_date}. Items: ${order.items.join(", ")}.`, threadId);
      } else if (order.status === "Shipped") {
        addBot(
          `Order ${id} shipped on ${order.shipped_date} via ${order.carrier} (tracking ${order.tracking_number}). Estimated arrival: ${order.eta}.`,
          threadId
        );
      } else {
        addBot(`Order ${id} is still processing and hasn't shipped yet. Estimated ship-by: ${order.eta}.`, threadId);
      }
      logTicket(text, "order_status", true);
    } catch {
      connectionErrorMessage(threadId);
    } finally {
      setIsBusy(false);
      setAwaiting(null, threadId);
    }
  }

  async function resolveReturnId(text, threadId) {
    const id = text.trim().toUpperCase();
    setIsBusy(true);
    try {
      const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}/return-eligibility`);
      if (res.status === 404) {
        addBot(`I couldn't find order ${id}. Ask to talk to a human if you need help locating it.`, threadId);
        logTicket(text, "returns_refund", false);
        return;
      }
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();

      if (!data.eligible) {
        addBot(data.reason, threadId);
        logTicket(text, "returns_refund", true);
        return;
      }

      const initRes = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}/return`, { method: "POST" });
      if (!initRes.ok) throw new Error("request failed");
      const initData = await initRes.json();
      addBot(
        `Order ${id} is eligible for return. I've started the request, once we receive the item your refund goes out within ${initData.refund_days} business days.`,
        threadId
      );
      logTicket(text, "returns_refund", true);
    } catch {
      connectionErrorMessage(threadId);
    } finally {
      setIsBusy(false);
      setAwaiting(null, threadId);
    }
  }

  async function resolveStockProduct(text, threadId) {
    const key = text.trim().toLowerCase();
    setIsBusy(true);
    try {
      const res = await fetch(`${API_BASE}/stock/${encodeURIComponent(key)}`);
      if (res.status === 404) {
        addBot(`I couldn't find "${text}" in the catalog. Check the spelling, or ask to talk to a human.`, threadId);
        logTicket(text, "stock_availability", false);
        setAwaiting(null, threadId);
        return;
      }
      if (!res.ok) throw new Error("request failed");
      const item = await res.json();
      setPendingProduct({ key }, threadId);
      addBot(`Any specific size or variant? (in stock: ${item.sizes_in_stock.join(", ")})`, threadId);
      setAwaiting("stock_size", threadId);
    } catch {
      connectionErrorMessage(threadId);
      setAwaiting(null, threadId);
    } finally {
      setIsBusy(false);
    }
  }

  async function resolveStockSize(text, threadId, item) {
    setIsBusy(true);
    try {
      const res = await fetch(`${API_BASE}/stock/${encodeURIComponent(item.key)}?size=${encodeURIComponent(text.trim())}`);
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();

      if (data.in_stock) {
        addBot(`Good news, "${text}" is currently in stock for ${item.key}.`, threadId);
      } else {
        addBot(`"${text}" is out of stock for ${item.key} right now. Expected restock: ${data.restock_eta || "date to be confirmed"}.`, threadId);
      }
      logTicket(text, "stock_availability", true);
    } catch {
      connectionErrorMessage(threadId);
    } finally {
      setIsBusy(false);
      setAwaiting(null, threadId);
      setPendingProduct(null, threadId);
    }
  }

  function handleSend(rawText) {
    const text = (rawText ?? input).trim();
    const threadId = activeId;
    const thread = activeThread;
    if (!text || isBusy || !thread) return;
    addUser(text, threadId);
    setInput("");

    if (thread.awaiting === "order_id") return resolveOrderId(text, threadId);
    if (thread.awaiting === "return_id") return resolveReturnId(text, threadId);
    if (thread.awaiting === "stock_product") return resolveStockProduct(text, threadId);
    if (thread.awaiting === "stock_size") return resolveStockSize(text, threadId, thread.pendingProduct);

    const intent = classify(text);
    if (intent === "order_status") return startOrderStatus(threadId);
    if (intent === "returns_refund") return startReturn(threadId);
    if (intent === "stock_availability") return startStock(threadId);
    if (intent === "human") return startHuman(threadId);

    addBot("I didn't quite catch that. Pick a topic below and I'll take it from there.", threadId);
  }

  function handleCategoryClick(key) {
    if (isBusy) return;
    const threadId = activeId;
    if (key === "order_status") return startOrderStatus(threadId);
    if (key === "returns_refund") return startReturn(threadId);
    if (key === "stock_availability") return startStock(threadId);
    if (key === "human") return startHuman(threadId);
  }

  function selectThread(id) {
    setActiveId(id);
    setSidebarOpen(false);
  }

  return (
    <div className="relative flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 shrink-0 bg-slate-900 text-slate-200 flex flex-col transform transition-transform duration-200 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-amber-400" />
            <span className="font-mono text-sm tracking-wide">NORTHSTAR</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-3 pt-3">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 rounded-lg border border-slate-600 hover:bg-slate-800 text-sm px-3 py-2 transition-colors"
          >
            <Plus size={16} />
            New chat
          </button>
        </div>

        <div className="flex gap-2 px-3 py-3">
          <span className="flex-1 flex items-center justify-center gap-1 bg-amber-400 text-amber-950 text-xs font-mono px-2 py-1.5 rounded-lg">
            <CircleCheck size={13} />
            {deflected}
          </span>
          <span className="flex-1 flex items-center justify-center gap-1 bg-slate-700 text-slate-200 text-xs font-mono px-2 py-1.5 rounded-lg">
            <UserRound size={13} />
            {escalated}
          </span>
        </div>
        {offline && (
          <p className="text-xs text-amber-400/80 px-4 pb-2 -mt-1">Backend offline</p>
        )}

        <p className="px-4 pt-2 pb-1 text-xs uppercase tracking-wide text-slate-500">History</p>
        <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-3">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => selectThread(t.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm flex gap-2 items-start transition-colors
              ${t.id === activeId ? "bg-slate-800 border-l-4 border-amber-500" : "hover:bg-slate-800/60 border-l-4 border-transparent"}`}
            >
              <MessageSquare size={14} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="block truncate text-slate-100">{t.title}</span>
                <span className="block truncate text-xs text-slate-500">{threadPreview(t)}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-slate-900 text-white px-4 py-3 flex items-center gap-3 border-b-4 border-amber-500 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-slate-300 hover:text-white"
            aria-label="Open history"
          >
            <Menu size={22} />
          </button>
          <div className="min-w-0">
            <p className="font-mono text-sm tracking-wide leading-tight truncate">{activeThread?.title ?? "Northstar Support"}</p>
            <p className="text-xs text-slate-400 leading-tight">Deflection MVP - v0.3</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl w-full mx-auto">
          {activeThread?.messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
              {m.sender === "bot" && (
                <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center mr-2 shrink-0">
                  <Package size={16} />
                </div>
              )}
              <div
                className={
                  m.sender === "user"
                    ? "bg-indigo-600 text-white rounded-lg px-3 py-2 max-w-xs text-sm"
                    : "bg-white border-l-4 border-amber-500 rounded-lg px-3 py-2 max-w-sm text-sm text-slate-800 shadow-sm"
                }
              >
                {m.text}
              </div>
            </div>
          ))}
          {isBusy && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center mr-2 shrink-0">
                <Package size={16} />
              </div>
              <div className="bg-white border-l-4 border-amber-500 rounded-lg px-3 py-2 text-sm text-slate-400 shadow-sm">
                Checking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </main>

        <div className="max-w-2xl w-full mx-auto px-4 shrink-0">
          <div className="flex flex-wrap gap-2 pb-2">
            {CATEGORIES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleCategoryClick(key)}
                disabled={isBusy}
                className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3 shrink-0">
          <div className="max-w-2xl w-full mx-auto flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your question..."
              disabled={isBusy}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={isBusy}
              className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-1 hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send size={16} />
              Send
            </button>
          </div>
        </div>
      </div>

      {humanModal.open && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeHumanModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-900">
              <div className="flex items-center gap-2 text-white">
                <UserRound size={18} className="text-amber-400" />
                <span className="font-mono text-sm">Talk to a human</span>
              </div>
              <button
                onClick={closeHumanModal}
                className="text-slate-400 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-4 space-y-3">
              <p className="text-sm text-slate-600">
                Leave your details and a message, a Northstar agent will follow up by email.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <input
                  ref={humanNameRef}
                  value={humanForm.name}
                  onChange={(e) => handleHumanFormChange("name", e.target.value)}
                  placeholder="Jane Doe"
                  disabled={humanSubmitting}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                />
                {humanFormErrors.name && (
                  <p className="text-xs text-red-600 mt-1">{humanFormErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={humanForm.email}
                    onChange={(e) => handleHumanFormChange("email", e.target.value)}
                    placeholder="jane@example.com"
                    disabled={humanSubmitting}
                    className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                  />
                </div>
                {humanFormErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{humanFormErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Message</label>
                <textarea
                  value={humanForm.message}
                  onChange={(e) => handleHumanFormChange("message", e.target.value)}
                  placeholder="What do you need help with?"
                  rows={3}
                  disabled={humanSubmitting}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                />
                {humanFormErrors.message && (
                  <p className="text-xs text-red-600 mt-1">{humanFormErrors.message}</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 px-4 py-3 border-t border-slate-200">
              <button
                onClick={closeHumanModal}
                disabled={humanSubmitting}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitHumanForm}
                disabled={humanSubmitting}
                className="flex-1 bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {humanSubmitting ? "Sending..." : "Send to agent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}