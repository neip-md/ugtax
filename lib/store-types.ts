import type { CompanyConfig } from "./engine";

export type TransactionItem = {
  date: string;
  amount: string;
  direction: "credit" | "debit";
  counterparty: string;
  reference: string;
  raw_code?: string;
  account?: string;
  account_name?: string;
  description?: string;
  source?: string;
};

export type ProcessResults = {
  bilanz: {
    aktiva: Record<string, number>;
    passiva: Record<string, number>;
    summeAktiva: number;
    summePassiva: number;
    isBalanced: boolean;
  };
  guv: {
    aufwendungen: Record<string, number>;
    ertraege: Record<string, number>;
    summeAufwendungen: number;
    summeErtraege: number;
    jahresueberschuss: number;
  };
  journalEntryCount: number;
  warnings: string[];
  fiscalYear: number;
  companyName: string;
};

export type { CompanyConfig };
