import { AdminPageShell } from "@/components/admin-page-shell";
import { HelpContent } from "@/app/help/page";

export default function FacultyHelpPage() {
  return (
    <AdminPageShell title="Help and documentation">
      <HelpContent />
    </AdminPageShell>
  );
}
