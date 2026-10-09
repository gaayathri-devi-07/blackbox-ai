"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/landing");
  }, [router]);
  
  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-[#080808] flex items-center justify-center transition-colors duration-300">
      <div className="text-gray-900 dark:text-white text-xl">Loading...</div>
    </div>
  );
}
