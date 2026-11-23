// The reader scrolls the window. Jumps, resume and zoom scroll it too; those
// shouldn't hide the toolbar the way reading down does, so they're marked.
let programmaticUntil = 0;

export function scrollWindowTo(top: number) {
  programmaticUntil = performance.now() + 120;
  window.scrollTo({ top, behavior: "instant" });
}

export const isProgrammaticScroll = () => performance.now() < programmaticUntil;

/** Height of the fixed toolbar: content below it counts as "in view". */
export const TOP_INSET = 64;
