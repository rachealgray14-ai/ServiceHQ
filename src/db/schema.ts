import { readFile } from "node:fs/promises";
import { sql } from "../db";

/** Creates the ServiceHQ schema and imports the legacy newline-delimited JSON files. */
export async function ensureDatabaseSchema() {
  const query = sql();
  await query`CREATE TABLE IF NOT EXISTS contractors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    service_type TEXT NOT NULL,
    years_experience INTEGER,
    license_number TEXT,
    insurance_info TEXT,
    status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','verified','approved','rejected','active','inactive')),
    service_radius_miles INTEGER NOT NULL DEFAULT 25,
    tn_counties TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await query`CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    tn_county TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await query`CREATE TABLE IF NOT EXISTS service_requests (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    service_type TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','assigned','scheduled','in_progress','completed','cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await query`CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    contractor_id INTEGER NOT NULL REFERENCES contractors(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','in_progress','completed','cancelled','disputed')),
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    price_quoted DECIMAL(12,2),
    price_final DECIMAL(12,2),
    platform_fee_pct DECIMAL(5,2) NOT NULL DEFAULT 17.5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await query`CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('customer_payment','contractor_payout','refund')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
    stripe_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await query`CREATE TABLE IF NOT EXISTS disputes (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    raised_by TEXT NOT NULL CHECK (raised_by IN ('customer','contractor')),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved','closed')),
    resolution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await importLegacyData(query);
}

async function readLegacyRecords(path: string): Promise<Record<string, unknown>[]> {
  try {
    const text = await readFile(path, "utf8");
    if (!text.trim()) return [];
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    return [parsed as Record<string, unknown>];
  } catch {
    // Legacy files are optional (and may not exist in deployed environments).
    try {
      const text = await readFile(path, "utf8");
      return text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const number = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
};

async function importLegacyData(query: ReturnType<typeof sql>) {
  const requests = await readLegacyRecords("/home/team/shared/service-requests.json");
  for (const record of requests) {
    const name = text(record.name), email = text(record.email), phone = text(record.phone);
    const serviceType = text(record.serviceType ?? record.service_type);
    const message = text(record.message);
    if (!name || !email || !phone || !serviceType || !message) continue;
    await query`INSERT INTO service_requests (name, email, phone, service_type, message)
      SELECT ${name}, ${email}, ${phone}, ${serviceType}, ${message}
      WHERE NOT EXISTS (SELECT 1 FROM service_requests WHERE email = ${email} AND created_at = ${text(record.submittedAt) || null}::timestamptz)`;
  }
  const applications = await readLegacyRecords("/home/team/shared/contractor-applications.json");
  for (const record of applications) {
    const name = text(record.name), company = text(record.companyName ?? record.company_name);
    const email = text(record.email), phone = text(record.phone), serviceType = text(record.serviceType ?? record.service_type);
    if (!name || !company || !email || !phone || !serviceType) continue;
    await query`INSERT INTO contractors (name, company_name, email, phone, service_type, years_experience, license_number)
      SELECT ${name}, ${company}, ${email}, ${phone}, ${serviceType}, ${number(record.yearsExperience)}, ${text(record.licenseNumber) || null}
      WHERE NOT EXISTS (SELECT 1 FROM contractors WHERE email = ${email} AND company_name = ${company})`;
  }
}
