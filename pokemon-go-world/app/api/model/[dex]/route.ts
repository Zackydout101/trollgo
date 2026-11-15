import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const SOURCE = "https://raw.githubusercontent.com/Sudhanshu-Ambastha/Pokemon-3D-api/main/models/opt/regular";
// Vercel's deployment filesystem is read-only; only the OS temp dir is writable there.
const CACHE_DIR = process.env.VERCEL
  ? path.join(tmpdir(), "models")
  : path.join(process.cwd(), ".cache", "models");

const headers = {
  "Content-Type": "model/gltf-binary",
  "Cache-Control": "public, max-age=31536000, immutable",
};

/** Proxies a Pokémon model from GitHub and keeps a copy on disk so every model is downloaded only once. */
export async function GET(_req: Request, ctx: { params: Promise<{ dex: string }> }) {
  const { dex } = await ctx.params;
  if (!/^\d{1,4}$/.test(dex)) return new Response("bad dex", { status: 400 });
  const file = path.join(CACHE_DIR, `${dex}.glb`);

  try {
    return new Response(new Uint8Array(await readFile(file)), { headers });
  } catch {
    /* not cached yet */
  }

  const upstream = await fetch(`${SOURCE}/${dex}.glb`);
  if (!upstream.ok) return new Response("model not found", { status: upstream.status === 404 ? 404 : 502 });
  const buf = new Uint8Array(await upstream.arrayBuffer());
  await mkdir(CACHE_DIR, { recursive: true })
    .then(() => writeFile(file, buf))
    .catch(() => {});
  return new Response(buf, { headers });
}
