/**
 * Choices the screens make, kept out of the components so they can be stated
 * once and tested.
 */

/**
 * Choosing an アンテナ for the month.
 *
 * Two at a time. A third tap does nothing — it does not push the oldest choice
 * out to make room. That was tried first, on the theory that an unresponsive
 * control reads as broken, and it is worse: it removes something the person
 * deliberately chose without telling them, and the card that disappears is the
 * one they picked a moment ago. A tap that does not land is a smaller surprise
 * than a choice that vanishes, and the limit is on screen either way.
 *
 * Room is made by taking one off, which is a thing the person does on purpose.
 */
export function chooseAntenna<T extends string>(chosen: readonly T[], id: T, max: number): T[] {
  if (chosen.includes(id)) return chosen.filter((x) => x !== id);
  if (chosen.length >= max) return [...chosen];
  return [...chosen, id];
}
