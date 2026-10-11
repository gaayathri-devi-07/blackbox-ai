import { Suspense } from "react";
import type { Metadata } from "next";
import { Landing } from "./landing";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Bridge the gap between practice and performance: adaptive mock interviews, AI group discussions and a curated practice bank, built around your career path.",
};

export default function LoginPage() {
  // The landing reads ?next= to open the sign-in dialog, which needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#061a13]" />}>
      <Landing />
    </Suspense>
  );
}
