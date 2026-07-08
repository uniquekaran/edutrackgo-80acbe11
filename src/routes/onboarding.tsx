import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { toast } from "sonner";
import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Personalize Your Workspace — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: OnboardingPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(80),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(20),
  batch: z.string().trim().min(2, "Enter your batch/year").max(20),
  college: z.enum(["AKTU", "VSET", "Others"], { required_error: "Choose your institution" }),
});

function OnboardingPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const [full_name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [batch, setBatch] = useState("");
  const [college, setCollege] = useState<"AKTU" | "VSET" | "Others" | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { navigate({ to: "/auth" }); return; }
    setName(user.name ?? "");
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,phone,batch,college")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        if (data.full_name) setName(data.full_name);
        if (data.phone) setPhone(data.phone);
        if (data.batch) setBatch(data.batch);
        if (data.college && ["AKTU", "VSET", "Others"].includes(data.college)) {
          setCollege(data.college as "AKTU" | "VSET" | "Others");
        }
      }
    })();
  }, [user?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ full_name, phone, batch, college });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Please check the form");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        batch: parsed.data.batch,
        college: parsed.data.college,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Workspace personalized");
    navigate({ to: "/student" });
  }

  return (
    <div className="min-h-screen w-full grid place-items-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-3xl glass-strong shadow-elevated p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl gradient-primary text-primary-foreground grid place-items-center shadow-elevated">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-primary font-black flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> System Update
            </p>
            <h1 className="text-lg font-black">Personalize Your Workspace</h1>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-5 flex items-start gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          We're upgrading your dashboard to provide the most relevant tools for your specific institution. Please confirm your details below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Full name">
            <input value={full_name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Karan Singh" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+91 98765 43210" inputMode="tel" />
          </Field>
          <Field label="Batch / Year">
            <input value={batch} onChange={(e) => setBatch(e.target.value)} className="input" placeholder="e.g. 2024–2028" />
          </Field>
          <Field label="Institution">
            <select value={college} onChange={(e) => setCollege(e.target.value as "AKTU" | "VSET" | "Others")} className="input">
              <option value="">Select institution…</option>
              <option value="AKTU">AKTU</option>
              <option value="VSET">VSET</option>
              <option value="Others">Others</option>
            </select>
          </Field>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-black text-sm shadow-elevated disabled:opacity-60"
          >
            {saving ? "Saving…" : "Continue to dashboard →"}
          </button>
        </form>
      </div>

      <style>{`
        .input { width: 100%; height: 44px; padding: 0 14px; border-radius: 14px; background: var(--color-secondary); border: 1px solid transparent; font-size: 14px; font-weight: 500; outline: none; }
        .input:focus { border-color: var(--color-primary); background: var(--color-surface); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
