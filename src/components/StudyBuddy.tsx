import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, Bot, User as UserIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Msg { id: string; role: "user" | "model"; text: string }

const REQUEST_TIMEOUT_MS = 30_000;
const SLOW_HINT_MS = 5_000;
const TIMEOUT_MESSAGE = "Something went wrong, please try again.";

function bumpAiCounter() {
  try {
    const key = `eduai-queries-${new Date().toISOString().slice(0, 10)}`;
    const next = Number(localStorage.getItem(key) ?? 0) + 1;
    localStorage.setItem(key, String(next));
  } catch {}
}

export function StudyBuddy() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { id: "w", role: "model", text: "Namaste! 👋 I'm your **EduAI Study Buddy**. Ask me anything — UP Board, NDA prep, or B.Tech / B.Sc / B.A syllabus doubts." },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, open]);

  async function send(prompt?: string) {
    const value = (prompt ?? text).trim();
    if (!value || loading) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: value };
    const history = messages.filter((m) => m.id !== "w").map((m) => ({
      role: m.role === "user" ? "user" as const : "assistant" as const,
      content: m.text,
    }));
    history.push({ role: "user", content: value });
    setMessages((m) => [...m, userMsg]);
    setText("");
    setLoading(true);
    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, { id: assistantId, role: "model", text: "" }]);
    try {
      const res = await fetch("/api/eduai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "The AI service is unavailable." }));
        setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, text: data.error ?? "Sorry — couldn't reach the AI." } : x));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(chunk, { stream: true });
        setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, text: acc } : x));
      }
      bumpAiCounter();
    } catch {
      setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, text: "Network error — please try again." } : x));
    } finally {
      setLoading(false);
    }
  }


  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-40 bottom-5 right-5 md:bottom-8 md:right-8 group"
          aria-label="Open EduAI Study Buddy"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 blur-xl opacity-60 group-hover:opacity-90 transition" />
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 grid place-items-center shadow-2xl border border-white/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/30 animate-pulse" />
        </button>
      )}

      {open && (
        <div className="fixed z-50 inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:h-[620px] flex flex-col bg-slate-950/95 backdrop-blur-xl border border-white/10 md:rounded-3xl shadow-2xl overflow-hidden text-white">
          <header className="px-4 py-3 flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600">
            <div className="w-9 h-9 rounded-xl bg-white/15 grid place-items-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black">EduAI Study Buddy</p>
              <p className="text-[11px] opacity-80 truncate">Powered by Gemini · always on</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg bg-white/10 grid place-items-center hover:bg-white/20 transition">
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "model" && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 grid place-items-center shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow ${
                  m.role === "user" ? "bg-gradient-to-br from-indigo-500 to-fuchsia-600 rounded-tr-md"
                  : "bg-white/8 border border-white/10 rounded-tl-md"
                }`}>
                  {m.role === "model" ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-strong:text-white prose-headings:text-white">
                      <ReactMarkdown>{m.text}</ReactMarkdown>
                    </div>
                  ) : m.text}
                </div>
                {m.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-white/10 grid place-items-center shrink-0"><UserIcon className="w-3.5 h-3.5" /></div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-600 grid place-items-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white/8 border border-white/10 rounded-2xl rounded-tl-md px-3 py-2 shadow">
                  <p className="text-[12px] font-medium bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent animate-pulse">
                    EduAI soch raha hai…
                  </p>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length <= 1 && (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5">
              {["Explain photosynthesis simply","NDA maths tips","B.Tech DSA roadmap","UP Board Class 12 physics revision"].map((s) => (
                <button key={s} onClick={() => send(s)} disabled={loading}
                  className="text-[10.5px] font-semibold px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  {s}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-white/10 flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question…" disabled={loading}
              className="flex-1 h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-white/40 outline-none focus:border-indigo-400" />
            <button type="submit" disabled={!text.trim() || loading}
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 grid place-items-center disabled:opacity-40 active:scale-95 transition">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
