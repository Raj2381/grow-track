import { AdminPageShell } from "@/components/admin-page-shell";
import { SegmentsView } from "./segments-view";

// Server component on purpose; no loading.tsx (see predictions/page.tsx).
export default function SegmentsPage() {
  return (
    <AdminPageShell title="Segments">
      <SegmentsView />
    </AdminPageShell>
  );
}
