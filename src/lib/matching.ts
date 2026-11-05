import { sql } from "../db";

/* ──────────────────────────────────────────────────────────────
 * Contractor job routing (automatic matching)
 *
 * When a customer books a service we pick the best-fitted vetted
 * contractor for the job. Matching is a two-part filter:
 *
 *   1. Contractor is ready to receive work — `status IN ('active','approved')`.
 *      `applied`/`verified` contractors are still in vetting (or have never
 *      been approved to take jobs) and `rejected`/`inactive` ones must not be
 *      routed work, so only the two "cleared for work" states are candidates.
 *   2. Contractor does the requested service type (kebab-case id, e.g. `repairs`).
 *
 * Location: `contractors.tn_counties` is a TEXT[]. A contractor with an empty
 * array (`'{}'`, the column default) covers all of Tennessee; otherwise the
 * booking's county has to be listed. County matching ignores case/whitespace so
 * "Davidson", "davidson" and " Davidson " are the same county.
 *
 * Among the candidates that pass both filters we choose the one with the fewest
 * currently-open jobs (status pending/accepted/in_progress), tie-broken by the
 * lowest contractor id. That makes routing deterministic — the same request
 * always lands on the same contractor, and the load spreads across the pool.
 * ────────────────────────────────────────────────────────────── */

/** Statuses that mean a contractor is vetted/ready to be given work. */
export const ASSIGNABLE_CONTRACTOR_STATUSES = ["active", "approved"] as const;

/** Job statuses that count as "currently open" for load balancing. */
export const OPEN_JOB_STATUSES = ["pending", "accepted", "in_progress"] as const;

export type MatchInput = {
  serviceType: string;
  tnCounty: string | null | undefined;
  /** Optional existing query handle (Neon `sql()`) to reuse inside a server fn. */
  q?: ReturnType<typeof sql>;
};

export type ContractorCandidate = {
  id: number;
  openJobs: number;
};

/**
 * Pure tie-break: fewest open jobs first, then lowest id. Kept separate from the
 * SQL so the ordering rule can be exercised without a database.
 */
export function pickBestContractor(
  candidates: readonly ContractorCandidate[],
): ContractorCandidate | null {
  let best: ContractorCandidate | null = null;
  for (const c of candidates) {
    if (
      best === null ||
      c.openJobs < best.openJobs ||
      (c.openJobs === best.openJobs && c.id < best.id)
    ) {
      best = c;
    }
  }
  return best;
}

function normalizeCounty(county: string | null | undefined): string {
  return (county ?? "").trim().toLowerCase();
}

/**
 * Find the contractor that should be assigned to a booking.
 * Returns `contractors.id` or `null` when nobody matches (the job then stays
 * unassigned and the request stays `new` for manual/admin routing).
 */
export async function findContractorForRequest({
  serviceType,
  tnCounty,
  q,
}: MatchInput): Promise<number | null> {
  if (!serviceType) return null;
  const query = q ?? sql();
  const county = normalizeCounty(tnCounty);

  // Candidates: cleared-for-work contractors that do this service type and
  // either cover the whole state (empty tn_counties) or list this county.
  // The subquery counts currently-open jobs for the load-balancing tie-break;
  // ordering happens in the pure picker below (LIMIT bounds the payload).
  const rows = await query`
    SELECT c.id AS id,
           (
             SELECT COUNT(*)::int FROM jobs j
             WHERE j.contractor_id = c.id
               AND j.status IN ('pending', 'accepted', 'in_progress')
           ) AS open_jobs
    FROM contractors c
    WHERE c.status IN ('active', 'approved')
      AND c.service_type = ${serviceType}
      AND (
        COALESCE(cardinality(c.tn_counties), 0) = 0
        OR EXISTS (
          SELECT 1 FROM unnest(c.tn_counties) AS county
          WHERE lower(trim(county)) = ${county}
        )
      )
    LIMIT 50`;

  const candidates: ContractorCandidate[] = rows.map((r) => ({
    id: r.id as number,
    openJobs: Number(r.open_jobs ?? 0),
  }));

  return pickBestContractor(candidates)?.id ?? null;
}
