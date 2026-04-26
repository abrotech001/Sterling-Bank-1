import { useState, useEffect } from "react";

type Conversation = { id: number; username: string; email: string; first_name: string; last_name: string };
type Message = { id: number; userId: number; message: string; isFromUser: boolean; createdAt: string };

export default function SupportDesk() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");

  // Helper to grab your JWT token so the Admin Bouncer lets you in
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token"); // Adjust this if you store your token elsewhere
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };
  };

  // 1. Fetch users who have open tickets
  useEffect(() => {
    fetch("/api/admin/support/conversations", { headers: getAuthHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized or Failed");
        return res.json();
      })
      .then((data) => setConversations(data))
      .catch((err) => console.error(err));
  }, []);

  // 2. Fetch the chat history for the selected user (with auto-polling)
  useEffect(() => {
    if (!selectedUser) return;

    const fetchChat = () => {
      fetch(`/api/admin/support/messages/${selectedUser.id}`, { headers: getAuthHeaders() })
        .then((res) => res.json())
        .then((data) => setMessages(data))
        .catch((err) => console.error(err));
    };

    fetchChat(); // Fetch immediately
    const interval = setInterval(fetchChat, 5000); // Poll every 5 seconds for new messages
    
    return () => clearInterval(interval);
  }, [selectedUser]);

  // 3. Send a reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !replyText.trim()) return;

    try {
      const res = await fetch(`/api/admin/support/reply/${selectedUser.id}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: replyText }),
      });

      if (res.ok) {
        // Instantly push the new message to the screen to make it feel fast
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), userId: selectedUser.id, message: replyText, isFromUser: false, createdAt: new Date().toISOString() }
        ]);
        setReplyText(""); 
      } else {
        alert("Failed to send reply. Check console.");
      }
    } catch (error) {
      console.error("Reply error", error);
    }
  };

  return (
    <div className="flex h-[80vh] border rounded-lg overflow-hidden bg-white shadow-sm m-4">
      {/* LEFT SIDEBAR: User List */}
      <div className="w-1/3 border-r bg-gray-50 flex flex-col">
        <div className="p-4 bg-gray-900 text-white font-bold border-b">
          Admin Support Desk
        </div>
        <div className="overflow-y-auto flex-1">
          {conversations.length === 0 && (
            <p className="p-4 text-gray-500 text-sm">No open tickets.</p>
          )}
          {conversations.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className={`w-full text-left p-4 border-b hover:bg-gray-200 transition-colors ${
                selectedUser?.id === user.id ? "bg-blue-50 border-l-4 border-blue-600" : ""
              }`}
            >
              <p className="font-semibold text-gray-800">{user.first_name || user.username}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT MAIN PANEL: Chat Room */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            <div className="p-4 border-b bg-white shadow-sm z-10 flex justify-between items-center">
              <span className="font-bold text-gray-800">Chatting with: @{selectedUser.username}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isFromUser ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[70%] p-3 rounded-xl shadow-sm ${
                      msg.isFromUser 
                        ? "bg-white border text-gray-800 rounded-bl-none" 
                        : "bg-blue-600 text-white rounded-br-none"
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className={`text-[10px] mt-1 text-right ${msg.isFromUser ? "text-gray-400" : "text-blue-200"}`}>
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
                  placeholder="Type your admin reply..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button 
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50">
            <p>Select a user ticket to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}