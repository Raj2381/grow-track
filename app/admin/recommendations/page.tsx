import { AdminPageShell } from "@/components/admin-page-shell";
import { RecommendationsView } from "./recommendations-view";

// Server component on purpose (see predictions/page.tsx). No loading.tsx: it stalled hydration on hard reloads.
export default function RecommendationsPage() {
  return (
    <AdminPageShell title="Recommendations">
      <RecommendationsView />
    </AdminPageShell>
  );
}
