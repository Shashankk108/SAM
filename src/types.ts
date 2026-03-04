// ============================================================================
// SAM Type Definitions
// ----------------------------------------------------------------------------
// This file defines all the TypeScript types used across the SAM app.
// It also contains helper functions for formatting currencies and mapping
// database rows to our frontend Employee type.
//
// KEY CONCEPTS:
// - Employee: one row per person in the salary review table
// - SltPool: each SLT leader gets a budget they can allocate
// - FxRate: currency exchange rates for the current cycle
// - CustomColumn: HR-defined extra columns (like "Performance Rating")
// - SVP_KEYWORDS: titles that require pre-approval from Mark and Jay
// ============================================================================

// --- Roles & Stages ---

export type Role = 'HR Admin' | 'SLT User' | 'Finance Viewer';

// The four workflow stages a salary cycle moves through
export type Stage = 'draft' | 'allocation_open' | 'hr_review' | 'finalized';

// Change reason for a salary adjustment
export type ChangeReason = 'Merit Increase' | 'Promotion';

// Track where each employee is in the approval pipeline
export type EmployeeStatus = 'Pending' | 'SLT Submitted' | 'HR Approved' | 'Finalized';

// --- Main Employee Record ---
// Employee record matching the standard spreadsheet columns.
// "Total Comp Previous" and "Total Comp New" are COMPUTED in the UI, not stored.

export interface Employee {
  id: string;
  employee_id: string;        // External ID from UKG
  employee_name: string;      // Full name
  slt_owner: string;          // Which SLT leader reviews this person
  department: string;         // e.g., Marketing, Engineering
  dept_level: string;         // Department level
  title: string;              // Current job title BEFORE any promotion
  new_title: string;          // Post-promotion title (blank if no promotion)
  reports_to: string;         // Manager name
  location: string;           // Office/city
  start_date: string;         // Hire date (ISO string or empty)
  current_salary_usd: number; // Current annual salary in USD
  currency: string;           // Original currency code from UKG
  local_currency: string;     // The currency the employee is actually paid in
  current_salary_local: number;
  new_salary_local: number;
  next_salary_review_date: string;
  increase_percent: number;   // The "% Increase Input" column
  new_salary_usd: number;     // Auto-calculated: current * (1 + increase%)
  py_cash_bonus: number;      // Prior Year Cash Bonus
  py_stock_bonus: number;     // Prior Year Stock Bonus
  ltip: number;               // Long-Term Incentive Plan
  change_reason: ChangeReason;
  promo_rationale: string;    // Free text: why this person is being promoted
  new_responsibilities: string; // Free text: what they'll do in the new role
  status: EmployeeStatus;
  slt_submitted: boolean;
}

// --- Budget Pools ---

export interface SltPool {
  id?: string;
  slt_owner: string;
  pool_amount: number;
}

// --- FX Rates ---

export interface FxRate {
  id: string;
  currency_code: string;
  rate_to_usd: number;       // 1 unit of this currency = X USD
}

// --- Custom Columns ---
// HR Admin can add/remove these at any time. They show up as extra columns
// in the employee table and are included in CSV exports.

export interface CustomColumn {
  id: string;
  column_name: string;
  column_key: string;
  column_type: 'text' | 'number' | 'formula';
  sort_order: number;
  formula?: string;
  insert_after?: string;
}

export interface CustomColumnValue {
  id: string;
  column_id: string;
  employee_id: string;
  value: string;
}

// --- SVP Pre-Approval Detection ---
// If someone is being promoted to a title that contains any of these keywords,
// the system flags it with a warning: "SVP and above require pre-approval from Mark and Jay"

export const SVP_KEYWORDS = [
  'svp',
  'senior vice president',
  'evp',
  'executive vice president',
  'c-suite',
  'ceo', 'cfo', 'coo', 'cto', 'cmo', 'cio', 'cpo', 'cro',
  'chief',
  'president',
  'managing director',
];

// Check if a title string matches SVP-level or above
export function isSvpOrAbove(title: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase().trim();
  return SVP_KEYWORDS.some(keyword => lower.includes(keyword));
}

// --- Predefined Role Categories ---
// When an SLT member selects "Promotion", they can pick from these categories.
// They can also type a custom title if their role isn't in this list.

export const ROLE_CATEGORIES = [
  'Analyst',
  'Senior Analyst',
  'Associate',
  'Senior Associate',
  'Manager',
  'Senior Manager',
  'Director',
  'Senior Director',
  'VP',
  'SVP',
  'EVP',
  'Managing Director',
  'Partner',
  'Principal',
  'Developer',
  'Senior Developer',
  'Staff Engineer',
  'Lead Engineer',
  'Engineering Manager',
  'Architect',
];

// --- Constants ---

export const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'SGD',
  'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'ZAR', 'BRL', 'MXN', 'KRW', 'AED',
];

export const STAGE_LABELS: Record<Stage, string> = {
  draft: 'Draft',
  allocation_open: 'Open for SLT Allocation',
  hr_review: 'HR Review',
  finalized: 'Finalized',
};

export const STAGES: Stage[] = ['draft', 'allocation_open', 'hr_review', 'finalized'];

// --- Formatting Helpers ---

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencySafe(amount: number, currency = 'USD'): string {
  try {
    return formatCurrency(amount, currency);
  } catch {
    return `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
}

// --- Total Compensation Calculators ---
// These are computed on the fly, not stored in the database.
// Total Comp = Salary + PY Cash Bonus + PY Stock Bonus + LTIP

export function totalCompPrevious(e: Employee): number {
  return e.current_salary_usd + e.py_cash_bonus + e.py_stock_bonus + e.ltip;
}

export function totalCompNew(e: Employee): number {
  return e.new_salary_usd + e.py_cash_bonus + e.py_stock_bonus + e.ltip;
}

// --- Database Row Mapper ---
// Converts a raw Supabase row (unknown types) into our typed Employee object.
// Any missing fields get sensible defaults so older data still works.

export function mapDbEmployee(e: Record<string, unknown>): Employee {
  return {
    id: e.id as string,
    employee_id: e.employee_id as string,
    employee_name: e.employee_name as string,
    slt_owner: e.slt_owner as string,
    department: e.department as string,
    dept_level: (e.dept_level as string) || '',
    title: (e.title as string) || '',
    new_title: (e.new_title as string) || '',
    reports_to: (e.reports_to as string) || '',
    location: (e.location as string) || '',
    start_date: (e.start_date as string) || '',
    current_salary_usd: Number(e.current_salary_usd),
    currency: (e.currency as string) || 'USD',
    local_currency: (e.local_currency as string) || 'USD',
    current_salary_local: Number(e.current_salary_local) || Number(e.current_salary_usd),
    new_salary_local: Number(e.new_salary_local) || Number(e.new_salary_usd),
    next_salary_review_date: (e.next_salary_review_date as string) || '',
    increase_percent: Number(e.increase_percent),
    new_salary_usd: Number(e.new_salary_usd),
    py_cash_bonus: Number(e.py_cash_bonus) || 0,
    py_stock_bonus: Number(e.py_stock_bonus) || 0,
    ltip: Number(e.ltip) || 0,
    change_reason: e.change_reason as ChangeReason,
    promo_rationale: (e.promo_rationale as string) || '',
    new_responsibilities: (e.new_responsibilities as string) || '',
    status: e.status as EmployeeStatus,
    slt_submitted: e.slt_submitted as boolean,
  };
}
