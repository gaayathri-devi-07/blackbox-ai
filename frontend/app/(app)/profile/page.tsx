import { redirect } from "next/navigation";

/** Profile moved into Settings; keep old links working. */
export default function ProfilePage() {
  redirect("/settings");
}
