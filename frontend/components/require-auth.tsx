"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";
import { BrandMark } from "@/components/brand";

/**
 * Gate for authenticated areas: redirects signed-out visitors to /login and
 * candidates without a target track to /onboarding.
 */
export function RequireAuth({ children, allowIncompleteProfile = false }: { children: React.ReactNode; allowIncompleteProfile?: boolean }) {
  const { status, profile, profileError, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "signed-out") {
      router.replace(`/login?next=${encodeURIComponent(pathname ?? "/home")}`);
    } else if (status === "signed-in" && profile && !profile.onboardingComplete && !allowIncompleteProfile) {
      router.replace("/onboarding");
    }
  }, [status, profile, allowIncompleteProfile, pathname, router]);

  if (status === "signed-in" && profileError && !profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center">
          <AlertTriangle className="mx-auto size-5 text-warning" />
          <p className="mt-3 text-sm font-medium">We couldn&apos;t load your workspace</p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{profileError}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button size="sm" onClick={() => void refreshProfile()}>Try again</Button>
            <Button size="sm" variant="ghost" onClick={() => void signOut()}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  const ready = status === "signed-in" && profile && (allowIncompleteProfile || profile.onboardingComplete);
  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4" aria-busy="true">
        <BrandMark className="size-7 opacity-80" />
        <Spinner />
      </div>
    );
  }
  return <>{children}</>;
}
