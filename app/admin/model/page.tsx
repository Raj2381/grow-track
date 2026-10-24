import { AdminPageShell } from "@/components/admin-page-shell";
import { ModelView } from "./model-view";

// Server component on purpose; no loading.tsx (see predictions/page.tsx).
export default function ModelPage() {
  return (
    <AdminPageShell title="Model performance">
      <ModelView />
    </AdminPageShell>
  );
}
