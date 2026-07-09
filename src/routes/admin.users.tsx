import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

type Role = "student" | "teacher" | "admin";

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  college: string | null;
  role: Role;
}

async function loadUsers(): Promise<Row[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, college")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  const roleMap = new Map<string, Role>();
  for (const r of roles ?? []) roleMap.set(r.user_id, (r.role as Role) ?? "student");
  return (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    college: p.college,
    role: roleMap.get(p.id) ?? "student",
  }));
}

function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const refresh = async () => {
    setLoading(true);
    try { setRows(await loadUsers()); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = rows.filter((r) =>
    !q || (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || r.email.toLowerCase().includes(q.toLowerCase()),
  );

  async function updateRole(userId: string, role: Role) {
    // Remove other roles for this user, then insert the new one to keep it single-role.
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success(`Role updated to ${role}`);
    setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, role } : r)));
  }

  async function deleteUser(userId: string) {
    if (!confirm("Remove this user's profile and roles? This does not delete the auth user.")) return;
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success("User removed");
    setRows((prev) => prev.filter((r) => r.id !== userId));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Manage</p>
          <h1 className="text-2xl font-black">User Profiles</h1>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email"
            className="w-64 h-10 pl-9 pr-3 rounded-xl bg-secondary text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-bold">Name</th>
                <th className="text-left px-4 py-2.5 font-bold">Email</th>
                <th className="text-left px-4 py-2.5 font-bold">College</th>
                <th className="text-left px-4 py-2.5 font-bold">Role</th>
                <th className="text-right px-4 py-2.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">No users found.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold truncate max-w-[180px]">{r.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[220px]">{r.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.college ?? "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.role}
                      onChange={(e) => updateRole(r.id, e.target.value as Role)}
                      className="h-8 px-2 rounded-lg bg-secondary text-xs font-bold outline-none"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteUser(r.id)}
                      className="text-destructive p-2 rounded-lg hover:bg-destructive/10"
                      aria-label="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Save className="w-3 h-3" /> Role changes save instantly.</p>
    </div>
  );
}
