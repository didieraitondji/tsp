/** Normalise une chaîne pour recherche insensible à la casse et aux accents. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
