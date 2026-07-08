import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/manage/questions")({
  component: ManageQuestions,
});

interface Row { id: string; subject: string; question: string; correct_answer: string; }

function ManageQuestions() {
  const [rows, setRows] = useState<Row[]>([]);
  const empty = { subject: "", question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "A" };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("questions").select("id,subject,question,correct_answer").order("created_at", { ascending: false }).limit(100);
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
    setForm(empty);
    load();
  }
  async function remove(id: string) {
    await supabase.from("questions").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="rounded-2xl glass-strong p-4 space-y-2">
        <p className="text-sm font-bold mb-2">Add question</p>
        <input required placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2 text-sm" />
        <textarea required placeholder="Question text" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2 text-sm min-h-[60px]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(["a", "b", "c", "d"] as const).map((k) => (
            <input key={k} required placeholder={`Option ${k.toUpperCase()}`} value={(form as Record<string, string>)[`option_${k}`]}
              onChange={(e) => setForm({ ...form, [`option_${k}`]: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm" />
          ))}
        </div>
        <select value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })} className="w-full rounded-xl bg-secondary px-3 py-2 text-sm">
          <option value="A">Correct: A</option><option value="B">Correct: B</option><option value="C">Correct: C</option><option value="D">Correct: D</option>
        </select>
        <button disabled={saving} className="w-full gradient-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-2.5 rounded-xl flex items-center justify-center gap-1">
          <Plus className="w-4 h-4" /> {saving ? "Saving…" : "Add question"}
        </button>
      </form>

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{rows.length} in bank (recent 100)</p>
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl glass p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase text-primary">{r.subject}</p>
              <p className="text-sm font-medium truncate">{r.question}</p>
            </div>
            <span className="text-[10px] font-black px-2 py-1 rounded-full bg-accent text-primary">{r.correct_answer}</span>
            <button onClick={() => remove(r.id)} className="text-destructive p-2"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
