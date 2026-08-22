/**
 * Asking for a frame, from code that is nowhere near the renderer.
 *
 * On the lighter workload presets the scene is drawn on demand rather than
 * continuously, which means anything that changes what the table looks like has
 * to say so. The things that change it are mostly *not* in the GL tree — a
 * finger on the gesture handler, a setter in the session store — and none of
 * them can reach react-three-fiber's `invalidate`.
 *
 * So the canvas leaves it here when it mounts, and everything else calls
 * `requestRedraw()` without knowing whether a renderer exists at all. Before the
 * canvas mounts, or after it goes, the call is a no-op rather than an error:
 * asking to redraw a scene that is not there is not a mistake, it is just
 * nothing to do.
 */

let invalidate: (() => void) | null = null;

/** Called by the canvas as it mounts, and with `null` as it unmounts. */
export function setRedrawHandle(fn: (() => void) | null): void {
  invalidate = fn;
}

/**
 * Ask for one more frame.
 *
 * Safe to call as often as you like: react-three-fiber coalesces requests made
 * within the same frame, so a drag that calls this sixty times a second costs
 * sixty frames, not sixty renders per frame.
 *
 * Safe to call when the scene renders continuously, too — there it is simply
 * redundant, because a frame was coming anyway.
 */
export function requestRedraw(): void {
  invalidate?.();
}
