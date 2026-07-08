import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Brain, CheckCircle2, XCircle, Loader2, RotateCcw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/student/quiz")({
  head: () => ({ meta: [{ title: "Daily Quiz — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: QuizPage,
});

interface Question {
  id: string;
  subject: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "A" | "B" | "C" | "D";
}

const LETTERS: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];

function QuizPage() {
  const user = useStore((s) => s.user);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, "A" | "B" | "C" | "D">>({});
  const [submitted, setSubmitted] = useState<{ score: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setSubmitted(null);
    setAnswers({});
    setQuestions(null);
    const { data, error } = await supabase
      .from("questions")
      .select("id,subject,question,option_a,option_b,option_c,option_d,correct_answer")
      .limit(50);
    if (error) {
      toast.error("Failed to load quiz");
      setQuestions([]);
      return;
    }
    setQuestions((data ?? []) as Question[]);
  };

  useEffect(() => { load(); }, []);

  const answeredCount = Object.keys(answers).length;
  const total = questions?.length ?? 0;

  async function submit() {
    if (!user || !questions) return;
    setSubmitting(true);
    let score = 0;
    for (const q of questions) if (answers[q.id] === q.correct_answer) score++;
    const { error } = await supabase.from("user_stats").insert({
      user_id: user.id,
      subject: "Daily Quiz",
      score,
      total: questions.length,
    });
    setSubmitting(false);
    if (error) { toast.error("Could not save score"); return; }
    setSubmitted({ score, total: questions.length });
    toast.success(`Scored ${score}/${questions.length}`);
  }

  const pct = useMemo(() => submitted ? Math.round((submitted.score / submitted.total) * 100) : 0, [submitted]);

  return (
    <div className="pb-8">
      <header className="px-6 pt-10 pb-5 gradient-primary text-primary-foreground rounded-b-[2rem]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 grid place-items-center">
            <Brain className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black leading-tight">Daily Quiz</h1>
            <p className="text-[11px] opacity-90">
              {questions === null ? "Loading questions…" : `${answeredCount}/${total} answered`}
            </p>
          </div>
        </div>
      </header>

      <section className="px-5 -mt-6">
        {questions === null && (
          <div className="rounded-2xl glass-strong p-6 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading questions…
          </div>
        )}

        {questions && questions.length === 0 && (
          <div className="rounded-2xl glass-strong p-6 text-center">
            <p className="text-sm font-bold">No questions yet</p>
            <p className="text-[11px] text-muted-foreground mt-1">An admin needs to add questions to the bank.</p>
          </div>
        )}

        {submitted && (
          <div className="rounded-2xl glass-strong shadow-elevated p-5 flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl gradient-primary text-primary-foreground grid place-items-center">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Your score</p>
              <p className="text-2xl font-black">{submitted.score} / {submitted.total} <span className="text-sm text-muted-foreground">({pct}%)</span></p>
            </div>
            <button onClick={load} className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl bg-secondary flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        <div className="space-y-3">
          {questions?.map((q, i) => {
            const picked = answers[q.id];
            const isCorrect = submitted && picked === q.correct_answer;
            return (
              <div key={q.id} className="rounded-2xl glass shadow-soft p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                  Q{i + 1} · {q.subject}
                </p>
                <p className="text-sm font-bold leading-snug mb-3">{q.question}</p>
                <div className="grid gap-1.5">
                  {LETTERS.map((letter) => {
                    const text = q[`option_${letter.toLowerCase()}` as keyof Question] as string;
                    const chosen = picked === letter;
                    const correct = q.correct_answer === letter;
                    let cls = "bg-secondary text-foreground";
                    if (submitted) {
                      if (correct) cls = "bg-emerald-500/20 border border-emerald-500/50 text-foreground";
                      else if (chosen && !correct) cls = "bg-destructive/20 border border-destructive/50 text-foreground";
                    } else if (chosen) {
                      cls = "gradient-primary text-primary-foreground";
                    }
                    return (
                      <button
                        key={letter}
                        disabled={!!submitted}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: letter }))}
                        className={`w-full text-left text-[13px] font-medium px-3 py-2 rounded-xl transition ${cls}`}
                      >
                        <span className="font-black mr-2">{letter}.</span>{text}
                      </button>
                    );
                  })}
                </div>
                {submitted && (
                  <div className={`mt-2 flex items-center gap-1 text-[11px] font-bold ${isCorrect ? "text-emerald-500" : "text-destructive"}`}>
                    {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {isCorrect ? "Correct" : `Correct answer: ${q.correct_answer}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {questions && questions.length > 0 && !submitted && (
          <button
            onClick={submit}
            disabled={submitting || answeredCount === 0}
            className="mt-5 w-full gradient-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-3.5 rounded-2xl shadow-elevated disabled:opacity-50"
          >
            {submitting ? "Submitting…" : `Submit Quiz (${answeredCount}/${total})`}
          </button>
        )}
      </section>
    </div>
  );
}
