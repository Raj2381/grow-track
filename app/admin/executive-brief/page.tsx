import { AdminPageShell } from "@/components/admin-page-shell";
import { BriefView } from "./brief-view";

// Server component on purpose; no loading.tsx (see predictions/page.tsx).
export default function ExecutiveBriefPage() {
  return (
    <AdminPageShell title="Executive brief">
      <BriefView />
    </AdminPageShell>
  );
}
