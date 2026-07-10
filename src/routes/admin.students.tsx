import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, XCircle, Eye, ExternalLink, Loader2, Search, User as UserIcon, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatISTDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/students")({
  head: () => ({ meta: [{ title: "Student Documents — Admin" }] }),
  component: AdminStudents,
});

type DocStatus = "pending" | "verified" | "rejected";
interface Doc {
  id: string;
  student_id: string;
  student_name: string;
  document_type: string;
  file_url: string;
  status: DocStatus;
  created_at: string;
  updated_at: string;
}

interface StudentSummary {
  id: string;
  name: string;
  email: string | null;
  docs: Doc[];
}

const REQUIRED_DOCS = [
  "Trust Registration Certificate",
  "10th Original Marksheet",
  "12th Original Marksheet",
  "Original Aadhaar Card",
  "Student Registered Mobile Number",
  "Entrance Exam Scorecard / Details",
  "Original Income Certificate",
  "Father Mobile Number",
  "Original Caste Certificate",
  "Original Payment Receipt",
  "NOC (No Objection Certificate)",
];

function AdminStudents() {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [profiles, setProfiles] = useState<Map<string, { email: string | null; full_name: string | null }>>(new Map());
  const [q, setQ] = useState("");
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [preview, setPreview] = useState<Doc | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Doc[];
      setDocs(rows);

      const ids = Array.from(new Set(rows.map((r) => r.student_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", ids);
        const map = new Map<string, { email: string | null; full_name: string | null }>();
        for (const p of profs ?? []) map.set(p.id, { email: p.email, full_name: p.full_name });
        setProfiles(map);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const students: StudentSummary[] = useMemo(() => {
    const grp = new Map<string, StudentSummary>();
    for (const d of docs) {
      const prof = profiles.get(d.student_id);
      const s = grp.get(d.student_id) ?? {
        id: d.student_id,
        name: prof?.full_name || d.student_name || "Unknown",
        email: prof?.email ?? null,
        docs: [],
      };
      s.docs.push(d);
      grp.set(d.student_id, s);
    }
    return Array.from(grp.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [docs, profiles]);

  const filtered = students.filter((s) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return s.name.toLowerCase().includes(needle) || (s.email ?? "").toLowerCase().includes(needle);
  });

  async function setStatus(doc: Doc, status: DocStatus) {
    if (status === "rejected") {
      const reason = window.prompt(`Reject "${doc.document_type}"?\nEnter reason (blurry, wrong document, missing page, etc.):`);
      if (reason === null) return;
      if (!reason.trim()) return toast.error("Rejection reason is required.");
      toast.message("Rejection reason recorded locally.", { description: reason });
    }
    const { error } = await supabase
      .from("documents")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success(`Document ${status}`);
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status } : d)));
  }

  const summary = useMemo(() => {
    let approved = 0, rejected = 0, pending = 0;
    for (const d of docs) {
      if (d.status === "verified") approved++;
      else if (d.status === "rejected") rejected++;
      else pending++;
    }
    return { total: docs.length, approved, rejected, pending };
  }, [docs]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Review</p>
        <h1 className="text-2xl font-black">Student Documents</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Review and approve or reject uploaded student documents.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total" value={summary.total} tone="default" />
        <SummaryCard label="Approved" value={summary.approved} tone="success" />
        <SummaryCard label="Pending" value={summary.pending} tone="warning" />
        <SummaryCard label="Rejected" value={summary.rejected} tone="danger" />
      </div>

      <div className="rounded-2xl bg-surface border border-border shadow-soft p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search students by name or email"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-secondary text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-border shadow-soft divide-y divide-border">
        {loading && <p className="p-6 text-center text-xs text-muted-foreground">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No student documents found.</p>}
        {filtered.map((s) => {
          const done = REQUIRED_DOCS.filter((t) => s.docs.some((d) => d.document_type === t)).length;
          const open = openStudent === s.id;
          return (
            <div key={s.id}>
              <button
                onClick={() => setOpenStudent(open ? null : s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30"
              >
                <div className="w-10 h-10 rounded-xl bg-accent text-primary grid place-items-center shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{s.email ?? s.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold">{done}/{REQUIRED_DOCS.length}</p>
                  <p className="text-[10px] text-muted-foreground">{s.docs.length} uploads</p>
                </div>
              </button>
              {open && (
                <div className="px-4 pb-4 bg-secondary/30">
                  <ul className="mt-2 space-y-2">
                    {s.docs.map((d) => (
                      <li key={d.id} className="rounded-xl bg-surface border border-border p-3 flex items-center gap-3">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{d.document_type}</p>
                          <p className="text-[10px] text-muted-foreground">{formatISTDateTime(d.created_at)}</p>
                        </div>
                        <StatusTag status={d.status} />
                        <button
                          onClick={() => setPreview(d)}
                          className="p-2 text-muted-foreground hover:bg-accent rounded-lg"
                          aria-label="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={d.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-primary hover:bg-accent rounded-lg"
                          aria-label="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => setStatus(d, "verified")}
                          disabled={d.status === "verified"}
                          className="px-2 py-1 rounded-lg bg-success/15 text-success text-[10px] font-bold uppercase disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setStatus(d, "rejected")}
                          disabled={d.status === "rejected"}
                          className="px-2 py-1 rounded-lg bg-destructive/15 text-destructive text-[10px] font-bold uppercase disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "default" | "success" | "warning" | "danger" }) {
  const toneCls = {
    default: "bg-secondary text-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    danger: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className={`rounded-2xl p-4 border border-border ${toneCls}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}

function StatusTag({ status }: { status: DocStatus }) {
  const map = {
    pending: { Icon: Clock, label: "Pending", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    verified: { Icon: CheckCircle2, label: "Verified", cls: "bg-success/15 text-success border-success/30" },
    rejected: { Icon: XCircle, label: "Rejected", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  } as const;
  const { Icon, label, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase border ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function PreviewModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const url = doc.file_url;
  const lower = url.split("?")[0].toLowerCase();
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(lower) || url.startsWith("data:image") || url.startsWith("blob:");
  const isPdf = /\.pdf$/.test(lower) || url.startsWith("data:application/pdf");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-surface w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-elevated flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <FileText className="w-4 h-4 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{doc.document_type}</p>
            <p className="text-[11px] text-muted-foreground truncate">{doc.student_name}</p>
          </div>
          <StatusTag status={doc.status} />
        </div>
        <div className="flex-1 overflow-auto bg-secondary/40 grid place-items-center p-3">
          {isImage ? (
            <img src={url} alt={doc.document_type} className="max-w-full max-h-[70vh] rounded-2xl border border-border bg-white object-contain" />
          ) : isPdf ? (
            <iframe src={url} title={doc.document_type} className="w-full h-[70vh] rounded-2xl border border-border bg-white" />
          ) : (
            <div className="text-center p-8">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">Preview not available</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline break-all">{url}</a>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border flex gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 h-11 rounded-xl bg-secondary text-sm font-bold flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" /> Open / Download
          </a>
          <button onClick={onClose} className="flex-1 h-11 rounded-xl gradient-primary text-primary-foreground text-sm font-bold">Close</button>
        </div>
      </div>
    </div>
  );
}
