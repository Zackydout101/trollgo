/** setPointerCapture throws if the pointer is already gone (fast taps, synthetic events). */
export function capturePointer(e: { target: EventTarget; pointerId: number }) {
  try {
    (e.target as Element).setPointerCapture(e.pointerId);
  } catch {
    /* pointer no longer active */
  }
}
