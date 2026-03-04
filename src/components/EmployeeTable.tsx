import { useState, useEffect, useRef, useMemo } from 'react';
import { Lock, AlertTriangle, Trash2, ChevronDown, ChevronUp, Check, Eye } from 'lucide-react';
import type { Employee, Role, Stage, ChangeReason, CustomColumn, FxRate } from '../types';
import { formatCurrency, formatCurrencySafe, totalCompPrevious, totalCompNew, isSvpOrAbove, ROLE_CATEGORIES } from '../types';
import { evaluateFormula } from '../utils/formula';

interface EmployeeTableProps {
  employees: Employee[];
  role: Role;
  stage: Stage;
  selectedSltOwner: string;
  onUpdateEmployee: (id: string, updates: Partial<Employee>) => void;
  customColumns: CustomColumn[];
  columnValues: Record<string, Record<string, string>>;
  onUpdateColumnValue: (columnId: string, employeeId: string, value: string) => void;
  onRemoveColumn: (columnId: string) => void;
  fxRates: FxRate[];
}

function FxTooltip({ employee, fxRates, usdAmount, role, children }: {
  employee: Employee;
  fxRates: FxRate[];
  usdAmount: number;
  role: Role;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  if (role !== 'HR Admin' || employee.local_currency === 'USD') return <>{children}</>;
  const rate = fxRates.find(r => r.currency_code === employee.local_currency);
  if (!rate) return <>{children}</>;
  const localAmount = rate.rate_to_usd > 0 ? Math.round(usdAmount / rate.rate_to_usd) : usdAmount;

  return (
    <span
      className="relative cursor-help border-b border-dashed border-slate-300"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2.5 bg-slate-800 text-white text-[11px] rounded-lg shadow-xl z-50 whitespace-nowrap pointer-events-none min-w-[180px]">
          <p className="font-semibold text-slate-200 mb-1.5">FX Conversion Breakdown</p>
          <div className="space-y-0.5">
            <p>{formatCurrencySafe(localAmount, employee.local_currency)} <span className="text-slate-400">({employee.local_currency})</span></p>
            <p className="text-slate-400">x {rate.rate_to_usd.toFixed(4)} rate to USD</p>
            <div className="border-t border-slate-600 mt-1.5 pt-1.5">
              <p className="font-semibold text-emerald-300">= {formatCurrency(usdAmount)} USD</p>
            </div>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-600',
  'SLT Submitted': 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  'HR Approved': 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  Finalized: 'bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200',
};

const MIN_CHARS = 10;

export default function EmployeeTable({
  employees,
  role,
  stage,
  selectedSltOwner,
  onUpdateEmployee,
  customColumns,
  columnValues,
  onUpdateColumnValue,
  onRemoveColumn,
  fxRates,
}: EmployeeTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [detailRows, setDetailRows] = useState<Set<string>>(new Set());
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const prevReasonsRef = useRef<Map<string, ChangeReason> | null>(null);

  const customColumnMap = useMemo(() => {
    const map: Record<string, string> = {};
    customColumns.forEach(c => { map[c.column_key] = c.id; });
    return map;
  }, [customColumns]);

  const columnsAfter = useMemo(() => {
    const map: Record<string, CustomColumn[]> = {};
    const positioned: CustomColumn[] = [];
    const unpositioned: CustomColumn[] = [];

    for (const col of customColumns) {
      if (col.insert_after) {
        positioned.push(col);
      } else {
        unpositioned.push(col);
      }
    }

    for (const col of positioned) {
      if (!map[col.insert_after!]) map[col.insert_after!] = [];
      map[col.insert_after!].push(col);
    }

    const lastStdKey = 'status';
    if (!map[lastStdKey]) map[lastStdKey] = [];
    map[lastStdKey].push(...unpositioned);

    return map;
  }, [customColumns]);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const scrollToRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevReasonsRef.current === null) {
      const initial = new Map<string, ChangeReason>();
      employees.forEach(emp => initial.set(emp.id, emp.change_reason));
      prevReasonsRef.current = initial;
      return;
    }

    const nextMap = new Map<string, ChangeReason>();
    employees.forEach(emp => {
      const prevReason = prevReasonsRef.current!.get(emp.id);
      if (prevReason !== 'Promotion' && emp.change_reason === 'Promotion') {
        scrollToRef.current = emp.id;
        setExpandedRows(prev => {
          const next = new Set(prev);
          next.add(emp.id);
          return next;
        });
      }
      if (prevReason === 'Promotion' && emp.change_reason !== 'Promotion') {
        setExpandedRows(prev => {
          const next = new Set(prev);
          next.delete(emp.id);
          return next;
        });
      }
      nextMap.set(emp.id, emp.change_reason);
    });
    prevReasonsRef.current = nextMap;
  }, [employees]);

  useEffect(() => {
    if (!scrollToRef.current) return;
    const empId = scrollToRef.current;
    scrollToRef.current = null;
    requestAnimationFrame(() => {
      setTimeout(() => {
        const rowEl = rowRefs.current.get(empId);
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    });
  }, [expandedRows]);

  function canEdit(emp: Employee): boolean {
    if (stage === 'finalized') return false;
    if (role === 'Finance Viewer') return false;
    if (role === 'HR Admin') return stage === 'allocation_open' || stage === 'hr_review';
    if (role === 'SLT User') {
      return stage === 'allocation_open' && emp.slt_owner === selectedSltOwner && !emp.slt_submitted;
    }
    return false;
  }

  function toggleExpand(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDetail(id: string) {
    setDetailRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function canSavePromo(emp: Employee): boolean {
    return (
      emp.new_title.trim().length >= 2 &&
      emp.promo_rationale.trim().length >= MIN_CHARS &&
      emp.new_responsibilities.trim().length >= MIN_CHARS
    );
  }

  function handleSavePromo(id: string) {
    setSavingRows(prev => new Set(prev).add(id));
    setTimeout(() => {
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSavingRows(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400);
  }

  function renderCustomHeaders(afterKey: string) {
    const cols = columnsAfter[afterKey];
    if (!cols || cols.length === 0) return null;
    return cols.map(col => (
      <th key={col.id} className={`px-3 py-2.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap ${
        col.column_type === 'formula' ? 'text-amber-700 bg-amber-50/50' : 'text-slate-600'
      }`}>
        <div className="flex items-center gap-1.5">
          <span>{col.column_name}</span>
          {col.column_type === 'formula' && (
            <span className="text-[8px] font-bold px-1 py-px bg-amber-200/60 text-amber-700 rounded">fx</span>
          )}
          {role === 'HR Admin' && stage !== 'finalized' && (
            <button
              onClick={() => onRemoveColumn(col.id)}
              className="text-slate-300 hover:text-red-500 transition-colors"
              title={`Remove "${col.column_name}" column`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </th>
    ));
  }

  function renderCustomCells(afterKey: string, emp: Employee, editable: boolean) {
    const cols = columnsAfter[afterKey];
    if (!cols || cols.length === 0) return null;
    return cols.map(col => {
      if (col.column_type === 'formula' && col.formula) {
        const result = evaluateFormula(col.formula, emp, columnValues, customColumnMap);
        return (
          <td key={col.id} className="px-3 py-2 border-b border-slate-100 text-right font-mono tabular-nums text-xs">
            <span className={result !== null ? 'text-slate-700' : 'text-red-400'}>
              {result !== null ? result.toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'ERR'}
            </span>
          </td>
        );
      }
      const val = columnValues[col.id]?.[emp.id] || '';
      const colEditable = editable || (role === 'HR Admin' && stage !== 'finalized');
      return (
        <td key={col.id} className="px-3 py-2 border-b border-slate-100">
          {colEditable ? (
            <input
              type={col.column_type === 'number' ? 'number' : 'text'}
              value={val}
              onChange={e => onUpdateColumnValue(col.id, emp.id, e.target.value)}
              className="w-24 px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="-"
            />
          ) : (
            <span className="text-xs text-slate-500">{val || '\u2014'}</span>
          )}
        </td>
      );
    });
  }

  const totalCustomColumns = customColumns.length;

  if (employees.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="text-center py-20 text-slate-400">
          <p className="text-base">No employee data loaded</p>
          <p className="text-sm mt-1">Upload a CSV file or load demo data to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {employees.some(e => e.change_reason === 'Promotion' && isSvpOrAbove(e.new_title)) && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-amber-800">
            Reminder: SVP and above require pre-approval from Mark and Jay.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left border-b border-slate-200">
              <th className="px-2 py-2.5 w-8" />
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Level</th>
              {renderCustomHeaders('dept_level')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Dept</th>
              {renderCustomHeaders('department')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Emp #</th>
              {renderCustomHeaders('employee_id')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Employee Name</th>
              {renderCustomHeaders('employee_name')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Title</th>
              {renderCustomHeaders('title')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Reports To</th>
              {renderCustomHeaders('reports_to')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Location</th>
              {renderCustomHeaders('location')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-center">Ccy</th>
              {renderCustomHeaders('local_currency')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-right">Current Salary</th>
              {renderCustomHeaders('current_salary_usd')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-center">% Increase</th>
              {renderCustomHeaders('increase_percent')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-right">New Salary</th>
              {renderCustomHeaders('new_salary_usd')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-right">Increase $</th>
              {renderCustomHeaders('increase_dollar')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-right">PY Cash</th>
              {renderCustomHeaders('py_cash_bonus')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-right">PY Stock</th>
              {renderCustomHeaders('py_stock_bonus')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-right">LTIP</th>
              {renderCustomHeaders('ltip')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-right">Total Comp Prev</th>
              {renderCustomHeaders('total_comp_prev')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-right">Total Comp New</th>
              {renderCustomHeaders('total_comp_new')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap">Reason</th>
              {renderCustomHeaders('change_reason')}
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap text-center">Status</th>
              {renderCustomHeaders('status')}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, i) => {
              const editable = canEdit(emp);
              const hasIncrease = emp.increase_percent > 0;
              const isPromo = emp.change_reason === 'Promotion';
              const isExpanded = expandedRows.has(emp.id);
              const isDetailOpen = detailRows.has(emp.id);
              const svpFlag = isPromo && isSvpOrAbove(emp.new_title);
              const isSaving = savingRows.has(emp.id);
              const hasSubmittedDetails = emp.slt_submitted && (emp.increase_percent > 0 || isPromo);

              return (
                <>
                  <tr
                    key={emp.id}
                    ref={el => { if (el) rowRefs.current.set(emp.id, el); else rowRefs.current.delete(emp.id); }}
                    className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-blue-50/40 transition-colors ${svpFlag ? 'border-l-2 border-l-amber-400' : ''}`}
                  >
                    <td className="px-2 py-2 border-b border-slate-100 text-center">
                      {isPromo ? (
                        <button onClick={() => toggleExpand(emp.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      ) : role === 'HR Admin' && hasSubmittedDetails ? (
                        <button onClick={() => toggleDetail(emp.id)} className="text-slate-400 hover:text-blue-500 transition-colors">
                          {isDetailOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      ) : null}
                    </td>

                    <td className="px-3 py-2 border-b border-slate-100 text-slate-500 text-xs">{emp.dept_level}</td>
                    {renderCustomCells('dept_level', emp, editable)}
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-600 text-xs">{emp.department}</td>
                    {renderCustomCells('department', emp, editable)}
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-400 font-mono text-xs">{emp.employee_id}</td>
                    {renderCustomCells('employee_id', emp, editable)}
                    <td className="px-3 py-2 border-b border-slate-100">
                      {role === 'HR Admin' && hasSubmittedDetails ? (
                        <button
                          onClick={() => isPromo ? toggleExpand(emp.id) : toggleDetail(emp.id)}
                          className="font-medium text-slate-800 hover:text-blue-600 transition-colors text-left"
                        >
                          {emp.employee_name}
                        </button>
                      ) : (
                        <span className="font-medium text-slate-800">{emp.employee_name}</span>
                      )}
                    </td>
                    {renderCustomCells('employee_name', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100 text-xs">
                      <span className="text-slate-600">{emp.title || '\u2014'}</span>
                      {isPromo && emp.new_title && (
                        <span className="block text-emerald-600 font-medium mt-0.5">
                          &rarr; {emp.new_title}
                          {svpFlag && <AlertTriangle className="inline w-3 h-3 text-amber-500 ml-1" />}
                        </span>
                      )}
                    </td>
                    {renderCustomCells('title', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100 text-slate-500 text-xs">{emp.reports_to}</td>
                    {renderCustomCells('reports_to', emp, editable)}
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-500 text-xs">{emp.location}</td>
                    {renderCustomCells('location', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100 text-center">
                      <span className={`inline-block w-8 text-[10px] font-bold rounded px-1 py-0.5 ${
                        emp.local_currency !== 'USD' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>{emp.local_currency}</span>
                    </td>
                    {renderCustomCells('local_currency', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100 text-right font-mono text-slate-700 tabular-nums">
                      <FxTooltip employee={emp} fxRates={fxRates} usdAmount={emp.current_salary_usd} role={role}>
                        {formatCurrency(emp.current_salary_usd)}
                      </FxTooltip>
                    </td>
                    {renderCustomCells('current_salary_usd', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100 text-center">
                      {editable ? (
                        <input
                          type="number"
                          value={emp.increase_percent || ''}
                          onChange={e => {
                            const pct = parseFloat(e.target.value) || 0;
                            onUpdateEmployee(emp.id, {
                              increase_percent: pct,
                              new_salary_usd: Math.round(emp.current_salary_usd * (1 + pct / 100) * 100) / 100,
                              new_salary_local: Math.round(emp.current_salary_local * (1 + pct / 100) * 100) / 100,
                            });
                          }}
                          className="w-20 px-2 py-1 border border-slate-300 rounded text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          step="0.5" min="0" max="100" placeholder="0"
                        />
                      ) : (
                        <span className={`tabular-nums ${hasIncrease ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
                          {hasIncrease ? `${emp.increase_percent}%` : '\u2014'}
                        </span>
                      )}
                    </td>
                    {renderCustomCells('increase_percent', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100 text-right font-mono tabular-nums">
                      <FxTooltip employee={emp} fxRates={fxRates} usdAmount={hasIncrease ? emp.new_salary_usd : emp.current_salary_usd} role={role}>
                        <span className={hasIncrease ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
                          {formatCurrency(hasIncrease ? emp.new_salary_usd : emp.current_salary_usd)}
                        </span>
                      </FxTooltip>
                    </td>
                    {renderCustomCells('new_salary_usd', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100 text-right font-mono tabular-nums text-xs">
                      {hasIncrease ? (
                        <span className="text-emerald-600">+{formatCurrency(emp.new_salary_usd - emp.current_salary_usd)}</span>
                      ) : (
                        <span className="text-slate-300">\u2014</span>
                      )}
                    </td>
                    {renderCustomCells('increase_dollar', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100 text-right font-mono tabular-nums text-xs text-slate-500">
                      {emp.py_cash_bonus > 0 ? formatCurrency(emp.py_cash_bonus) : '\u2014'}
                    </td>
                    {renderCustomCells('py_cash_bonus', emp, editable)}
                    <td className="px-3 py-2 border-b border-slate-100 text-right font-mono tabular-nums text-xs text-slate-500">
                      {emp.py_stock_bonus > 0 ? formatCurrency(emp.py_stock_bonus) : '\u2014'}
                    </td>
                    {renderCustomCells('py_stock_bonus', emp, editable)}
                    <td className="px-3 py-2 border-b border-slate-100 text-right font-mono tabular-nums text-xs text-slate-500">
                      {emp.ltip > 0 ? formatCurrency(emp.ltip) : '\u2014'}
                    </td>
                    {renderCustomCells('ltip', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100 text-right font-mono tabular-nums text-xs text-slate-600">
                      {formatCurrency(totalCompPrevious(emp))}
                    </td>
                    {renderCustomCells('total_comp_prev', emp, editable)}
                    <td className="px-3 py-2 border-b border-slate-100 text-right font-mono tabular-nums text-xs">
                      <span className={hasIncrease ? 'text-emerald-600 font-semibold' : 'text-slate-600'}>
                        {formatCurrency(totalCompNew(emp))}
                      </span>
                    </td>
                    {renderCustomCells('total_comp_new', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100">
                      {editable ? (
                        <select
                          value={emp.change_reason}
                          onChange={e => {
                            const reason = e.target.value as ChangeReason;
                            const updates: Partial<Employee> = { change_reason: reason };
                            if (reason !== 'Promotion') {
                              updates.new_title = '';
                              updates.promo_rationale = '';
                              updates.new_responsibilities = '';
                            }
                            onUpdateEmployee(emp.id, updates);
                          }}
                          className="px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option>Merit Increase</option>
                          <option>Promotion</option>
                        </select>
                      ) : (
                        <span className={`text-xs ${isPromo ? 'text-blue-600 font-semibold' : 'text-slate-500'}`}>
                          {emp.change_reason}
                        </span>
                      )}
                    </td>
                    {renderCustomCells('change_reason', emp, editable)}

                    <td className="px-3 py-2 border-b border-slate-100 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[emp.status] || STATUS_STYLES.Pending}`}>
                        {emp.slt_submitted && <Lock className="w-3 h-3" />}
                        {emp.status}
                      </span>
                    </td>
                    {renderCustomCells('status', emp, editable)}
                  </tr>

                  {isPromo && isExpanded && (
                    <tr
                      key={`${emp.id}-promo`}
                      className={`transition-all duration-300 ${isSaving ? 'opacity-0 max-h-0' : 'opacity-100'}`}
                    >
                      <td colSpan={20 + totalCustomColumns} className="px-6 py-4 border-b border-slate-200 bg-blue-50/30">
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <p className="text-xs text-blue-800">
                            <span className="font-semibold">Reminder:</span> SVP and above require pre-approval from Mark and Jay.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mb-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Current Title
                            </label>
                            <p className="text-sm text-slate-700 bg-slate-100 rounded px-2 py-1.5">{emp.title || '\u2014'}</p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              New Title (Post-Promotion) {editable && <span className="text-red-500">*</span>}
                            </label>
                            {editable ? (
                              <div className="space-y-1.5">
                                <select
                                  value={ROLE_CATEGORIES.includes(emp.new_title) ? emp.new_title : '__custom__'}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val !== '__custom__') {
                                      onUpdateEmployee(emp.id, { new_title: val });
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select role category...</option>
                                  {ROLE_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                  <option value="__custom__">Custom title...</option>
                                </select>
                                <input
                                  type="text"
                                  value={emp.new_title}
                                  onChange={e => onUpdateEmployee(emp.id, { new_title: e.target.value })}
                                  placeholder="Type exact new title"
                                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {svpFlag && (
                                  <div className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="text-[10px] font-semibold">This title is SVP-level or above -- requires pre-approval from Mark and Jay</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-700">{emp.new_title || '\u2014'}</p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Reason for Promotion {editable && <span className="text-red-500">*</span>}
                              {editable && (
                                <span className="text-slate-400 font-normal ml-1">(min {MIN_CHARS} characters)</span>
                              )}
                            </label>
                            {editable ? (
                              <div>
                                <textarea
                                  value={emp.promo_rationale}
                                  onChange={e => onUpdateEmployee(emp.id, { promo_rationale: e.target.value })}
                                  rows={3}
                                  placeholder="Why is this person being promoted?"
                                  className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                                    emp.promo_rationale.trim().length > 0 && emp.promo_rationale.trim().length < MIN_CHARS
                                      ? 'border-red-300 bg-red-50/30'
                                      : 'border-slate-300'
                                  }`}
                                />
                                {emp.promo_rationale.trim().length > 0 && emp.promo_rationale.trim().length < MIN_CHARS && (
                                  <p className="text-[10px] text-red-500 mt-0.5">
                                    {MIN_CHARS - emp.promo_rationale.trim().length} more character{MIN_CHARS - emp.promo_rationale.trim().length !== 1 ? 's' : ''} needed
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-600">{emp.promo_rationale || '\u2014'}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              New Responsibilities {editable && <span className="text-red-500">*</span>}
                              {editable && (
                                <span className="text-slate-400 font-normal ml-1">(min {MIN_CHARS} characters)</span>
                              )}
                            </label>
                            {editable ? (
                              <div>
                                <textarea
                                  value={emp.new_responsibilities}
                                  onChange={e => onUpdateEmployee(emp.id, { new_responsibilities: e.target.value })}
                                  rows={3}
                                  placeholder="What will they do in the new role?"
                                  className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                                    emp.new_responsibilities.trim().length > 0 && emp.new_responsibilities.trim().length < MIN_CHARS
                                      ? 'border-red-300 bg-red-50/30'
                                      : 'border-slate-300'
                                  }`}
                                />
                                {emp.new_responsibilities.trim().length > 0 && emp.new_responsibilities.trim().length < MIN_CHARS && (
                                  <p className="text-[10px] text-red-500 mt-0.5">
                                    {MIN_CHARS - emp.new_responsibilities.trim().length} more character{MIN_CHARS - emp.new_responsibilities.trim().length !== 1 ? 's' : ''} needed
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-600">{emp.new_responsibilities || '\u2014'}</p>
                            )}
                          </div>
                        </div>

                        {editable && (
                          <div className="flex justify-end mt-4">
                            <button
                              onClick={() => handleSavePromo(emp.id)}
                              disabled={!canSavePromo(emp)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save Promotion Details
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}

                  {!isPromo && isDetailOpen && role === 'HR Admin' && (
                    <tr key={`${emp.id}-detail`}>
                      <td colSpan={20 + totalCustomColumns} className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          SLT Submission Details -- {emp.employee_name}
                        </p>
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-xs">
                            <tbody>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600 w-40">Submitted By</td>
                                <td className="px-3 py-2 text-slate-700">{emp.slt_owner}</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">Status</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[emp.status] || STATUS_STYLES.Pending}`}>
                                    {emp.slt_submitted && <Lock className="w-3 h-3" />} {emp.status}
                                  </span>
                                </td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">Change Reason</td>
                                <td className="px-3 py-2 text-slate-700">{emp.change_reason}</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">Current Title</td>
                                <td className="px-3 py-2 text-slate-700">{emp.title || '\u2014'}</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">Department</td>
                                <td className="px-3 py-2 text-slate-700">{emp.department} ({emp.dept_level})</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">Reports To</td>
                                <td className="px-3 py-2 text-slate-700">{emp.reports_to}</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">Current Salary</td>
                                <td className="px-3 py-2 font-mono text-slate-700">{formatCurrency(emp.current_salary_usd)}</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">% Increase</td>
                                <td className="px-3 py-2 font-mono text-emerald-600 font-semibold">{emp.increase_percent}%</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">New Salary</td>
                                <td className="px-3 py-2 font-mono text-emerald-600 font-semibold">{formatCurrency(emp.new_salary_usd)}</td>
                              </tr>
                              <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">Salary Increase ($)</td>
                                <td className="px-3 py-2 font-mono text-emerald-600">+{formatCurrency(emp.new_salary_usd - emp.current_salary_usd)}</td>
                              </tr>
                              {emp.py_cash_bonus > 0 && (
                                <tr className="border-b border-slate-100">
                                  <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">PY Cash Bonus</td>
                                  <td className="px-3 py-2 font-mono text-slate-700">{formatCurrency(emp.py_cash_bonus)}</td>
                                </tr>
                              )}
                              {emp.py_stock_bonus > 0 && (
                                <tr className="border-b border-slate-100">
                                  <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">PY Stock Bonus</td>
                                  <td className="px-3 py-2 font-mono text-slate-700">{formatCurrency(emp.py_stock_bonus)}</td>
                                </tr>
                              )}
                              {emp.ltip > 0 && (
                                <tr className="border-b border-slate-100">
                                  <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">LTIP</td>
                                  <td className="px-3 py-2 font-mono text-slate-700">{formatCurrency(emp.ltip)}</td>
                                </tr>
                              )}
                              <tr>
                                <td className="px-3 py-2 bg-slate-50 font-semibold text-slate-600">Total Comp (New)</td>
                                <td className="px-3 py-2 font-mono font-semibold text-slate-800">{formatCurrency(totalCompNew(emp))}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {employees.length} employee{employees.length !== 1 ? 's' : ''}
          {employees.some(e => e.change_reason === 'Promotion') &&
            ` \u00b7 ${employees.filter(e => e.change_reason === 'Promotion').length} promotion${employees.filter(e => e.change_reason === 'Promotion').length !== 1 ? 's' : ''}`
          }
        </span>
      </div>
    </div>
  );
}
