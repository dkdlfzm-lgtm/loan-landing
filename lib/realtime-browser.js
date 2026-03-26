function buildRealtimeUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !anonKey) return null;
  try {
    const url = new URL(supabaseUrl);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}/realtime/v1/websocket?apikey=${encodeURIComponent(anonKey)}&vsn=1.0.0`;
  } catch {
    return null;
  }
}

export function subscribeSupabaseTable({ table, filter, onChange }) {
  const realtimeUrl = buildRealtimeUrl();
  if (!realtimeUrl || typeof window === "undefined" || typeof WebSocket === "undefined") return () => {};

  let ref = 1;
  let heartbeatTimer = null;
  const topic = `realtime:public:${table}${filter ? `:${filter}` : ""}`;
  const socket = new WebSocket(realtimeUrl);

  const push = (event, payload = {}) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ topic, event, payload, ref: String(ref++) }));
  };

  socket.addEventListener("open", () => {
    push("phx_join", {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: "" },
        postgres_changes: [{ event: "*", schema: "public", table, ...(filter ? { filter } : {}) }],
      },
    });

    heartbeatTimer = window.setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(ref++) }));
    }, 25000);
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.event === "postgres_changes") onChange?.(message.payload);
    } catch {}
  });

  const cleanup = () => {
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (socket.readyState === WebSocket.OPEN) {
      push("phx_leave", {});
    }
    socket.close();
  };

  socket.addEventListener("error", () => {});
  return cleanup;
}
