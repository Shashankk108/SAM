import type { Employee } from '../types';

const FIELD_MAP: Record<string, keyof Employee> = {
  current_salary: 'current_salary_usd',
  new_salary: 'new_salary_usd',
  increase_percent: 'increase_percent',
  py_cash_bonus: 'py_cash_bonus',
  py_stock_bonus: 'py_stock_bonus',
  ltip: 'ltip',
  current_salary_local: 'current_salary_local',
  new_salary_local: 'new_salary_local',
};

export interface PresetFormula {
  label: string;
  formula: string;
  description: string;
}

export const PRESET_FORMULAS: PresetFormula[] = [
  {
    label: 'Salary Increase ($)',
    formula: 'new_salary - current_salary',
    description: 'Difference between new and current salary',
  },
  {
    label: 'Increase as % of Total Comp',
    formula: '((new_salary - current_salary) / (current_salary + py_cash_bonus + py_stock_bonus + ltip)) * 100',
    description: 'Salary increase as a percentage of total previous comp',
  },
  {
    label: 'Total Comp (New)',
    formula: 'new_salary + py_cash_bonus + py_stock_bonus + ltip',
    description: 'New salary plus all bonus components',
  },
  {
    label: 'Total Comp Change ($)',
    formula: '(new_salary + py_cash_bonus + py_stock_bonus + ltip) - (current_salary + py_cash_bonus + py_stock_bonus + ltip)',
    description: 'Delta between new and previous total compensation',
  },
  {
    label: 'Cash to Equity Ratio',
    formula: '(new_salary + py_cash_bonus) / (py_stock_bonus + ltip + 1)',
    description: 'Ratio of cash comp to equity comp (avoids div by 0)',
  },
  {
    label: 'Bonus as % of Salary',
    formula: '((py_cash_bonus + py_stock_bonus) / current_salary) * 100',
    description: 'Total bonus as a percentage of current base salary',
  },
];

function tokenize(formula: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (let i = 0; i < formula.length; i++) {
    const ch = formula[i];
    if ('+-*/()'.includes(ch)) {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(ch);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

export function evaluateFormula(
  formula: string,
  employee: Employee,
  columnValues: Record<string, Record<string, string>>,
  customColumnMap: Record<string, string>,
): number | null {
  if (!formula.trim()) return null;

  try {
    const tokens = tokenize(formula);
    const resolved = tokens.map(token => {
      if ('+-*/()'.includes(token)) return token;

      const num = parseFloat(token);
      if (!isNaN(num)) return String(num);

      const fieldKey = FIELD_MAP[token];
      if (fieldKey) {
        const val = employee[fieldKey];
        return String(Number(val) || 0);
      }

      if (customColumnMap[token]) {
        const colId = customColumnMap[token];
        const val = columnValues[colId]?.[employee.id] || '0';
        return String(parseFloat(val) || 0);
      }

      return '0';
    });

    const expression = resolved.join(' ');
    if (!/^[\d\s+\-*/.()]+$/.test(expression)) return null;

    const result = Function(`"use strict"; return (${expression})`)();
    if (typeof result !== 'number' || !isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

export function getFormulaFields(formula: string): string[] {
  const tokens = tokenize(formula);
  return tokens.filter(t => {
    if ('+-*/()'.includes(t)) return false;
    if (!isNaN(parseFloat(t))) return false;
    return true;
  });
}
