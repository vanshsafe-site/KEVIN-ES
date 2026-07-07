import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "kevin";
interface Message {
  id: string;
  role: Role;
  text: string;
  error?: boolean;
}

const SUGGESTIONS = [
  "I'm feeling anxious",
  "I had a rough day",
  "I can't sleep",
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function sendToKevin(message: string): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Something went wrong." }));
    throw new Error(err.error || "Something went wrong.");
  }
  const data = (await res.json()) as { reply?: string };
  return data.reply ?? "";
}

export function KevinApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);

  // auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 6.5 * 16) + "px";
  }, [input]);

  // track scroll position
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const onScroll = () => {
      nearBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // auto-scroll on new messages if user was near bottom
  useEffect(() => {
    if (!nearBottomRef.current) return;
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;
      const userMsg: Message = { id: uid(), role: "user", text };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLoading(true);
      nearBottomRef.current = true;
      try {
        const reply = await sendToKevin(text);
        setMessages((m) => [
          ...m,
          { id: uid(), role: "kevin", text: reply || "…" },
        ]);
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : "Kevin couldn't respond right now — try again.";
        setMessages((m) => [
          ...m,
          { id: uid(), role: "kevin", text: msg, error: true },
        ]);
        setInput(text); // repopulate so user doesn't lose their message
      } finally {
        setLoading(false);
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    },
    [loading],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const canSend = input.trim().length > 0 && !loading;

  return (
    <div className="kevin-app">
      <header className="kevin-header">
        <div className="kevin-logo" aria-hidden="true" />
        <div className="kevin-title">
          <strong>K.E.V.I.N</strong>
          <span>Your Emotional Support Companion</span>
        </div>
      </header>

      <main className="kevin-chat" ref={chatRef}>
        <div className="kevin-chat-inner" aria-live="polite">
          {messages.length === 0 ? (
            <div className="kevin-empty">
              <div
                className="kevin-logo"
                aria-hidden="true"
                style={{ width: 72, height: 72 }}
              />
              <h2>Hi, I'm Kevin. What's weighing on you?</h2>
              <p>A space to vent, reflect, or just be heard — no judgment.</p>
              <div className="kevin-chips">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="kevin-chip"
                    onClick={() => void send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`kevin-msg ${m.role}${m.error ? " error" : ""}`}
              >
                {m.text}
              </div>
            ))
          )}
          {loading && (
            <div className="kevin-typing" aria-label="Kevin is typing">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
      </main>

      <form
        className="kevin-inputbar"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="kevin-inputbar-inner">
          <textarea
            ref={textareaRef}
            className="kevin-textarea"
            placeholder="Tell Kevin what's on your mind…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            aria-label="Message Kevin"
          />
          <button
            type="submit"
            className="kevin-send"
            disabled={!canSend}
            aria-label="Send message"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12l16-8-6 16-2-7-8-1z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}