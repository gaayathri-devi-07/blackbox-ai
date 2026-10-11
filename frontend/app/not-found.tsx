import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <BrandMark className="mx-auto size-7" />
        <p className="eyebrow mt-6">Error 404</p>
        <h1 className="mt-2 text-xl font-semibold">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">The link may be outdated, or the page may have moved during the redesign.</p>
        <Button className="mt-6" size="sm" asChild>
          <Link href="/home">Return to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
