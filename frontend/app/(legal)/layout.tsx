import Link from "next/link";
import { Brand } from "@/components/brand";

/** Public, readable layout for policy pages. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/login" aria-label="Blackbox home">
            <Brand />
          </Link>
          <nav className="flex gap-5 text-[13px] text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/login" className="hidden hover:text-foreground sm:inline">Sign in</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">{children}</main>
    </div>
  );
}
