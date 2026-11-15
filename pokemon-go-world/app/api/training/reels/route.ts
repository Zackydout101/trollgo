import { reels } from "../catalog";

/** The brainrot reels the training grounds play, one per local mp4. */
export function GET() {
  return Response.json({
    reels: reels(),
    blockSec: 15,
    note: "Stay in a session. Points per second climb every 15 seconds, with no cap.",
  });
}
