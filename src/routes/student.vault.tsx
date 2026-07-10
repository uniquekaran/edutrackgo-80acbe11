// The Documents Vault route — the sidebar links here.
// It renders the same 11-item document vault used by /student/documents,
// so both entry points show the current, canonical UI.
import { createFileRoute } from "@tanstack/react-router";
import DocumentsRoute from "./student.documents";
import { RouteSkeleton } from "@/components/RouteSkeleton";

// Reuse the component from the documents route to avoid drift.
const VaultComponent = DocumentsRoute.options.component!;

export const Route = createFileRoute("/student/vault")({
  head: () => ({ meta: [{ title: "Documents Vault — EduTrack" }] }),
  pendingComponent: RouteSkeleton,
  component: VaultComponent,
});
