import { redirect } from "next/navigation";

export default function LegacyLmsPage() {
  redirect("/student/dashboard");
}
