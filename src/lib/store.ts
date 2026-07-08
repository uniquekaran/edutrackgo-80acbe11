import { useSyncExternalStore } from "react";

export type Role = "student" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  college?: string | null;
}

export type DocStatus = "pending" | "verified" | "rejected";
export type DocCategory = "academic" | "identity" | "noc";

export interface DocumentItem {
  id: string;
  ownerId: string;
  ownerName: string;
  category: DocCategory;
  fileName: string;
  status: DocStatus;
  uploadedAt: number;
}

export interface AttendanceRecord {
  userId: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM:SS (24h, IST local)
  timestamp?: number; // epoch ms
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  authorName: string;
}

interface AppState {
  user: User | null;
  users: User[];
  documents: DocumentItem[];
  attendance: AttendanceRecord[];
  announcements: Announcement[];
}

const KEY = "edutrack-state-v1";
const DEPARTMENTS = ["Computer Science", "Electronics", "Mechanical", "Business", "Design"];

function seed(): AppState {
  const seedUsers: User[] = [
    { id: "u1", name: "Aria Mehta", email: "aria@college.edu", role: "student", department: "Computer Science" },
    { id: "u2", name: "Rohan Verma", email: "rohan@college.edu", role: "student", department: "Electronics" },
    { id: "u3", name: "Sara Khan", email: "sara@college.edu", role: "student", department: "Design" },
    { id: "u4", name: "Dean Carter", email: "dean@college.edu", role: "admin" },
  ];
  const today = new Date();
  const attendance: AttendanceRecord[] = [];
  for (const u of seedUsers.filter((u) => u.role === "student")) {
    for (let i = 1; i <= 14; i++) {
      if (Math.random() > 0.25) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        attendance.push({ userId: u.id, date: d.toISOString().slice(0, 10) });
      }
    }
  }
  return {
    user: null,
    users: seedUsers,
    attendance,
    documents: [
      { id: "d1", ownerId: "u1", ownerName: "Aria Mehta", category: "academic", fileName: "transcript_s5.pdf", status: "pending", uploadedAt: Date.now() - 86400000 },
      { id: "d2", ownerId: "u2", ownerName: "Rohan Verma", category: "identity", fileName: "aadhaar.pdf", status: "pending", uploadedAt: Date.now() - 3600000 },
    ],
    announcements: [
      { id: "a1", title: "Mid-term Schedule Released", body: "Mid-term exams begin next Monday. Check the portal for the full schedule.", createdAt: Date.now() - 7200000, authorName: "Dean Carter" },
    ],
  };
}

let state: AppState = load();
const listeners = new Set<() => void>();

function load(): AppState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const s = seed();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  return s;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get() {
    return state;
  },
  set(updater: (s: AppState) => AppState) {
    state = updater(state);
    emit();
  },
};

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(state),
  );
}

// Actions
export function setCurrentUser(user: User) {
  store.set((s) => {
    const existing = s.users.find((u) => u.id === user.id);
    const users = existing ? s.users.map((u) => (u.id === user.id ? user : u)) : [...s.users, user];
    return { ...s, user, users };
  });
}

export function signOut() {
  store.set((s) => ({ ...s, user: null }));
}

export function randomDepartment() {
  return DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
}

export function markAttendance(userId: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const exists = state.attendance.some((a) => a.userId === userId && a.date === today);
  if (exists) return false;
  const time = now.toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" });
  const record: AttendanceRecord = { userId, date: today, time, timestamp: now.getTime() };
  store.set((s) => ({ ...s, attendance: [...s.attendance, record] }));
  return true;
}

export function attendanceStats(userId: string) {
  const total = 30;
  const recent = state.attendance.filter((a) => a.userId === userId);
  const days = recent.length;
  const pct = Math.min(100, Math.round((days / total) * 100));
  return { days, total, pct };
}

export function uploadDocument(input: { ownerId: string; ownerName: string; category: DocCategory; fileName: string }) {
  const doc: DocumentItem = {
    id: "d" + Math.random().toString(36).slice(2, 8),
    ...input,
    status: "pending",
    uploadedAt: Date.now(),
  };
  store.set((s) => ({ ...s, documents: [doc, ...s.documents] }));
}

export function setDocStatus(id: string, status: DocStatus) {
  store.set((s) => ({
    ...s,
    documents: s.documents.map((d) => (d.id === id ? { ...d, status } : d)),
  }));
}

export function broadcast(input: { title: string; body: string; authorName: string }) {
  const a: Announcement = {
    id: "a" + Math.random().toString(36).slice(2, 8),
    title: input.title,
    body: input.body,
    authorName: input.authorName,
    createdAt: Date.now(),
  };
  store.set((s) => ({ ...s, announcements: [a, ...s.announcements] }));
}

export const CATEGORY_LABELS: Record<DocCategory, string> = {
  academic: "Academic Records",
  identity: "Identity Proofs",
  noc: "No-Objection Certificates",
};
