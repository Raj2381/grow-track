import { redirect } from "next/navigation";

export default function LegacyStudentProfilePage() {
  redirect("/student/dashboard");
}
