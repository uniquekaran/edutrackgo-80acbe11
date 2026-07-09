import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Upload, Trash2, FileText, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { formatISTDate } from "@/lib/format";

export const Route = createFileRoute("/admin/documents")({
  component: AdminDocuments,
});

interface Row {
  id: string;
  college: string;
  subject: string;
  title: string;
  file_url: string;
  created_at: string;
}

const CATEGORIES = ["Syllabus", "Notes", "Notice"] as const;
const COLLEGES = ["AKTU", "VSET", "Others"] as const;

function AdminDocuments() {
  const user = useStore((s) => s.user);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "Syllabus" as (typeof CATEGORIES)[number],
    college: "AKTU" as (typeof COLLEGES)[number],
  });
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("syllabi")
      .select("id, college, subject, title, file_url, created_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Row[]);
  };
  useEffect(() => { load(); }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Choose a file");
    if (!user) return toast.error("Not signed in");
    setBusy(true);
    try {
      const cleanName = file.name.replace(/[^a-z0-9._-]/gi, "_");
      const path = `${form.college}/${Date.now()}_${cleanName}`;
      const { error: upErr } = await supabase.storage
        .from("syllabi")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("syllabi")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Failed to sign URL");

      const { error } = await supabase.from("syllabi").insert({
        college: form.college,
        subject: form.category,
        title: form.title || cleanName,
        file_url: signed.signedUrl,
        uploaded_by: user.id,
      });
      if (error) throw error;
      toast.success("Document uploaded");
      setForm({ title: "", category: "Syllabus", college: form.college });
      setFile(null);
      (document.getElementById("admin-doc-file") as HTMLInputElement | null) &&
        ((document.getElementById("admin-doc-file") as HTMLInputElement).value = "");
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function remove(r: Row) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    // Best-effort remove of storage object (path derived from signed URL if we uploaded it).
    const match = r.file_url.match(/\/syllabi\/([^?]+)/);
    if (match?.[1]) {
      await supabase.storage.from("syllabi").remove([decodeURIComponent(match[1])]);
    }
    const { error } = await supabase.from("syllabi").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Manage</p>
        <h1 className="text-2xl font-black">Documents</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Upload syllabi, notes, and notices. Stored in the <code>syllabi</code> bucket with role-based visibility.</p>
      </div>

      <form onSubmit={upload} className="rounded-2xl bg-surface border border-border shadow-soft p-5 space-y-3">
        <p className="text-sm font-bold">Upload new document</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            required placeholder="Document name / title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-xl bg-secondary px-3 py-2 text-sm sm:col-span-3"
          />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as (typeof CATEGORIES)[number] })} className="rounded-xl bg-secondary px-3 py-2 text-sm">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value as (typeof COLLEGES)[number] })} className="rounded-xl bg-secondary px-3 py-2 text-sm">
            {COLLEGES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input
            id="admin-doc-file" required type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs rounded-xl bg-secondary px-3 py-2"
          />
        </div>
        <button disabled={busy} className="w-full gradient-primary text-primary-foreground font-black uppercase tracking-widest text-xs py-2.5 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {busy ? "Uploading…" : "Upload document"}
        </button>
      </form>

      <div className="rounded-2xl bg-surface border border-border shadow-soft overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Uploaded · {rows.length}</p>
        </div>
        {loading && <p className="p-6 text-center text-xs text-muted-foreground">Loading…</p>}
        {!loading && rows.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No documents uploaded yet.</p>}
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{r.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {r.college} · {r.subject} · {formatISTDate(r.created_at)}
                </p>
              </div>
              <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-primary hover:bg-accent rounded-lg" aria-label="Open">
                <ExternalLink className="w-4 h-4" />
              </a>
              <button onClick={() => remove(r)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg" aria-label="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
