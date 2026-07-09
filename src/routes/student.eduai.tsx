import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Send, Bot, User as UserIcon, Globe, AlertCircle, RotateCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { RouteSkeleton } from "@/components/RouteSkeleton";

const REQUEST_TIMEOUT_MS = 30_000;
const SLOW_HINT_MS = 5_000;
const TIMEOUT_MESSAGE = "Something went wrong, please try again.";

export const Route = createFileRoute("/student/eduai")({
  head: () => ({ meta: [{ title: "EduAI Assistant — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: EduAIPage,
});

interface Source { title: string; url: string }
type SearchStatus = "off" | "ok" | "failed" | "unavailable";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  sources?: Source[];
  searchStatus?: SearchStatus;
  error?: boolean;
}

const SUGGESTIONS = [
  "Build a 30-day study roadmap for me",
  "Explain Newton's laws with examples",
  "Latest news about NDA 2 2026 exam",
  "Tips to score high in internals",
  "Career options after B.Tech",
];

function EduAIPage() {
  const maybeUser = useStore((s) => s.user);
  const [course, setCourse] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timedOutRef = useRef(false);

  // Load course context
  useEffect(() => {
    if (!maybeUser) return;
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("student_profiles_detail")
          .select("course")
          .eq("user_id", maybeUser.id)
          .maybeSingle();
        if (active && data?.course) setCourse(data.course);
      } catch (e) { console.warn(e); }
    })();
    return () => { active = false; };
  }, [maybeUser]);

  // Welcome
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        ts: Date.now(),
        content: `Hey! I'm **EduAI** 👋 — your study companion${course ? ` for ${course}` : ""}. Ask me anything academic, and I can pull live web info when you need current facts.`,
      }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streaming]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function send(prompt?: string) {
    const value = (prompt ?? text).trim();
    if (!value || streaming) return;
    setError(null);

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: value, ts: Date.now() };
    const assistantId = crypto.randomUUID();
    const placeholder: Msg = { id: assistantId, role: "assistant", content: "", ts: Date.now() };

    // Build history BEFORE mutating state so we send prior turns only.
    const history = messages
      .filter((m) => m.id !== "welcome" && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: value });

    setMessages((m) => [...m, userMsg, placeholder]);
    setText("");
    setStreaming(true);
    setSlowHint(false);

    const controller = new AbortController();
    abortRef.current = controller;
    timedOutRef.current = false;

    const slowTimer = setTimeout(() => setSlowHint(true), SLOW_HINT_MS);
    const timeoutTimer = setTimeout(() => {
      timedOutRef.current = true;
      console.warn("[eduai] request timed out after", REQUEST_TIMEOUT_MS, "ms");
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      console.log("[eduai] sending request", { turns: history.length });
      const res = await fetch("/api/eduai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, course }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let msg = "The AI service is temporarily unavailable.";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch { /* ignore */ }
        console.error("[eduai] http error", res.status, msg);
        setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, content: msg, error: true } : x));
        setError(msg);
        toast.error(msg);
        return;
      }

      const searchStatus = (res.headers.get("X-EduAI-Search-Status") as SearchStatus | null) ?? "off";
      let sources: Source[] = [];
      const encoded = res.headers.get("X-EduAI-Sources");
      if (encoded) {
        try { sources = JSON.parse(decodeURIComponent(encoded)); } catch { /* ignore */ }
      }

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(chunk, { stream: true });
        setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, content: acc } : x));
      }
      setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, content: acc || "…", sources, searchStatus } : x));
    } catch (e: unknown) {
      const aborted = (e as { name?: string })?.name === "AbortError";
      if (timedOutRef.current) {
        console.error("[eduai] aborted due to timeout");
        setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, content: TIMEOUT_MESSAGE, error: true } : x));
        setError(TIMEOUT_MESSAGE);
        toast.error(TIMEOUT_MESSAGE);
      } else if (aborted) {
        setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, content: x.content || "_Response cancelled._" } : x));
      } else {
        console.error("[eduai] network error", e);
        const msg = "Network error — please check your connection and try again.";
        setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, content: msg, error: true } : x));
        setError(msg);
        toast.error(msg);
      }
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
      setSlowHint(false);
      setStreaming(false);
      abortRef.current = null;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const greeting = useMemo(() => (course ? `Tuned for ${course}` : "Personalised to your profile"), [course]);

  if (!maybeUser) return null;

  return (
    <div className="flex flex-col h-[100dvh] md:h-auto md:min-h-[80vh] pb-2">
      <header className="px-6 pt-10 pb-5 gradient-primary text-primary-foreground rounded-b-[2rem]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 grid place-items-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black leading-tight">EduAI Assistant</h1>
            <p className="text-[11px] opacity-90">{greeting}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl gradient-primary text-primary-foreground grid place-items-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-soft ${
              m.role === "user"
                ? "gradient-primary text-primary-foreground rounded-tr-md whitespace-pre-wrap"
                : m.error
                  ? "bg-destructive/10 border border-destructive/30 text-destructive rounded-tl-md"
                  : "glass-strong rounded-tl-md"
            }`}>
              {m.role === "assistant" ? (
                <>
                  {m.error && (
                    <div className="flex items-center gap-1.5 mb-1 font-bold text-xs">
                      <AlertCircle className="w-3.5 h-3.5" /> Assistant error
                    </div>
                  )}
                  {m.content ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <TypingDots />
                  )}
                  {m.searchStatus === "ok" && m.sources && m.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Live web sources
                      </p>
                      <ol className="mt-1 space-y-0.5 text-[11px] list-decimal ml-4">
                        {m.sources.map((s) => (
                          <li key={s.url}>
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{s.title || s.url}</a>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {(m.searchStatus === "failed" || m.searchStatus === "unavailable") && (
                    <p className="mt-2 text-[10px] text-muted-foreground italic">
                      Live web search is unavailable — answered from static knowledge.
                    </p>
                  )}
                </>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
            {m.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-accent text-primary grid place-items-center shrink-0">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full glass border border-primary/20 hover:bg-accent/40 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && !streaming && (
        <div className="mx-4 mb-2 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-xs p-2 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
          <button onClick={() => send(messages.filter((m) => m.role === "user").slice(-1)[0]?.content)} className="ml-auto inline-flex items-center gap-1 font-bold hover:underline">
            <RotateCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      <div className="px-3 pb-3 pt-2">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-center gap-2 rounded-2xl glass-strong neon-border p-1.5"
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask EduAI anything — I can search the web when needed…"
            className="flex-1 h-11 px-3 bg-transparent outline-none text-sm font-medium"
            disabled={streaming}
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="h-11 px-3 rounded-xl bg-destructive/15 text-destructive font-bold text-xs active:scale-95 transition"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim()}
              className="w-11 h-11 rounded-xl gradient-primary text-primary-foreground grid place-items-center disabled:opacity-50 active:scale-90 transition"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "120ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "240ms" }} />
    </span>
  );
}
