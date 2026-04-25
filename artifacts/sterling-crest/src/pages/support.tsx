import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { onWSMessage } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";

type Message = {
  id: number;
  userId: number;
  message: string;
  isFromUser: boolean;
  isFromAgent: boolean;
  createdAt: string;
};

export default function SupportPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("prefill");
    if (prefill) {
      setInput(prefill);
      const url = new URL(window.location.href);
      url.searchParams.delete("prefill");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const endSession = async () => {
    setEndingSession(true);
    try {
      await api.delete("/support/messages");
      setMessages([]);
      toast({ title: "Session ended", description: "Your chat history has been cleared." });
      navigate("/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to end session";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setEndingSession(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const data = await api.get<{ messages: Message[] }>("/support/messages");
      setMessages(data.messages);
    } catch {}
  };

  useEffect(() => {
    setLoading(true);
    fetchMessages().finally(() => setLoading(false));
    const unsub = onWSMessage((msg) => {
      if (msg.type === "support_message") fetchMessages();
    });
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      await api.post("/support/message", { message: text });
      await fetchMessages();
    } catch {} finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Live Support</h1>
            <p className="text-muted-foreground">Chat with our support team in real time</p>
          </div>
          {messages.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                  <LogOut className="w-3.5 h-3.5" />
                  End Session
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End support session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently clear your entire chat history with support. The next time you visit, you'll start with a fresh conversation. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={endSession} disabled={endingSession} className="bg-destructive hover:bg-destructive/90">
                    {endingSession ? "Ending..." : "End Session"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="flex-1 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold text-sm">Crestfield Support</div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs text-muted-foreground">Online • Typically replies in minutes</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!loading && messages.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">Start a conversation with our support team</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.isFromUser ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    msg.isFromUser
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-background border border-border rounded-bl-sm"
                  }`}>
                    {!msg.isFromUser && (
                      <div className="text-xs font-semibold text-primary mb-0.5">Support Agent</div>
                    )}
                    <p className="leading-relaxed">{msg.message}</p>
                    <div className={`text-xs mt-1 ${msg.isFromUser ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Type your message..."
                className="flex-1 h-10 text-sm"
                disabled={sending}
              />
              <Button size="icon" className="h-10 w-10 flex-shrink-0" onClick={send} disabled={!input.trim() || sending}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
