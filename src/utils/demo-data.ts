// ============================================================================
// Demo Data Generator
// ----------------------------------------------------------------------------
// Creates 17 sample employees with realistic data including
// job titles, department levels, bonuses, LTIP, and mixed currencies.
// Used when someone clicks "Load Demo Data" to quickly populate the app.
//
// Also exports default pool budgets and default FX rates.
// ============================================================================

import type { Employee } from '../types';

// We omit `id` because Supabase generates it
type DemoEmployee = Omit<Employee, 'id'>;

export function generateDemoData(): DemoEmployee[] {
  return [
    // --- Sarah Mitchell's team (Marketing & Sales) ---
    {
      employee_id: 'EMP001', employee_name: 'Alex Thompson',
      slt_owner: 'Sarah Mitchell', department: 'Marketing',
      dept_level: 'L3', title: 'Marketing Manager', new_title: '', reports_to: 'Sarah Mitchell', location: 'New York', start_date: '2019-03-15',
      current_salary_usd: 78000, currency: 'USD', local_currency: 'USD', current_salary_local: 78000, new_salary_local: 78000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 78000,
      py_cash_bonus: 8000, py_stock_bonus: 3000, ltip: 0,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP002', employee_name: 'Rachel Kim',
      slt_owner: 'Sarah Mitchell', department: 'Marketing',
      dept_level: 'L4', title: 'Senior Marketing Manager', new_title: '', reports_to: 'Sarah Mitchell', location: 'New York', start_date: '2017-08-01',
      current_salary_usd: 92000, currency: 'USD', local_currency: 'USD', current_salary_local: 92000, new_salary_local: 92000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 92000,
      py_cash_bonus: 12000, py_stock_bonus: 5000, ltip: 10000,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP003', employee_name: 'David Chen',
      slt_owner: 'Sarah Mitchell', department: 'Sales',
      dept_level: 'L3', title: 'Account Executive', new_title: '', reports_to: 'Tom Bradley', location: 'Chicago', start_date: '2020-01-10',
      current_salary_usd: 85000, currency: 'USD', local_currency: 'USD', current_salary_local: 85000, new_salary_local: 85000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 85000,
      py_cash_bonus: 15000, py_stock_bonus: 0, ltip: 0,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP004', employee_name: 'Lisa Patel',
      slt_owner: 'Sarah Mitchell', department: 'Sales',
      dept_level: 'L2', title: 'Sales Associate', new_title: '', reports_to: 'Tom Bradley', location: 'London', start_date: '2021-06-20',
      current_salary_usd: 67000, currency: 'USD', local_currency: 'GBP', current_salary_local: 53000, new_salary_local: 53000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 67000,
      py_cash_bonus: 5000, py_stock_bonus: 0, ltip: 0,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP005', employee_name: 'Tom Bradley',
      slt_owner: 'Sarah Mitchell', department: 'Marketing',
      dept_level: 'L5', title: 'VP of Marketing', new_title: '', reports_to: 'Sarah Mitchell', location: 'New York', start_date: '2015-02-01',
      current_salary_usd: 105000, currency: 'USD', local_currency: 'USD', current_salary_local: 105000, new_salary_local: 105000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 105000,
      py_cash_bonus: 20000, py_stock_bonus: 15000, ltip: 25000,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP006', employee_name: 'Maria Garcia',
      slt_owner: 'Sarah Mitchell', department: 'Sales',
      dept_level: 'L2', title: 'Sales Coordinator', new_title: '', reports_to: 'Tom Bradley', location: 'Madrid', start_date: '2022-09-12',
      current_salary_usd: 73000, currency: 'USD', local_currency: 'EUR', current_salary_local: 67000, new_salary_local: 67000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 73000,
      py_cash_bonus: 4000, py_stock_bonus: 0, ltip: 0,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },

    // --- James Rodriguez's team (Engineering & Operations) ---
    {
      employee_id: 'EMP007', employee_name: "Ryan O'Brien",
      slt_owner: 'James Rodriguez', department: 'Engineering',
      dept_level: 'L4', title: 'Senior Software Engineer', new_title: '', reports_to: 'Samantha Lee', location: 'San Francisco', start_date: '2018-05-20',
      current_salary_usd: 125000, currency: 'USD', local_currency: 'USD', current_salary_local: 125000, new_salary_local: 125000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 125000,
      py_cash_bonus: 15000, py_stock_bonus: 20000, ltip: 15000,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP008', employee_name: 'Priya Sharma',
      slt_owner: 'James Rodriguez', department: 'Engineering',
      dept_level: 'L5', title: 'Staff Engineer', new_title: '', reports_to: 'Samantha Lee', location: 'Bangalore', start_date: '2016-11-01',
      current_salary_usd: 142000, currency: 'USD', local_currency: 'INR', current_salary_local: 11800000, new_salary_local: 11800000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 142000,
      py_cash_bonus: 18000, py_stock_bonus: 30000, ltip: 25000,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP009', employee_name: 'Michael Foster',
      slt_owner: 'James Rodriguez', department: 'Operations',
      dept_level: 'L3', title: 'Operations Analyst', new_title: '', reports_to: 'James Rodriguez', location: 'Dallas', start_date: '2020-07-15',
      current_salary_usd: 88000, currency: 'USD', local_currency: 'USD', current_salary_local: 88000, new_salary_local: 88000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 88000,
      py_cash_bonus: 7000, py_stock_bonus: 0, ltip: 0,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP010', employee_name: 'Jennifer Wu',
      slt_owner: 'James Rodriguez', department: 'Engineering',
      dept_level: 'L5', title: 'Engineering Manager', new_title: '', reports_to: 'Samantha Lee', location: 'San Francisco', start_date: '2017-03-01',
      current_salary_usd: 158000, currency: 'USD', local_currency: 'USD', current_salary_local: 158000, new_salary_local: 158000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 158000,
      py_cash_bonus: 22000, py_stock_bonus: 35000, ltip: 30000,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP011', employee_name: 'Daniel Brown',
      slt_owner: 'James Rodriguez', department: 'Operations',
      dept_level: 'L2', title: 'Operations Coordinator', new_title: '', reports_to: 'James Rodriguez', location: 'Toronto', start_date: '2021-04-10',
      current_salary_usd: 76000, currency: 'USD', local_currency: 'CAD', current_salary_local: 103000, new_salary_local: 103000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 76000,
      py_cash_bonus: 4000, py_stock_bonus: 0, ltip: 0,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP012', employee_name: 'Samantha Lee',
      slt_owner: 'James Rodriguez', department: 'Engineering',
      dept_level: 'L6', title: 'Director of Engineering', new_title: '', reports_to: 'James Rodriguez', location: 'San Francisco', start_date: '2014-09-01',
      current_salary_usd: 185000, currency: 'USD', local_currency: 'USD', current_salary_local: 185000, new_salary_local: 185000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 185000,
      py_cash_bonus: 30000, py_stock_bonus: 50000, ltip: 45000,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },

    // --- Karen Chen's team (Finance & HR) ---
    {
      employee_id: 'EMP013', employee_name: 'Emily Watson',
      slt_owner: 'Karen Chen', department: 'Finance',
      dept_level: 'L4', title: 'Senior Financial Analyst', new_title: '', reports_to: 'Amanda Rivera', location: 'London', start_date: '2018-01-15',
      current_salary_usd: 95000, currency: 'USD', local_currency: 'GBP', current_salary_local: 75000, new_salary_local: 75000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 95000,
      py_cash_bonus: 12000, py_stock_bonus: 8000, ltip: 10000,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP014', employee_name: 'Andrew Park',
      slt_owner: 'Karen Chen', department: 'Finance',
      dept_level: 'L3', title: 'Financial Analyst', new_title: '', reports_to: 'Amanda Rivera', location: 'New York', start_date: '2020-06-01',
      current_salary_usd: 82000, currency: 'USD', local_currency: 'USD', current_salary_local: 82000, new_salary_local: 82000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 82000,
      py_cash_bonus: 8000, py_stock_bonus: 3000, ltip: 0,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP015', employee_name: 'Nicole Turner',
      slt_owner: 'Karen Chen', department: 'HR',
      dept_level: 'L3', title: 'HR Business Partner', new_title: '', reports_to: 'Karen Chen', location: 'New York', start_date: '2019-09-20',
      current_salary_usd: 71000, currency: 'USD', local_currency: 'USD', current_salary_local: 71000, new_salary_local: 71000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 71000,
      py_cash_bonus: 6000, py_stock_bonus: 0, ltip: 0,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP016', employee_name: 'Christopher Davis',
      slt_owner: 'Karen Chen', department: 'HR',
      dept_level: 'L2', title: 'HR Coordinator', new_title: '', reports_to: 'Nicole Turner', location: 'Berlin', start_date: '2022-02-14',
      current_salary_usd: 64000, currency: 'USD', local_currency: 'EUR', current_salary_local: 59000, new_salary_local: 59000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 64000,
      py_cash_bonus: 3000, py_stock_bonus: 0, ltip: 0,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
    {
      employee_id: 'EMP017', employee_name: 'Amanda Rivera',
      slt_owner: 'Karen Chen', department: 'Finance',
      dept_level: 'L5', title: 'Finance Director', new_title: '', reports_to: 'Karen Chen', location: 'New York', start_date: '2016-04-01',
      current_salary_usd: 110000, currency: 'USD', local_currency: 'USD', current_salary_local: 110000, new_salary_local: 110000, next_salary_review_date: '2025-04-01',
      increase_percent: 0, new_salary_usd: 110000,
      py_cash_bonus: 18000, py_stock_bonus: 12000, ltip: 20000,
      change_reason: 'Merit Increase', promo_rationale: '', new_responsibilities: '', status: 'Pending', slt_submitted: false,
    },
  ];
}

// Default pool budgets for each SLT leader
export const DEFAULT_POOLS = [
  { slt_owner: 'Sarah Mitchell', pool_amount: 25000 },
  { slt_owner: 'James Rodriguez', pool_amount: 40000 },
  { slt_owner: 'Karen Chen', pool_amount: 20000 },
];

// Default FX rates (1 unit of currency = X USD)
export const DEFAULT_FX_RATES = [
  { currency_code: 'USD', rate_to_usd: 1.0 },
  { currency_code: 'EUR', rate_to_usd: 1.09 },
  { currency_code: 'GBP', rate_to_usd: 1.27 },
  { currency_code: 'JPY', rate_to_usd: 0.0067 },
  { currency_code: 'CAD', rate_to_usd: 0.74 },
  { currency_code: 'AUD', rate_to_usd: 0.66 },
  { currency_code: 'CHF', rate_to_usd: 1.13 },
  { currency_code: 'INR', rate_to_usd: 0.012 },
  { currency_code: 'SGD', rate_to_usd: 0.75 },
];
