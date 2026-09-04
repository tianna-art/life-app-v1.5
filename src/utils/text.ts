/** One-line preview for the LIST rows: `09/04  新しい企画の…`. */
export function toSingleLine(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

/**
 * Truncate with the ellipsis character required by the spec.
 * Never truncates mid-surrogate-pair.
 */
export function truncate(body: string, max = 28): string {
  const line = toSingleLine(body);
  const chars = Array.from(line);
  if (chars.length <= max) return line;
  return `${chars.slice(0, max).join('')}…`;
}
