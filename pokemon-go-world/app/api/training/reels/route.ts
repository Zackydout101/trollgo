import { reels } from "../catalog";

/** The brainrot reels the training grounds play, one per local mp4. */
export function GET() {
  return Response.json({
    reels: reels(),
    note: "Scroll the feed. Every reel you scroll to is worth more points than the last, with no cap. The feed loops forever.",
  });
}
