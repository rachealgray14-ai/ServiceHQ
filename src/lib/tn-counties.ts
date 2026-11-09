/**
 * The 95 Tennessee counties, stored as plain county names (no "County" suffix)
 * in alphabetical order.
 *
 * This is the one canonical spelling used across the product:
 *   - `customers.tn_county` (a booking's county)
 *   - `contractors.tn_counties` (the counties a contractor serves)
 * Matching in `src/lib/matching.ts` compares them case-insensitively after
 * trimming, so `Davidson` here always matches a booking stored as `Davidson`.
 */
export const TN_COUNTIES = [
  "Anderson", "Bedford", "Benton", "Bledsoe", "Blount", "Bradley", "Campbell",
  "Cannon", "Carroll", "Carter", "Cheatham", "Chester", "Claiborne", "Clay",
  "Cocke", "Coffee", "Crockett", "Cumberland", "Davidson", "Decatur", "DeKalb",
  "Dickson", "Dyer", "Fayette", "Fentress", "Franklin", "Gibson", "Giles",
  "Grainger", "Greene", "Grundy", "Hamblen", "Hamilton", "Hancock", "Hardeman",
  "Hardin", "Hawkins", "Haywood", "Henderson", "Henry", "Hickman", "Houston",
  "Humphreys", "Jackson", "Jefferson", "Johnson", "Knox", "Lake", "Lauderdale",
  "Lawrence", "Lewis", "Lincoln", "Loudon", "Macon", "Madison", "Marion",
  "Marshall", "Maury", "McMinn", "McNairy", "Meigs", "Monroe", "Montgomery",
  "Moore", "Morgan", "Obion", "Overton", "Perry", "Pickett", "Polk", "Putnam",
  "Rhea", "Roane", "Robertson", "Rutherford", "Scott", "Sequatchie", "Sevier",
  "Shelby", "Smith", "Stewart", "Sullivan", "Sumner", "Tipton", "Trousdale",
  "Unicoi", "Union", "Van Buren", "Warren", "Washington", "Wayne", "Weakley",
  "White", "Williamson", "Wilson",
] as const;

export type TNCounty = (typeof TN_COUNTIES)[number];

/**
 * Map an arbitrary county-ish string onto the canonical spelling above.
 * Accepts "davidson", " Davidson County " and "DAVIDSON" — all become
 * "Davidson". Returns null for anything that is not a Tennessee county, so
 * callers can reject junk instead of storing it.
 */
export function normalizeCountyName(raw: unknown): TNCounty | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+county$/i, "")
    .trim()
    .toLowerCase();
  if (!cleaned) return null;
  return TN_COUNTIES.find((c) => c.toLowerCase() === cleaned) ?? null;
}

/**
 * Normalize a list of county strings to canonical names: unknown entries are
 * dropped, duplicates collapse, and the result stays in TN_COUNTIES order.
 * An empty result means "the applicant told us nothing usable".
 */
export function normalizeCountyList(raw: unknown): TNCounty[] {
  const list = Array.isArray(raw) ? raw : [];
  const wanted = new Set(
    list.map((v) => normalizeCountyName(v)).filter((v): v is TNCounty => v !== null),
  );
  return TN_COUNTIES.filter((c) => wanted.has(c));
}

/**
 * Build a Postgres `text[]` literal (e.g. `{"Van Buren","Davidson"}`) for
 * columns like `contractors.tn_counties`. The Neon HTTP driver does not
 * reliably serialize a JS array into `text[]`, so the caller binds this string
 * and casts it: `${literal}::text[]`.
 */
export function toPgTextArray(values: readonly string[]): string {
  const escaped = values.map(
    (v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
  );
  return `{${escaped.join(",")}}`;
}
