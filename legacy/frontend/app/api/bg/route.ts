import { readFileSync } from "fs";
import { NextResponse } from "next/server";

export async function GET() {
  const paths = [
    process.cwd() + "\\public\\interstellarone.png",
    "C:\\Users\\gaaya\\AppData\\Local\\Temp\\copilot-image-7d9f66.png",
  ];

  for (const p of paths) {
    try {
      const buf = readFileSync(p);
      if (buf.length > 1000) {
        return new NextResponse(buf, {
          headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
        });
      }
    } catch {
      // try next
    }
  }

  return new NextResponse("Not found", { status: 404 });
}
