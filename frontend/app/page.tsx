"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { BrandMark } from "@/components/brand";
import { Spinner } from "@/components/ui/primitives";

/** Entry point: route by session state. */
export default function Root() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-in") router.replace("/home");
    else if (status === "signed-out") router.replace("/login");
  }, [status, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4" aria-busy="true">
      <BrandMark className="size-7 opacity-80" />
      <Spinner />
    </div>
  );
}
