import { auth, defineMcp } from "@lovable.dev/mcp-js";
import askEduAI from "./tools/ask-eduai";
import listColleges from "./tools/list-colleges";
import listSyllabusSubjects from "./tools/list-syllabus-subjects";

// OAuth issuer must be the direct Supabase host (not the .lovable.cloud proxy).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "edutrack-mcp",
  title: "EduTrack",
  version: "0.1.0",
  instructions:
    "Tools from EduTrack — an Indian student platform. Use `ask_eduai` to query the EduAI study tutor, `list_colleges` to browse supported institutions, and `list_syllabus_subjects` to see the tracked subjects.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [askEduAI, listColleges, listSyllabusSubjects],
});
