import { useState, useEffect, useRef } from "react";

type Conversation = { id: number; username: string; email: string; first_name: string; last_name: string };
type Message = { id: number; userId: number; message: string; isFromUser: boolean; createdAt: string };

export default function SupportDesk() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. FIXED: Now using the exact SCB key from your auth system
  const getAuthHeaders = () => {
    const token = localStorage.getItem("scb_token"); 
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : "",
    };
  };

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 2. Fetch active conversations
  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/support/conversations", { headers: getAuthHeaders() })
      .then((res) => {
        if (res.status === 401) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => setConversations(Array.isArray(data) ? data : data.rows || []))
      .catch((err) => console.error("Sidebar Error:", err))
      .finally(() => setLoading(false));
  }, []);

  // 3. Fetch chat history (Auto-polls every 4 seconds)
  useEffect(() => {
    if (!selectedUser) return;
    const fetchChat = () => {
      fetch(`/api/admin/support/messages/${selectedUser.id}`, { headers: getAuthHeaders() })
        .then((res) => res.json())
        .then((data) => setMessages(Array.isArray(data) ? data : data.messages || []))
        .catch((err) => console.error("Chat Error:", err));
    };
    fetchChat();
    const interval = setInterval(fetchChat, 4000);
    return () => clearInterval(interval);
  }, [selectedUser]);

  // 4. Send Admin Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !replyText.trim()) return;

    const currentText = replyText;
    setReplyText(""); 

    try {
      const res = await fetch(`/api/admin/support/reply/${selectedUser.id}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: currentText }),
      });
      if (!res.ok) throw new Error("Send failed");
      
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), userId: selectedUser.id, message: currentText, isFromUser: false, createdAt: new Date().toISOString() }
      ]);
    } catch (error) {
      alert("Failed to send. Check if you are still logged in as Admin.");
      setReplyText(currentText);
    }
  };

  return (
    <div className="flex h-[85vh] border rounded-xl overflow-hidden bg-white shadow-2xl m-6">
      {/* Sidebar */}
      <div className="w-80 border-r bg-slate-50 flex flex-col">
        <div className="p-5 bg-slate-900 text-white font-bold shadow-md">Support Desk</div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-10 text-center animate-pulse text-slate-400">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">No active tickets found.</div>
          ) : (
            conversations.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full text-left p-4 border-b transition-colors ${
                  selectedUser?.id === user.id ? "bg-white border-l-4 border-blue-500 shadow-inner" : "hover:bg-slate-100"
                }`}
              >
                <p className="font-bold text-slate-800">@{user.username}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-100">
        {selectedUser ? (
          <>
            <div className="p-4 bg-white border-b flex items-center shadow-sm">
              <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                {selectedUser.username[0].toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-800">{selectedUser.first_name || selectedUser.username}</p>
                <p className="text-xs text-green-500">Active Support Session</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isFromUser ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[70%] p-3.5 rounded-2xl text-sm shadow-sm ${
                    msg.isFromUser 
                      ? "bg-white text-slate-800 rounded-bl-none border" 
                      : "bg-blue-600 text-white rounded-br-none"
                  }`}>
                    <p>{msg.message}</p>
                    <p className="text-[10px] mt-1 opacity-60 text-right">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t">
              <form onSubmit={handleSendReply} className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 bg-slate-50 border rounded-full px-5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <button type="submit" className="bg-blue-600 text-white px-8 py-2.5 rounded-full font-bold hover:bg-blue-700 active:scale-95 transition-all">
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="text-4xl mb-2">💬</div>
            <p>Select a user to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
