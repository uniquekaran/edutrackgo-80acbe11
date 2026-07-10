import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Upload, Search, GraduationCap, FileText } from "lucide-react";
import { UNIVERSITIES, COURSES, YEARS, SECTIONS } from "@/lib/network-data";
import { submitEnrollment, myRequest } from "@/lib/network-state";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/network/register")({
  head: () => ({ meta: [{ title: "Apply to Campus — EduAI Network" }] }),
  component: Register,
});

function Register() {
  const user = useStore((s) => s.user);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [uniQuery, setUniQuery] = useState("");
  const [form, setForm] = useState({
    fullName: user?.name ?? "",
    email: user?.email ?? "",
    university: "",
    course: "",
    year: "",
    section: "",
    receiptDataUrl: undefined as string | undefined,
    receiptName: undefined as string | undefined,
  });

  const filteredUnis = useMemo(
    () => UNIVERSITIES.filter((u) => u.toLowerCase().includes(uniQuery.trim().toLowerCase())),
    [uniQuery],
  );

  const canNext =
    (step === 0 && form.university && form.fullName.trim() && form.email.trim()) ||
    (step === 1 && form.course) ||
    (step === 2 && form.year && form.section) ||
    (step === 3 && form.receiptDataUrl);

  function next() { if (canNext) setStep((s) => Math.min(3, s + 1)); }
  function back() { setStep((s) => Math.max(0, s - 1)); }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast.error("File must be under 4MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((p) => ({ ...p, receiptDataUrl: String(reader.result), receiptName: f.name }));
    reader.readAsDataURL(f);
  }

  function submit() {
    const userId = user?.id ?? "guest_" + Math.random().toString(36).slice(2, 8);
    const existing = myRequest(userId);
    if (existing && existing.status === "pending") {
      toast.info("You already have a pending request");
      navigate({ to: "/network/pending" }); return;
    }
    submitEnrollment({
      userId,
      fullName: form.fullName,
      email: form.email,
      university: form.university,
      course: form.course,
      year: form.year,
      section: form.section,
      receiptDataUrl: form.receiptDataUrl,
      receiptName: form.receiptName,
    });
    try { localStorage.setItem("eduai-current-userid", userId); } catch {}
    toast.success("Request submitted for review");
    navigate({ to: "/network/pending" });
  }

  return (
    <div className="min-h-screen bg-[#050915] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[30rem] h-[30rem] rounded-full bg-indigo-600/25 blur-[110px]" />
        <div className="absolute bottom-0 right-0 w-[26rem] h-[26rem] rounded-full bg-fuchsia-500/20 blur-[110px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-xl px-5 py-8">
        <Link to="/network" className="inline-flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 grid place-items-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Join your campus</h1>
            <p className="text-xs text-white/60">Step {step + 1} of 4</p>
          </div>
        </div>

        {/* progress */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? "bg-gradient-to-r from-indigo-400 to-fuchsia-400" : "bg-white/10"}`} />
          ))}
        </div>

        <div className="mt-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Who are you?</h2>
              <Field label="Full name">
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputCls} placeholder="Full name" />
              </Field>
              <Field label="Email">
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="you@college.edu" />
              </Field>
              <Field label="Search university">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input value={uniQuery} onChange={(e) => setUniQuery(e.target.value)} className={`${inputCls} pl-9`} placeholder="Type your university name…" />
                </div>
              </Field>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
                {filteredUnis.map((u) => (
                  <button
                    key={u}
                    onClick={() => setForm({ ...form, university: u })}
                    className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-white/5 transition ${form.university === u ? "bg-white/10" : ""}`}
                  >
                    <span>{u}</span>
                    {form.university === u && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                ))}
                {filteredUnis.length === 0 && <div className="p-4 text-sm text-white/50">No match. Try a different name.</div>}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Pick your course</h2>
              <div className="grid grid-cols-2 gap-3">
                {COURSES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, course: c })}
                    className={`rounded-2xl border p-4 text-left transition ${form.course === c ? "border-indigo-400 bg-indigo-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                  >
                    <p className="text-lg font-black">{c}</p>
                    <p className="text-[11px] text-white/60 mt-1">Bachelor's programme</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold">Year & Section</h2>
              <div>
                <p className="text-xs uppercase tracking-widest text-white/60 mb-2">Year</p>
                <div className="grid grid-cols-2 gap-2">
                  {YEARS.map((y) => (
                    <button key={y} onClick={() => setForm({ ...form, year: y })}
                      className={`rounded-xl px-3 py-3 text-sm font-semibold border transition ${form.year === y ? "border-indigo-400 bg-indigo-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-white/60 mb-2">Section</p>
                <div className="grid grid-cols-4 gap-2">
                  {SECTIONS.map((s) => (
                    <button key={s} onClick={() => setForm({ ...form, section: s })}
                      className={`rounded-xl px-3 py-3 text-lg font-black border transition ${form.section === s ? "border-fuchsia-400 bg-fuchsia-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Upload admission fee receipt</h2>
              <p className="text-xs text-white/60">PDF or image, up to 4MB. Your university admin will verify this.</p>

              <label className="block cursor-pointer">
                <div className="rounded-2xl border-2 border-dashed border-white/15 hover:border-indigo-400/50 transition p-8 text-center bg-white/5">
                  {form.receiptDataUrl ? (
                    <div className="space-y-3">
                      {form.receiptDataUrl.startsWith("data:image") ? (
                        <img src={form.receiptDataUrl} alt="Admission fee receipt" className="max-h-52 mx-auto rounded-lg" />
                      ) : (
                        <FileText className="w-10 h-10 mx-auto text-indigo-300" />
                      )}
                      <p className="text-sm font-semibold text-emerald-300 flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" /> {form.receiptName}
                      </p>
                      <p className="text-xs text-white/50">Tap to replace</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-10 h-10 mx-auto text-white/50" />
                      <p className="text-sm font-semibold">Tap to upload receipt</p>
                      <p className="text-xs text-white/50">PDF, PNG or JPG</p>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
              </label>

              <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white/70 space-y-1">
                <p><span className="text-white/50">University:</span> {form.university}</p>
                <p><span className="text-white/50">Course:</span> {form.course} · {form.year} · Section {form.section}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button onClick={back} disabled={step === 0}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold disabled:opacity-30">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {step < 3 ? (
            <button onClick={next} disabled={!canNext}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-sm font-bold shadow-lg disabled:opacity-40">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={submit} disabled={!canNext}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold shadow-lg disabled:opacity-40">
              Submit for approval <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-white/30 outline-none focus:border-indigo-400 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-white/60 font-bold">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
