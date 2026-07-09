import { createFileRoute } from "@tanstack/react-router";
import { shouldSearchWeb, webSearch, type WebSearchResult } from "@/lib/web-search.server";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages?: ChatMessage[];
  course?: string;
}

const BASE_SYSTEM_PROMPT = `You are "EduAI", a warm, patient, expert tutor and study companion for Indian students.

Focus areas: UP Board (Class 9–12), NDA written exam prep (Maths, GAT, English, GK), and university-level curriculum (B.Sc, B.Tech, B.A). You also help with general study skills, careers, and daily productivity.

Response style:
- Reply in clean markdown. Use short paragraphs, bullet lists, numbered steps, and headings when useful.
- For problems, show step-by-step working before the final answer.
- Be honest about uncertainty. Do NOT invent facts, statistics, dates, laws, or citations. If you are not sure, say so.
- Prefer conversational tone. Ask a short clarifying question when the request is ambiguous, but keep momentum — answer what you can and confirm with the user.
- Support follow-up questions naturally by using earlier conversation context.
- Default to English; mirror Hinglish only if the student uses it.
- Keep answers focused (~400 words) unless deep detail is explicitly requested.

If the user asks about live/current events, news, prices, scores, or anything time-sensitive, and no fresh web context has been attached to this turn, tell them briefly that live web search is unavailable right now and answer with your best static knowledge, clearly labeling anything that may be out of date.`;

function buildSearchAugmentedSystem(results: WebSearchResult[]) {
  const bullets = results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nExcerpt: ${r.snippet}`)
    .join("\n\n");
  return `${BASE_SYSTEM_PROMPT}

---
Fresh web results were fetched for the user's latest question. Use them as your primary evidence, synthesize a clear answer in your own words (do NOT paste raw excerpts), and cite each source inline as [1], [2], etc. matching the list below. End your answer with a "**Sources**" section listing each cited item as a markdown link.

${bullets}`;
}

export const Route = createFileRoute("/api/eduai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: ChatRequestBody;
        try { body = (await request.json()) as ChatRequestBody; }
        catch { return json({ error: "Invalid JSON body" }, 400); }

        const messages = Array.isArray(body.messages) ? body.messages.filter((m) => m && typeof m.content === "string") : [];
        if (messages.length === 0) return json({ error: "messages[] required" }, 400);
        const last = messages[messages.length - 1];
        if (last.role !== "user") return json({ error: "last message must be from user" }, 400);
        if (last.content.length > 4000) return json({ error: "prompt too long" }, 400);

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return json({ error: "AI is not configured on the server (missing LOVABLE_API_KEY)." }, 500);

        // Decide whether to run web search
        let sources: WebSearchResult[] = [];
        let searchStatus: "off" | "ok" | "failed" | "unavailable" = "off";
        if (shouldSearchWeb(last.content)) {
          const search = await webSearch(last.content, 5);
          if (search.available && search.results.length > 0) {
            sources = search.results;
            searchStatus = "ok";
          } else {
            searchStatus = search.error === "no-key" ? "unavailable" : "failed";
          }
        }

        const systemPrompt = sources.length > 0
          ? buildSearchAugmentedSystem(sources)
          : BASE_SYSTEM_PROMPT + (
            searchStatus === "failed"
              ? "\n\nNote: this turn attempted a live web search but it failed. Tell the user briefly that live search is unavailable, then answer from static knowledge."
              : searchStatus === "unavailable"
                ? "\n\nNote: live web search is not configured in this deployment. If the user asked for current/live info, say so briefly and answer with static knowledge."
                : ""
          );

        const course = (body.course ?? "").trim();
        const contextLine = course ? `\n\nStudent's declared course/stream: ${course}. Tailor examples accordingly when relevant.` : "";

        // Call the Lovable AI Gateway with streaming SSE.
        const controller = new AbortController();
        request.signal?.addEventListener("abort", () => controller.abort());

        let upstream: Response;
        try {
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": key,
              "X-Lovable-AIG-SDK": "vercel-ai-sdk",
            },
            body: JSON.stringify({
              model: "openai/gpt-5-mini",
              stream: true,
              messages: [
                { role: "system", content: systemPrompt + contextLine },
                ...messages.map((m) => ({ role: m.role, content: m.content })),
              ],
            }),
          });
        } catch (e) {
          console.error("[eduai] upstream fetch failed", e);
          return json({ error: "Network error reaching the AI service. Please try again." }, 502);
        }

        if (!upstream.ok || !upstream.body) {
          const status = upstream.status;
          const bodyText = await upstream.text().catch(() => "");
          console.error("[eduai] upstream error", status, bodyText.slice(0, 300));
          const friendly =
            status === 402 ? "AI credits are exhausted for this workspace. Please add credits to continue."
            : status === 429 ? "Rate limit reached. Please wait a moment and try again."
            : status === 401 || status === 403 ? "AI authorization failed on the server."
            : "The AI service is temporarily unavailable. Please try again shortly.";
          return json({ error: friendly }, status >= 400 && status < 600 ? status : 500);
        }

        // Transform OpenAI SSE stream -> plain text chunks.
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";

        const stream = new ReadableStream({
          async pull(streamController) {
            try {
              const { value, done } = await reader.read();
              if (done) {
                streamController.close();
                return;
              }
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const raw of lines) {
                const line = raw.trim();
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                try {
                  const json = JSON.parse(payload) as {
                    choices?: Array<{ delta?: { content?: string } }>;
                  };
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta) streamController.enqueue(encoder.encode(delta));
                } catch { /* ignore malformed chunk */ }
              }
            } catch (e) {
              console.error("[eduai] stream read failed", e);
              streamController.error(e);
            }
          },
          cancel() { reader.cancel().catch(() => {}); },
        });

        const sourcesHeader = sources.length
          ? encodeURIComponent(JSON.stringify(sources.map((s) => ({ title: s.title, url: s.url }))))
          : "";

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-EduAI-Search-Status": searchStatus,
            "X-EduAI-Sources": sourcesHeader,
            "Access-Control-Expose-Headers": "X-EduAI-Search-Status, X-EduAI-Sources",
          },
        });
      },
    },
  },
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
