import { redirect } from "next/navigation";

export default function LegacyStudentAttendancePage() {
  redirect("/student/dashboard/attendance");
}
