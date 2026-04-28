type WSMessage = {
  type: string;
  data?: unknown;
};

type Handler = (msg: WSMessage) => void;

let ws: WebSocket | null = null;
const handlers: Set<Handler> = new Set();

export function connectWS(token: string) {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`;

  ws = new WebSocket(url);

  ws.onmessage = (e) => {
    try {
      const msg: WSMessage = JSON.parse(e.data);
      handlers.forEach((h) => h(msg));
    } catch {}
  };

  ws.onclose = () => {
    ws = null;
    // Temporarily disabled auto-reconnect to stop the console spam
    // const t = localStorage.getItem("scb_token");
    // if (t) setTimeout(() => connectWS(t), 3000); 
  };
}

export function disconnectWS() {
  ws?.close();
  ws = null;
}

export function onWSMessage(handler: Handler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}
