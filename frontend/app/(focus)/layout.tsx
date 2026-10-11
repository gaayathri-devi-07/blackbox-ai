import { RequireAuth } from "@/components/require-auth";

/** Full-screen, distraction-free rooms (interview session, group discussion). */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
