import { AdminPageShell } from "@/components/admin-page-shell";
import { ForecastView } from "./forecast-view";

// Server component on purpose: a client page receives searchParams/params promises that stalled hydration on deep links.
export default function PredictionsPage() {
  return (
    <AdminPageShell title="Forecast">
      <ForecastView />
    </AdminPageShell>
  );
}
