import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Upload, Trash2, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/manage/syllabus")({
  component: ManageSyllabus,
});

interface Row { id: string; college: string; subject: string; title: string; file_url: string; created_at: string; }

function ManageSyllabus() {
  const user = useStore((s) => s.user);
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ college: "AKTU", subject: "", title: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("syllabi").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !user) return toast.error("Choose a file");
    setBusy(true);
    const path = `${form.college}/${Date.now()}_${file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
    const { error: upErr } = await supabase.storage.from("syllabi").upload(path, file, { upsert: false });
    if (upErr) { setBusy(false); return toast.error(upErr.message); }
    const { data: signed } = await supabase.storage.from("syllabi").createSignedUrl(path, 60 * 60 * 24 * 365);
    const file_url = signed?.signedUrl ?? path;
    const { error } = await supabase.from("syllabi").insert({
      college: form.college, subject: form.subject, title: form.title || file.name, file_url, uploaded_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Uploaded");
    setForm({ college: form.college, subject: "", title: "" });
    setFile(null);
    load();
  }

  async function remove(id: string) {
    await supabase.from("syllabi").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={upload} className="rounded-2xl glass-strong p-4 space-y-2">
        <p className="text-sm font-bold mb-2">Upload syllabus</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm">
            <option>AKTU</option><option>VSET</option><option>Others</option>
          </select>
          <input required placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm" />
          <input placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl bg-secondary px-3 py-2 text-sm" />
        </div>
        <input required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
        <button disabled={busy} className="w-full gradient-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-2.5 rounded-xl flex items-center justify-center gap-1">
          <Upload className="w-4 h-4" /> {busy ? "Uploading…" : "Upload"}
        </button>
      </form>

      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{rows.length} syllabi</p>
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl glass p-3 flex items-center gap-3">
            <FileText className="w-4 h-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{r.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{r.college} · {r.subject}</p>
            </div>
            <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-primary p-2"><ExternalLink className="w-4 h-4" /></a>
            <button onClick={() => remove(r.id)} className="text-destructive p-2"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
