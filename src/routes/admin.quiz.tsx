import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/quiz")({
  component: AdminQuiz,
});

interface Row {
  id: string;
  subject: string;
  question: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_answer: string;
}

const EMPTY = { subject: "", question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "A" };

function AdminQuiz() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("questions")
      .select("id, subject, question, option_a, option_b, option_c, option_d, correct_answer")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("questions").insert(form);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Question added");
    setForm(EMPTY);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Manage</p>
        <h1 className="text-2xl font-black">Quiz Bank</h1>
      </div>

      <form onSubmit={add} className="rounded-2xl bg-surface border border-border shadow-soft p-5 space-y-3">
        <p className="text-sm font-bold">Add new question</p>
        <input required placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2 text-sm" />
        <textarea required placeholder="Question text" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2 text-sm min-h-[72px]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(["a", "b", "c", "d"] as const).map((k) => (
            <input
              key={k} required placeholder={`Option ${k.toUpperCase()}`}
              value={(form as Record<string, string>)[`option_${k}`]}
              onChange={(e) => setForm({ ...form, [`option_${k}`]: e.target.value })}
              className="rounded-xl bg-secondary px-3 py-2 text-sm"
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase text-muted-foreground">Correct</label>
          <select value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm">
            {["A", "B", "C", "D"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button disabled={saving} className="w-full gradient-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-2.5 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {saving ? "Saving…" : "Add question"}
        </button>
      </form>

      <div className="rounded-2xl bg-surface border border-border shadow-soft overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{rows.length} questions</p>
        </div>
        {loading && <p className="p-6 text-center text-xs text-muted-foreground">Loading…</p>}
        {!loading && rows.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No questions yet.</p>}
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary">{r.subject}</p>
                <p className="text-sm font-semibold">{r.question}</p>
                <div className="grid grid-cols-2 gap-1 mt-2 text-[11px] text-muted-foreground">
                  <p><span className="font-bold">A.</span> {r.option_a}</p>
                  <p><span className="font-bold">B.</span> {r.option_b}</p>
                  <p><span className="font-bold">C.</span> {r.option_c}</p>
                  <p><span className="font-bold">D.</span> {r.option_d}</p>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-accent text-primary shrink-0">{r.correct_answer}</span>
              <button onClick={() => remove(r.id)} className="text-destructive p-2 rounded-lg hover:bg-destructive/10 shrink-0" aria-label="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
