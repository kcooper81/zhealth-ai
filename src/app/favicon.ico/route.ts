/**
 * Browsers auto-request /favicon.ico regardless of what's declared in <head>.
 * Serve the SVG bytes directly with image/svg+xml — modern browsers accept
 * SVG content at the .ico path.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

export function GET() {
  const svgPath = path.join(process.cwd(), "public", "favicon.svg");
  const body = readFileSync(svgPath);
  return new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
