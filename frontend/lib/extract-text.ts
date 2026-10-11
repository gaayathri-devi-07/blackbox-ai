"use client";

/**
 * Best-effort client-side text extraction for project write-ups.
 * Plain text and Markdown are read directly. For PDFs this pulls text operators
 * out of uncompressed content streams; scanned or compressed PDFs may yield
 * nothing, in which case the UI asks the user to paste the text instead.
 */

const MAX_BYTES = 5 * 1024 * 1024;

function decodePdfString(value: string) {
  const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
  return value
    .replace(/\\([nrtbf()\\])/g, (_m, c: string) => map[c] ?? c)
    .replace(/\\(\d{3})/g, (_m, o: string) => String.fromCharCode(parseInt(o, 8)));
}

function extractPdf(buffer: ArrayBuffer): string {
  const raw = new TextDecoder("latin1").decode(new Uint8Array(buffer));
  const chunks: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) chunks.push(decodePdfString(m[1]));
  for (const m of raw.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
    for (const item of m[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) chunks.push(decodePdfString(item[1]));
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

export async function extractText(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("File is larger than 5 MB.");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) return extractPdf(await file.arrayBuffer());
  return (await file.text()).trim();
}
