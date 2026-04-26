import { useState, useEffect, useRef } from "react";

type Conversation = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
};

type Message = {
  id: number;
  userId: number;
  message: string;
  isFromUser: boolean;
  createdAt: string;
};

const AVATAR_PALETTE = [
  ["#e0f2fe", "#0369a1"],
  ["#fce7f3", "#be185d"],
  ["#d1fae5", "#065f46"],
  ["#ede9fe", "#5b21b6"],
  ["#fef3c7", "#92400e"],
  ["#fee2e2", "#991b1b"],
];
function avatarColor(name: string): [string, string] {
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length] as [string, string];
}

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export default function SupportDesk() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const authHeaders = () => {
    const t = localStorage.getItem("scb_token");
    return { "Content-Type": "application/json", Authorization: t ? `Bearer ${t}` : "" };
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/support/conversations", { headers: authHeaders() })
      .then((r) => { if (r.status === 401) throw new Error("Unauthorized"); return r.json(); })
      .then((d) => setConversations(Array.isArray(d) ? d : d.rows || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const load = () =>
      fetch(`/api/admin/support/messages/${selected.id}`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => setMessages(Array.isArray(d) ? d : d.messages || []))
        .catch(console.error);
    load();
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
  }, [selected]);

  const pick = (u: Conversation) => {
    setSelected(u);
    setMessages([]);
    setDrawerOpen(false);
    setShowChat(true);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !reply.trim() || sending) return;
    const text = reply.trim();
    setReply("");
    setSending(true);
    setMessages((p) => [...p, { id: Date.now(), userId: selected.id, message: text, isFromUser: false, createdAt: new Date().toISOString() }]);
    try {
      const r = await fetch(`/api/admin/support/reply/${selected.id}`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ message: text }),
      });
      if (!r.ok) throw new Error();
    } catch {
      alert("Send failed. Check your session.");
      setReply(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const name = (u: Conversation) => u.first_name ? `${u.first_name} ${u.last_name || ""}`.trim() : u.username;
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Geist', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }

        .sd-root {
          display: flex;
          height: 100dvh;
          background: #f8fafc;
          font-family: 'Geist', sans-serif;
          overflow: hidden;
        }

        /* ── Sidebar ── */
        .sd-sidebar {
          width: 268px;
          flex-shrink: 0;
          background: #fff;
          border-right: 1px solid #eef0f3;
          display: flex;
          flex-direction: column;
        }

        /* ── Main ── */
        .sd-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: #f8fafc;
        }

        /* ── Mobile topbar hidden on desktop ── */
        .sd-topbar { display: none; }

        /* ── Ticket item ── */
        .sd-ticket {
          width: 100%;
          text-align: left;
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 11px 16px;
          display: flex;
          align-items: center;
          gap: 11px;
          border-left: 3px solid transparent;
          transition: background 0.12s, border-color 0.12s;
        }
        .sd-ticket:hover { background: #f8fafc; }
        .sd-ticket.active {
          background: #f1f5f9;
          border-left-color: #0f172a;
        }

        /* ── Message bubble ── */
        .sd-bubble-user {
          background: #fff;
          border: 1px solid #eef0f3;
          border-radius: 4px 14px 14px 14px;
          color: #1e293b;
        }
        .sd-bubble-admin {
          background: #0f172a;
          border-radius: 14px 4px 14px 14px;
          color: #f1f5f9;
        }

        /* ── Input ── */
        .sd-input {
          flex: 1;
          height: 42px;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          padding: 0 14px;
          font-size: 13px;
          font-family: 'Geist', sans-serif;
          color: #1e293b;
          background: #f8fafc;
          outline: none;
          transition: border-color 0.15s;
        }
        .sd-input:focus { border-color: #0f172a; background: #fff; }
        .sd-send {
          width: 42px; height: 42px;
          border-radius: 10px; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s, transform 0.1s;
        }
        .sd-send:active { transform: scale(0.95); }
        .sd-send.ready { background: #0f172a; color: #fff; }
        .sd-send.idle  { background: #f1f5f9; color: #94a3b8; }

        /* ── Skeleton ── */
        .sd-skeleton {
          background: linear-gradient(90deg, #f1f5f9 25%, #e8eef4 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
        }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* ── Mobile ── */
        @media (max-width: 680px) {
          .sd-sidebar {
            position: fixed;
            top: 0; left: 0; bottom: 0;
            z-index: 200;
            transform: translateX(-110%);
            transition: transform 0.24s cubic-bezier(.4,0,.2,1);
            box-shadow: 6px 0 24px rgba(0,0,0,0.08);
            width: min(82vw, 300px);
          }
          .sd-sidebar.open { transform: translateX(0); }
          .sd-overlay { display: block !important; }
          .sd-topbar { display: flex; }
          .sd-chat-hidden { display: none !important; }
          .sd-back { display: flex !important; }
          .sd-email-badge { display: none !important; }
        }
      `}</style>

      <div className="sd-root">

        {/* Mobile overlay */}
        <div
          className="sd-overlay"
          onClick={() => setDrawerOpen(false)}
          style={{
            display: "none", position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.25)", zIndex: 199, backdropFilter: "blur(3px)",
          }}
        />

        {/* ── Sidebar ── */}
        <aside className={`sd-sidebar${drawerOpen ? " open" : ""}`}>
          {/* Brand */}
          <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #eef0f3" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, background: "#0f172a",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
                  <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Support Desk</p>
                <p style={{ fontSize: 11, color: "#94a3b8" }}>Admin Panel</p>
              </div>
            </div>
          </div>

          {/* Section label */}
          <div style={{ padding: "13px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#94a3b8", textTransform: "uppercase" }}>
              Tickets
            </span>
            {!loading && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", background: "#f1f5f9", borderRadius: 20, padding: "2px 7px" }}>
                {conversations.length}
              </span>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                    <div className="sd-skeleton" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="sd-skeleton" style={{ height: 11, width: "55%", marginBottom: 6 }} />
                      <div className="sd-skeleton" style={{ height: 9, width: "75%" }} />
                    </div>
                  </div>
                ))
              : conversations.length === 0
              ? <p style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#94a3b8" }}>No active tickets</p>
              : conversations.map((u) => {
                  const [bg, fg] = avatarColor(u.username);
                  const active = selected?.id === u.id;
                  return (
                    <button key={u.id} className={`sd-ticket${active ? " active" : ""}`} onClick={() => pick(u)}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, background: bg, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: fg,
                      }}>
                        {u.username[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {name(u)}
                        </p>
                        <p style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          @{u.username}
                        </p>
                      </div>
                      {active && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />}
                    </button>
                  );
                })}
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="sd-main">

          {/* Mobile topbar */}
          <div className="sd-topbar" style={{
            padding: "11px 14px", background: "#fff",
            borderBottom: "1px solid #eef0f3",
            alignItems: "center", gap: 10,
          }}>
            {showChat && selected ? (
              <button onClick={() => setShowChat(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#0f172a", padding: 4 }}>
                <BackIcon />
              </button>
            ) : (
              <button onClick={() => setDrawerOpen(true)} style={{ border: "none", background: "none", cursor: "pointer", color: "#0f172a", padding: 4 }}>
                <MenuIcon />
              </button>
            )}
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
              {selected && showChat ? name(selected) : "Support Desk"}
            </p>
          </div>

          {/* Empty state or chat */}
          {!selected || (!showChat && window.innerWidth <= 680) ? (
            <div className={selected ? "sd-chat-hidden" : ""} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 14,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: "#f1f5f9",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>No conversation selected</p>
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Pick a ticket from the sidebar</p>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {/* Chat header */}
              {selected && (() => {
                const [bg, fg] = avatarColor(selected.username);
                return (
                  <div style={{
                    padding: "13px 20px", background: "#fff",
                    borderBottom: "1px solid #eef0f3",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, background: bg, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 700, color: fg,
                    }}>
                      {selected.username[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{name(selected)}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                        <span style={{ fontSize: 11, color: "#64748b" }}>Active · @{selected.username}</span>
                      </div>
                    </div>
                    <div className="sd-email-badge" style={{
                      fontSize: 11, fontWeight: 500, color: "#475569",
                      background: "#f1f5f9", borderRadius: 8, padding: "4px 10px", flexShrink: 0,
                    }}>
                      {selected.email}
                    </div>
                  </div>
                );
              })()}

              {/* Messages */}
              <div ref={scrollRef} style={{
                flex: 1, overflowY: "auto", padding: "20px 20px 12px",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                {messages.length === 0 && (
                  <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, marginTop: 32 }}>
                    No messages yet — start the conversation.
                  </p>
                )}
                {messages.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: m.isFromUser ? "flex-start" : "flex-end" }}>
                    <div
                      className={m.isFromUser ? "sd-bubble-user" : "sd-bubble-admin"}
                      style={{ maxWidth: "68%", padding: "9px 13px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                    >
                      {!m.isFromUser && (
                        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>
                          Admin
                        </p>
                      )}
                      <p style={{ fontSize: 13, lineHeight: 1.55 }}>{m.message}</p>
                      <p style={{
                        fontSize: 10, textAlign: "right", marginTop: 4,
                        color: m.isFromUser ? "#94a3b8" : "rgba(241,245,249,0.5)",
                      }}>
                        {time(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply bar */}
              <div style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #eef0f3" }}>
                <form onSubmit={send} style={{ display: "flex", gap: 9, alignItems: "center" }}>
                  <input
                    ref={inputRef}
                    className="sd-input"
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={`Reply to ${selected?.first_name || selected?.username || "user"}…`}
                    disabled={sending}
                  />
                  <button type="submit" className={`sd-send ${reply.trim() && !sending ? "ready" : "idle"}`} disabled={!reply.trim() || sending}>
                    <SendIcon />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
