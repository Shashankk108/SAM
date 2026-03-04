// ============================================================================
// CSV Import / Export Utilities
// ----------------------------------------------------------------------------
// Handles:
// 1. Parsing uploaded CSV files into Employee objects
// 2. Exporting the full employee table as a UKG-ready CSV
// 3. Exporting a blank template CSV (so users know what columns to fill in)
//
// The export format matches the standard original Excel headers:
//   Dept Level, Department, Employee #, Employee Name, Title, New Title,
//   Reports To, Location, Currency, Start Date, Current Salary,
//   % Increase Input, New Salary, Increase $, PY Cash Bonus,
//   PY Stock Bonus, LTIP, Total Comp - Previous, Total Comp - New,
//   Change Reason, Promo Rationale, New Responsibilities,
//   ... plus any HR-added custom columns
// ============================================================================

import type { Employee, CustomColumn } from '../types';
import { totalCompPrevious, totalCompNew } from '../types';

// --- CSV Line Parser ---
// Handles quoted fields that may contain commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Find a column value by matching header name (case-insensitive, ignoring spaces/dashes)
function getField(values: string[], headers: string[], fieldName: string): string {
  const normalize = (s: string) => s.replace(/[\s_\-#%]+/g, '').toLowerCase();
  const target = normalize(fieldName);
  const index = headers.findIndex(h => normalize(h) === target);
  return index >= 0 ? (values[index] || '') : '';
}

// --- CSV Import ---
// Takes raw CSV text, returns an array of Employee objects (without `id` since DB generates that).
// This is flexible enough to handle the standard old Excel exports as well as our own templates.

export function parseCSV(text: string): Omit<Employee, 'id'>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);

  return lines.slice(1).filter(line => line.trim()).map(line => {
    const v = parseCSVLine(line);

    // Try multiple possible header names for each field (handles the standard format + ours)
    const currentSalary = parseFloat(getField(v, headers, 'CurrentSalaryUSD') || getField(v, headers, 'CurrentSalary')) || 0;
    const increasePct = parseFloat(getField(v, headers, 'IncreaseInput') || getField(v, headers, 'ProposedIncreasePercent') || getField(v, headers, 'IncreasePercent')) || 0;
    const localCurrency = getField(v, headers, 'LocalCurrency') || getField(v, headers, 'Currency') || 'USD';
    const currentLocal = parseFloat(getField(v, headers, 'CurrentSalaryLocal')) || currentSalary;
    const empName = getField(v, headers, 'EmployeeName') ||
      [getField(v, headers, 'FirstName'), getField(v, headers, 'LastName')].filter(Boolean).join(' ');

    return {
      employee_id: getField(v, headers, 'EmployeeId') || getField(v, headers, 'Employee'),
      employee_name: empName,
      slt_owner: getField(v, headers, 'SLTOwner') || getField(v, headers, 'ReportsTo'),
      department: getField(v, headers, 'Department'),
      dept_level: getField(v, headers, 'DeptLevel'),
      title: getField(v, headers, 'Title'),
      new_title: getField(v, headers, 'NewTitle'),
      reports_to: getField(v, headers, 'ReportsTo'),
      location: getField(v, headers, 'Location'),
      start_date: getField(v, headers, 'StartDate'),
      current_salary_usd: currentSalary,
      currency: localCurrency,
      local_currency: localCurrency,
      current_salary_local: currentLocal,
      new_salary_local: Math.round(currentLocal * (1 + increasePct / 100) * 100) / 100,
      next_salary_review_date: getField(v, headers, 'NextSalaryReviewDate'),
      increase_percent: increasePct,
      new_salary_usd: Math.round(currentSalary * (1 + increasePct / 100) * 100) / 100,
      py_cash_bonus: parseFloat(getField(v, headers, 'PYCashBonus')) || 0,
      py_stock_bonus: parseFloat(getField(v, headers, 'PYStockBonus')) || 0,
      ltip: parseFloat(getField(v, headers, 'LTIP')) || 0,
      change_reason: (getField(v, headers, 'ChangeReason') as 'Merit Increase' | 'Promotion') || 'Merit Increase',
      promo_rationale: getField(v, headers, 'PromoRationale'),
      new_responsibilities: getField(v, headers, 'NewResponsibilities'),
      status: 'Pending' as const,
      slt_submitted: false,
    };
  });
}

// --- Helper: trigger browser download ---
function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Escape a value for CSV ---
function esc(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// --- Full Data Export ---
// Exports all employees with the standard column headers + any custom columns.
// This is the file that gets uploaded to UKG or used as a reporting artifact.

export function exportUKGTemplate(
  employees: Employee[],
  customColumns: CustomColumn[] = [],
  columnValues: Record<string, Record<string, string>> = {}
): void {
  const headers = [
    'Dept Level',
    'Department',
    'Employee #',
    'Employee Name',
    'Title',
    'New Title',
    'Reports To',
    'Location',
    'Currency',
    'Start Date',
    'Current Salary',
    '% Increase Input',
    'New Salary',
    'Increase $',
    'PY Cash Bonus',
    'PY Stock Bonus',
    'LTIP',
    'Total Comp - Previous',
    'Total Comp - New',
    'Change Reason',
    'Promo Rationale',
    'New Responsibilities',
    'Status',
    'SLT Owner',
    ...customColumns.map(c => c.column_name),
  ];

  const rows = employees.map(e => {
    const increase = e.new_salary_usd - e.current_salary_usd;
    return [
      esc(e.dept_level),
      esc(e.department),
      esc(e.employee_id),
      esc(e.employee_name),
      esc(e.title),
      esc(e.new_title),
      esc(e.reports_to),
      esc(e.location),
      e.local_currency,
      e.start_date,
      e.current_salary_usd.toFixed(2),
      e.increase_percent.toFixed(2),
      e.new_salary_usd.toFixed(2),
      increase.toFixed(2),
      e.py_cash_bonus.toFixed(2),
      e.py_stock_bonus.toFixed(2),
      e.ltip.toFixed(2),
      totalCompPrevious(e).toFixed(2),
      totalCompNew(e).toFixed(2),
      esc(e.change_reason),
      esc(e.promo_rationale),
      esc(e.new_responsibilities),
      e.status,
      esc(e.slt_owner),
      ...customColumns.map(c => esc(columnValues[c.id]?.[e.id] || '')),
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  downloadCSV(csv, 'sam_ukg_upload_template.csv');
}

// --- Blank Template Export ---
// An empty CSV with just the headers, so users know what columns to fill in.
// Includes any HR-added custom columns.

export function exportBlankTemplate(customColumns: CustomColumn[] = []): void {
  const headers = [
    'Dept Level',
    'Department',
    'Employee #',
    'Employee Name',
    'Title',
    'Reports To',
    'Location',
    'Currency',
    'Start Date',
    'Current Salary',
    'PY Cash Bonus',
    'PY Stock Bonus',
    'LTIP',
    'SLT Owner',
    ...customColumns.map(c => c.column_name),
  ];

  const csv = headers.join(',') + '\n';
  downloadCSV(csv, 'sam_upload_blank_template.csv');
}
