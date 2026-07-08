import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload, CheckCircle2, XCircle, FileText, Loader2, ShieldAlert, Presentation } from "lucide-react";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { useTenant } from "@/lib/tenant";
import { toast } from "sonner";

export const Route = createFileRoute("/student/competency")({
  head: () => ({ meta: [{ title: "PPT Vault — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: CompetencyVault,
});

const CORE_SLOTS = [
  "Scholarship Brand PPT",
  "Education Platform PPT",
  "VSDT Concept PPT",
  "Helping Hand Model PPT",
  "Youth Empowerment PPT",
];
const GLOBAL_SLOTS = [
  "CSR Initiatives Deck",
  "Revenue Roadmap Deck",
  "Market Feasibility Deck",
  "Growth Blueprint Deck",
  "Leadership Vision Deck",
];

interface Submission {
  id: string;
  slot: number;
  title: string;
  file_path: string | null;
  status: "Pending" | "Approved" | "Revise";
  reviewer_notes: string | null;
  risk_recovery: boolean;
}

function CompetencyVault() {
  const user = useStore((s) => s.user)!;
  const { isCoreMember, loading: tenantLoading } = useTenant();
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const labels = isCoreMember ? CORE_SLOTS : GLOBAL_SLOTS;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ppt_submissions")
        .select("id,slot,title,file_path,status,reviewer_notes,risk_recovery")
        .eq("user_id", user.id)
        .order("slot", { ascending: true });
      if (alive) { setRows((data ?? []) as Submission[]); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [user.id]);

  return (
    <div className="pb-8">
      <header className="px-6 pt-10 pb-6 gradient-primary text-primary-foreground rounded-b-[2rem]">
        <p className="text-xs uppercase tracking-widest opacity-80">Competency Vault</p>
        <h1 className="text-2xl font-black mt-1 flex items-center gap-2">
          <Presentation className="w-6 h-6" /> {isCoreMember ? "5-Slot PPT Vault" : "Venture Feasibility Vault"}
        </h1>
        <p className="text-sm opacity-90 mt-1">
          {isCoreMember
            ? "Upload the five committee-mandated presentations. Risk & Recovery Analysis is mandatory for each slot."
            : "Upload your five enterprise-grade decks. Reviewed and approved by the admin."}
        </p>
      </header>

      <section className="px-5 mt-4 space-y-3">
        {tenantLoading || loading ? (
          <div className="grid place-items-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          labels.map((label, i) => (
            <SlotCard
              key={i}
              slot={i + 1}
              label={label}
              userId={user.id}
              submission={rows.find((r) => r.slot === i + 1)}
              requireRisk={isCoreMember}
              onChange={(next) => setRows((prev) => {
                const rest = prev.filter((r) => r.slot !== next.slot);
                return [...rest, next].sort((a, b) => a.slot - b.slot);
              })}
            />
          ))
        )}
      </section>
    </div>
  );
}

function SlotCard({
  slot, label, userId, submission, requireRisk, onChange,
}: {
  slot: number; label: string; userId: string;
  submission?: Submission; requireRisk: boolean;
  onChange: (s: Submission) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [risk, setRisk] = useState(submission?.risk_recovery ?? false);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    if (requireRisk && !risk) {
      toast.error("Confirm the Risk & Recovery Analysis checkbox before uploading.");
      return;
    }
    setUploading(true);
    const path = `ppt/${userId}/slot-${slot}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("student-documents").upload(path, file, { upsert: false });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }

    const payload = {
      user_id: userId,
      slot,
      title: label,
      file_path: path,
      status: "Pending" as const,
      risk_recovery: risk,
    };
    const { data, error } = await supabase
      .from("ppt_submissions")
      .upsert(payload, { onConflict: "user_id,slot" })
      .select("id,slot,title,file_path,status,reviewer_notes,risk_recovery")
      .single();
    setUploading(false);
    if (error || !data) { toast.error(error?.message ?? "Upload failed"); return; }
    onChange(data as Submission);
    toast.success(`${label} uploaded`);
  }

  const status = submission?.status;
  return (
    <div className="rounded-2xl glass shadow-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Slot {slot}</p>
          <p className="text-sm font-bold truncate">{label}</p>
          {submission?.file_path && (
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-1">
              <FileText className="w-3 h-3" /> {submission.file_path.split("/").pop()}
            </p>
          )}
          {submission?.reviewer_notes && (
            <p className="mt-2 text-[11px] rounded-lg bg-secondary/60 p-2 text-foreground">
              <span className="font-black">Reviewer:</span> {submission.reviewer_notes}
            </p>
          )}
        </div>
        <StatusPill status={status} />
      </div>

      {requireRisk && (
        <label className="mt-3 flex items-center gap-2 text-[12px] font-semibold">
          <input type="checkbox" checked={risk} onChange={(e) => setRisk(e.target.checked)} className="w-4 h-4 rounded" />
          <span className="flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Risk & Recovery Analysis complete</span>
        </label>
      )}

      <input ref={inputRef} type="file" accept=".pdf,.ppt,.pptx" className="hidden"
             onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-3 w-full h-11 rounded-xl gradient-primary text-primary-foreground text-xs font-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {submission ? "Replace file" : "Upload PPT / PDF"}
      </button>
    </div>
  );
}

function StatusPill({ status }: { status?: "Pending" | "Approved" | "Revise" }) {
  if (!status) return <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empty</span>;
  if (status === "Approved") return <span className="text-[10px] font-black uppercase tracking-widest text-success inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
  if (status === "Revise") return <span className="text-[10px] font-black uppercase tracking-widest text-destructive inline-flex items-center gap-1"><XCircle className="w-3 h-3" /> Revise</span>;
  return <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pending</span>;
}
