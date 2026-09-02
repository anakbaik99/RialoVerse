"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

function parseAction(text) {
  const match = text.match(/\[ACTION:(\w+)(?::([^\]]+))?\]/);
  if (!match) return { cleanText: text, action: null };
  const cleanText = text.replace(match[0], "").trim();
  const type = match[1];
  const paramsStr = match[2] || "";
  const params = {};
  paramsStr.split(",").forEach((p) => {
    const [k, v] = p.split("=");
    if (k && v) params[k.trim()] = v.trim();
  });
  return { cleanText, action: { type, params } };
}

export default function ComiPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm COMI 🤖, your RialoVerse assistant. Ask me about swapping, the faucet, or anything else!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/comi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((m) => [...m, { role: "assistant", content: "Sorry, something went wrong: " + data.error }]);
      } else {
        const { cleanText, action } = parseAction(data.text);
        setMessages((m) => [...m, { role: "assistant", content: cleanText, action }]);
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleActionClick(action) {
    if (action.type === "SWAP") {
      const dir = action.params.direction || "ETH_TO_RIALO";
      const amount = action.params.amount || "";
      router.push(`/swap?direction=${dir}&amount=${amount}`);
    } else if (action.type === "CLAIM") {
      router.push("/faucet");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f5f4ff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#fff", borderBottom: "1px solid #eee" }}>
        <a href="/" style={{ textDecoration: "none", color: "#6d28d9", fontWeight: 700 }}>← RialoVerse</a>
        <h2 style={{ margin: 0, fontSize: 18 }}>🤖 COMI</h2>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: "10px 14px", borderRadius: 16,
              background: m.role === "user" ? "#6d28d9" : "#fff",
              color: m.role === "user" ? "#fff" : "#222",
              fontSize: 14, lineHeight: 1.4,
              boxShadow: m.role === "assistant" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
            }}>
              {m.content}
              {m.action && (
                <button
                  onClick={() => handleActionClick(m.action)}
                  style={{ display: "block", marginTop: 8, padding: "8px 14px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  {m.action.type === "SWAP" ? "Open in Swap →" : "Open Faucet →"}
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 14px", borderRadius: 16, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", fontSize: 14, color: "#999" }}>
              COMI is typing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: 12, background: "#fff", borderTop: "1px solid #eee" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
          placeholder="Ask COMI anything..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", fontSize: 14, outline: "none" }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: "#6d28d9", color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
        >
          Send
        </button>
      </div>
    </main>
  );
}
