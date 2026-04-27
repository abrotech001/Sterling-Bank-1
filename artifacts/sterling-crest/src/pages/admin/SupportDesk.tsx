import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageSquare, ArrowLeft, UserCircle2, Mail, CircleDot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

// Avatar Color Logic
const AVATAR_PALETTE = [
  ["bg-sky-100", "text-sky-700"],
  ["bg-pink-100", "text-pink-700"],
  ["bg-emerald-100", "text-emerald-700"],
  ["bg-violet-100", "text-violet-700"],
  ["bg-amber-100", "text-amber-700"],
  ["bg-rose-100", "text-rose-700"],
];
function getAvatarColor(name: string): [string, string] {
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length] as [string, string];
}

export default function SupportDesk() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const authHeaders = () => {
    const t = localStorage.getItem("scb_token");
    return { "Content-Type": "application/json", Authorization: t ? `Bearer ${t}` : "" };
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Fetch Users
  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/support/conversations", { headers: authHeaders() })
      .then((r) => {
        if (r.status === 401) throw new Error("Unauthorized");
        return r.json();
      })
      .then((d) => setConversations(Array.isArray(d) ? d : d.rows || []))
      .catch((err) => console.error("Failed to load conversations", err))
      .finally(() => setLoading(false));
  }, []);

  // Fetch Chat History & Poll
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
  };

  const send = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selected || !reply.trim() || sending) return;
    
    const text = reply.trim();
    setReply("");
    setSending(true);
    
    // Optimistic Update
    setMessages((p) => [
      ...p,
      { id: Date.now(), userId: selected.id, message: text, isFromUser: false, createdAt: new Date().toISOString() },
    ]);
    
    try {
      const r = await fetch(`/api/admin/support/reply/${selected.id}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message: text }),
      });
      if (!r.ok) throw new Error();
    } catch {
      alert("Send failed. Please check your admin session.");
      setReply(text); // Put text back on failure
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const formatName = (u: Conversation) => u.first_name ? `${u.first_name} ${u.last_name || ""}`.trim() : u.username;
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    // Fixed container: dynamic viewport height (dvh) for mobile, full width on mobile, rounded with margin on desktop
    <div className="flex h-[calc(100dvh-4rem)] md:h-[calc(100vh-8rem)] w-full md:w-auto md:border border-border md:rounded-2xl overflow-hidden bg-card md:shadow-lg md:m-4">
      
      {/* --- LEFT SIDEBAR --- */}
      <div className={`flex-col w-full md:w-80 md:min-w-[320px] border-r border-border bg-muted/10 ${selected ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm shrink-0">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Support Desk</h2>
              <p className="text-xs text-muted-foreground">Admin Command Center</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-b border-border/50 bg-card/50 shrink-0">
          <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Active Tickets
          </span>
          {!loading && (
            <span className="text-xs font-semibold bg-muted text-foreground px-2 py-0.5 rounded-full">
              {conversations.length}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 items-center animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-2 bg-muted rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center space-y-3">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <p className="text-sm">No active support tickets.</p>
            </div>
          ) : (
            conversations.map((u) => {
              const [bgClass, textClass] = getAvatarColor(u.username);
              const isActive = selected?.id === u.id;
              
              return (
                <button
                  key={u.id}
                  onClick={() => pick(u)}
                  className={`w-full text-left p-4 flex items-center gap-3 transition-colors border-l-4 ${
                    isActive 
                      ? "bg-muted/50 border-primary" 
                      : "border-transparent hover:bg-muted/30"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${bgClass} ${textClass}`}>
                    {u.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{formatName(u)}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                  {isActive && <CircleDot className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* --- RIGHT MAIN PANEL --- */}
      <div className={`flex-1 flex-col bg-background ${!selected ? "hidden md:flex" : "flex"}`}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 opacity-50" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Select a conversation</h3>
              <p className="text-sm mt-1">Pick a ticket from the sidebar to start replying.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header - FIXED FOR MOBILE */}
            <div className="flex items-center gap-3 px-3 py-3 md:px-4 border-b border-border bg-card shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden shrink-0 h-9 w-9 -ml-1" 
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${getAvatarColor(selected.username)[0]} ${getAvatarColor(selected.username)[1]}`}>
                {selected.username[0].toUpperCase()}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground text-sm truncate">{formatName(selected)}</p>
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] uppercase tracking-wider font-semibold">Online</span>
                </div>
                {/* Fixed truncation logic here to prevent squishing */}
                <div className="flex items-center gap-2 md:gap-3 text-xs text-muted-foreground mt-0.5 overflow-hidden">
                  <span className="flex items-center gap-1 shrink-0"><UserCircle2 className="w-3 h-3"/><span className="truncate max-w-[80px] md:max-w-none">@{selected.username}</span></span>
                  <span className="flex items-center gap-1 min-w-0"><Mail className="w-3 h-3"/><span className="truncate">{selected.email}</span></span>
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              )}
              
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.isFromUser ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-sm break-words ${
                      m.isFromUser
                        ? "bg-card border border-border text-foreground rounded-bl-sm"
                        : "bg-primary text-primary-foreground rounded-br-sm"
                    }`}>
                      {!m.isFromUser && (
                        <div className="text-[10px] font-bold text-primary-foreground/70 uppercase tracking-wider mb-1">
                          Admin Reply
                        </div>
                      )}
                      <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                      <div className={`text-[10px] mt-1.5 text-right ${m.isFromUser ? "text-muted-foreground" : "text-primary-foreground/60"}`}>
                        {formatTime(m.createdAt)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={scrollRef} className="h-1 shrink-0" />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-card border-t border-border shrink-0 pb-safe">
              <form 
                onSubmit={send} 
                className="flex items-center gap-2 bg-muted/30 border border-border rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-primary/20 transition-all"
              >
                <Input
                  ref={inputRef}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a reply..."
                  disabled={sending}
                  className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-3 h-10"
                />
                <Button 
                  type="submit" 
                  size="icon"
                  disabled={!reply.trim() || sending}
                  className="shrink-0 h-10 w-10 rounded-lg transition-transform active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
      
    </div>
  );
}
