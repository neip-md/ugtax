import type { CompanyConfig } from "./engine";
import type { ProcessResults } from "./store-types";

/** One row in `public.profiles` - a user's saved company configuration. */
export type ProfileRow = {
  id: string;
  email: string | null;
  company_config: Partial<CompanyConfig>;
  updated_at: string;
  created_at: string;
};

/** One row in `public.filings` - a saved annual-statement snapshot. */
export type FilingRow = {
  id: string;
  user_id: string;
  fiscal_year: number;
  company_name: string | null;
  results: ProcessResults;
  created_at: string;
};

/** Payload used when inserting a new filing. */
export type FilingInsert = {
  fiscal_year: number;
  company_name: string | null;
  results: ProcessResults;
};
