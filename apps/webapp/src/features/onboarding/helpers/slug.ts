/**
 * Derives a URL-safe organization slug from a workspace name: lowercase,
 * diacritics stripped, non-alphanumerics collapsed to single dashes.
 * Falls back to "workspace" when nothing usable remains (e.g. emoji-only).
 */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    // Combining marks left over from NFKD (é -> e + U+0301).
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug.length > 0 ? slug : 'workspace';
}
