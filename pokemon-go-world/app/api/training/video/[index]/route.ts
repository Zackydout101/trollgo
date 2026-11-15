import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { REEL_DIR, videoFileAt } from "../../catalog";

/** Stream one training reel from the local brainrot folder, with range support. */
export async function GET(req: Request, ctx: { params: Promise<{ index: string }> }) {
  const { index } = await ctx.params;
  if (!/^\d+$/.test(index)) return new Response("bad reel", { status: 400 });

  const file = videoFileAt(Number(index));
  if (!file) return new Response("no training video", { status: 404 });

  const full = path.join(REEL_DIR, file);
  let size: number;
  try {
    size = statSync(full).size;
  } catch {
    return new Response("missing video", { status: 404 });
  }

  const common = {
    "content-type": "video/mp4",
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=3600",
  };

  const range = req.headers.get("range");
  const buf = readFileSync(full);
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    let start = match && match[1] ? parseInt(match[1], 10) : 0;
    let end = match && match[2] ? parseInt(match[2], 10) : size - 1;
    if (!Number.isFinite(start) || start < 0) start = 0;
    if (!Number.isFinite(end) || end >= size) end = size - 1;
    if (start > end) start = 0;
    const chunk = buf.subarray(start, end + 1);
    return new Response(chunk, {
      status: 206,
      headers: {
        ...common,
        "content-length": String(chunk.length),
        "content-range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  return new Response(buf, {
    status: 200,
    headers: { ...common, "content-length": String(size) },
  });
}
