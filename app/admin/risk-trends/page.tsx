import { AdminPageShell } from "@/components/admin-page-shell";
import { RiskTrendsView } from "./risk-trends-view";

// Server component on purpose; no loading.tsx (see predictions/page.tsx).
export default function RiskTrendsPage() {
  return (
    <AdminPageShell title="Risk trends">
      <RiskTrendsView />
    </AdminPageShell>
  );
}
