/** RFC-4122-shaped v4 id. Used for optimistic rows and the local store. */
export function uuid(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Stable slug for a user-created category name. */
export function slugify(name: string): string {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii.length > 0) return ascii;
  // Japanese (and other non-latin) names get a stable hashed slug instead.
  let hash = 5381;
  for (let i = 0; i < name.length; i += 1) hash = ((hash << 5) + hash + name.charCodeAt(i)) >>> 0;
  return `c-${hash.toString(36)}`;
}
