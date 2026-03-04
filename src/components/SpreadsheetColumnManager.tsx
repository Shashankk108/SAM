import { useState, useEffect, useMemo } from 'react';
import {
  X, Plus, Trash2, Save, FolderOpen, Type, Hash,
  AlertTriangle, Columns3, ArrowRight, Check, FileSpreadsheet, Sigma, Globe, Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CustomColumn, Employee } from '../types';
import { formatCurrency, totalCompPrevious, totalCompNew } from '../types';
import { PRESET_FORMULAS, evaluateFormula } from '../utils/formula';

interface ColumnTemplate {
  id: string;
  name: string;
  description: string;
  columns: ColumnDef[];
  created_at: string;
  is_global: boolean;
}

interface ColumnDef {
  key: string;
  label: string;
  isCustom: boolean;
  customColumnId?: string;
  columnType?: 'text' | 'number' | 'formula';
  formula?: string;
}

export interface StagedColumn {
  id?: string;
  column_name: string;
  column_key: string;
  column_type: 'text' | 'number' | 'formula';
  sort_order: number;
  formula?: string;
  insert_after?: string;
  isNew?: boolean;
}

interface SpreadsheetColumnManagerProps {
  open: boolean;
  onClose: () => void;
  columns: CustomColumn[];
  columnValues: Record<string, Record<string, string>>;
  employees: Employee[];
  onPushChanges: (adds: StagedColumn[], deleteIds: string[]) => Promise<void>;
}

const STANDARD_COLUMNS: ColumnDef[] = [
  { key: 'dept_level', label: 'Level', isCustom: false },
  { key: 'department', label: 'Dept', isCustom: false },
  { key: 'employee_id', label: 'Emp #', isCustom: false },
  { key: 'employee_name', label: 'Employee Name', isCustom: false },
  { key: 'title', label: 'Title', isCustom: false },
  { key: 'reports_to', label: 'Reports To', isCustom: false },
  { key: 'location', label: 'Location', isCustom: false },
  { key: 'local_currency', label: 'Ccy', isCustom: false },
  { key: 'current_salary_usd', label: 'Current Salary', isCustom: false },
  { key: 'increase_percent', label: '% Increase', isCustom: false },
  { key: 'new_salary_usd', label: 'New Salary', isCustom: false },
  { key: 'increase_dollar', label: 'Increase $', isCustom: false },
  { key: 'py_cash_bonus', label: 'PY Cash', isCustom: false },
  { key: 'py_stock_bonus', label: 'PY Stock', isCustom: false },
  { key: 'ltip', label: 'LTIP', isCustom: false },
  { key: 'total_comp_prev', label: 'Total Comp Prev', isCustom: false },
  { key: 'total_comp_new', label: 'Total Comp New', isCustom: false },
  { key: 'change_reason', label: 'Reason', isCustom: false },
  { key: 'status', label: 'Status', isCustom: false },
];

function getCellValue(
  emp: Employee,
  col: ColumnDef,
  columnValues: Record<string, Record<string, string>>,
  customColumnMap?: Record<string, string>,
): string {
  if (col.isCustom && col.columnType === 'formula' && col.formula) {
    const result = evaluateFormula(col.formula, emp, columnValues, customColumnMap || {});
    if (result === null) return 'ERR';
    return result.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  if (col.isCustom && col.customColumnId) {
    return columnValues[col.customColumnId]?.[emp.id] || '';
  }
  if (col.key === 'increase_dollar') {
    const diff = emp.new_salary_usd - emp.current_salary_usd;
    return diff > 0 ? `+${formatCurrency(diff)}` : '\u2014';
  }
  if (col.key === 'total_comp_prev') {
    return formatCurrency(totalCompPrevious(emp));
  }
  if (col.key === 'total_comp_new') {
    return formatCurrency(totalCompNew(emp));
  }
  const val = emp[col.key as keyof Employee];
  if (col.key === 'current_salary_usd' || col.key === 'new_salary_usd') {
    return formatCurrency(Number(val));
  }
  if (col.key === 'py_cash_bonus' || col.key === 'py_stock_bonus' || col.key === 'ltip') {
    const n = Number(val);
    return n > 0 ? formatCurrency(n) : '\u2014';
  }
  if (col.key === 'increase_percent') {
    const pct = Number(val);
    return pct > 0 ? `${pct}%` : '0%';
  }
  return val != null ? String(val) : '';
}

export default function SpreadsheetColumnManager({
  open, onClose, columns, columnValues, employees, onPushChanges,
}: SpreadsheetColumnManagerProps) {
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [mode, setMode] = useState<'view' | 'add' | 'delete' | 'save' | 'load'>('view');
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<'text' | 'number' | 'formula'>('text');
  const [addAfter, setAddAfter] = useState<number>(-1);
  const [addError, setAddError] = useState('');
  const [addFormula, setAddFormula] = useState('');
  const [templates, setTemplates] = useState<ColumnTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [pushing, setPushing] = useState(false);

  const [stagedAdds, setStagedAdds] = useState<StagedColumn[]>([]);
  const [stagedDeletes, setStagedDeletes] = useState<string[]>([]);

  const hasPendingChanges = stagedAdds.length > 0 || stagedDeletes.length > 0;

  const effectiveColumns = useMemo(() => {
    const kept = columns.filter(c => !stagedDeletes.includes(c.id));
    const combined: StagedColumn[] = [
      ...kept.map(c => ({ ...c, isNew: false })),
      ...stagedAdds,
    ];
    return combined;
  }, [columns, stagedAdds, stagedDeletes]);

  const allColumns = useMemo(() => {
    const customs: (ColumnDef & { insertAfter?: string; staged?: boolean })[] = effectiveColumns.map(c => ({
      key: c.column_key,
      label: c.column_name,
      isCustom: true,
      customColumnId: c.id,
      columnType: c.column_type,
      formula: c.formula,
      insertAfter: c.insert_after || '',
      staged: c.isNew,
    }));

    const positioned = customs.filter(c => c.insertAfter);
    const unpositioned = customs.filter(c => !c.insertAfter);

    const result: (ColumnDef & { staged?: boolean })[] = [];
    for (const std of STANDARD_COLUMNS) {
      result.push(std);
      for (const cc of positioned) {
        if (cc.insertAfter === std.key) {
          result.push(cc);
        }
      }
    }

    for (const cc of positioned) {
      const isCustomTarget = !STANDARD_COLUMNS.some(s => s.key === cc.insertAfter);
      if (isCustomTarget) {
        const idx = result.findIndex(r => r.isCustom && r.customColumnId === cc.insertAfter);
        if (idx >= 0) {
          result.splice(idx + 1, 0, cc);
        } else {
          result.push(cc);
        }
      }
    }

    result.push(...unpositioned);
    return result;
  }, [effectiveColumns]);

  const customColumnMap = useMemo(() => {
    const map: Record<string, string> = {};
    columns.forEach(c => { map[c.column_key] = c.id; });
    return map;
  }, [columns]);

  useEffect(() => {
    if (open) {
      setMode('view');
      setSelectedCol(null);
      setStagedAdds([]);
      setStagedDeletes([]);
    }
  }, [open]);

  async function loadTemplates() {
    setLoadingTemplates(true);
    const { data } = await supabase
      .from('sam_column_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setTemplates(data.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        columns: (t.columns as ColumnDef[]) || [],
        created_at: t.created_at,
        is_global: t.is_global || false,
      })));
    }
    setLoadingTemplates(false);
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    const { data } = await supabase
      .from('sam_column_templates')
      .insert({
        name: templateName.trim(),
        description: templateDesc.trim(),
        columns: allColumns,
      })
      .select()
      .maybeSingle();
    if (data) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setMode('view');
        setTemplateName('');
        setTemplateDesc('');
      }, 1500);
    }
  }

  function handleLoadTemplate(template: ColumnTemplate) {
    const customsInTemplate = template.columns.filter(c => c.isCustom);
    const templateKeys = new Set(customsInTemplate.map(c => c.key));

    const deletions = columns
      .filter(c => !templateKeys.has(c.column_key))
      .map(c => c.id);

    const existingKeys = new Set(columns.map(c => c.column_key));
    const alreadyStagedKeys = new Set(stagedAdds.map(c => c.column_key));
    const newAdds: StagedColumn[] = [];
    for (const tc of customsInTemplate) {
      if (!existingKeys.has(tc.key) && !alreadyStagedKeys.has(tc.key)) {
        newAdds.push({
          column_name: tc.label,
          column_key: tc.key,
          column_type: tc.columnType || 'text',
          sort_order: 0,
          formula: tc.formula || '',
          insert_after: '',
          isNew: true,
        });
      }
    }

    const keptStagedAdds = stagedAdds.filter(a => templateKeys.has(a.column_key));

    setStagedDeletes(deletions);
    setStagedAdds([...keptStagedAdds, ...newAdds]);
    setMode('view');
  }

  async function handleLoadGlobally(template: ColumnTemplate) {
    await supabase
      .from('sam_column_templates')
      .insert({
        name: `Auto-save before global load (${new Date().toLocaleString()})`,
        description: `Automatically saved before applying "${template.name}" globally`,
        columns: allColumns,
        is_global: false,
      });

    await supabase
      .from('sam_column_templates')
      .update({ is_global: true })
      .eq('id', template.id);

    await supabase
      .from('sam_column_templates')
      .update({ is_global: false })
      .neq('id', template.id)
      .eq('is_global', true);

    handleLoadTemplate(template);

    setTemplates(prev => prev.map(t => ({
      ...t,
      is_global: t.id === template.id,
    })));
  }

  async function handleDeleteTemplate(id: string) {
    await supabase.from('sam_column_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  function handleAdd() {
    const trimmed = addName.trim();
    if (!trimmed) {
      setAddError('Column name is required');
      return;
    }
    if (allColumns.some(c => c.label.toLowerCase() === trimmed.toLowerCase())) {
      setAddError('A column with that name already exists');
      return;
    }

    let insertAfterKey = '';
    if (addAfter >= 0) {
      const selectedAllCol = allColumns[addAfter];
      if (selectedAllCol) {
        insertAfterKey = selectedAllCol.isCustom
          ? selectedAllCol.customColumnId || selectedAllCol.key
          : selectedAllCol.key;
      }
    }

    const baseKey = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const existingKeys = new Set([
      ...columns.map(c => c.column_key),
      ...stagedAdds.map(c => c.column_key),
    ]);
    let key = baseKey;
    let suffix = 2;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix++;
    }

    setStagedAdds(prev => [...prev, {
      column_name: trimmed,
      column_key: key,
      column_type: addType,
      sort_order: columns.length + stagedAdds.length,
      formula: addType === 'formula' ? addFormula : '',
      insert_after: insertAfterKey,
      isNew: true,
    }]);

    setAddName('');
    setAddType('text');
    setAddFormula('');
    setAddError('');
    setMode('view');
  }

  function handleDelete() {
    if (selectedCol === null) return;
    const col = allColumns[selectedCol];
    if (!col.isCustom) return;

    if ((col as { staged?: boolean }).staged) {
      setStagedAdds(prev => prev.filter(a => a.column_key !== col.key));
    } else if (col.customColumnId) {
      setStagedDeletes(prev => [...prev, col.customColumnId!]);
    }
    setSelectedCol(null);
    setMode('view');
  }

  async function handlePushToDashboard() {
    setPushing(true);
    await onPushChanges(stagedAdds, stagedDeletes);
    setStagedAdds([]);
    setStagedDeletes([]);
    setPushing(false);
  }

  if (!open) return null;

  const previewEmps = employees.slice(0, 15);
  const selectedColDef = selectedCol !== null ? allColumns[selectedCol] : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[95vw] max-w-[1400px] mx-4 tour-scale-in overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-blue-400" />

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Column Manager</h3>
              <p className="text-[11px] text-slate-400">
                {STANDARD_COLUMNS.length} standard + {columns.length} custom column{columns.length !== 1 ? 's' : ''}
                {employees.length > 0 && <span> &middot; {employees.length} employees</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-200 bg-white">
          <button
            onClick={() => setMode('add')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Column
          </button>
          <div className="relative group">
            <button
              onClick={() => {
                if (selectedCol !== null && allColumns[selectedCol]?.isCustom) {
                  setMode('delete');
                }
              }}
              disabled={selectedCol === null || !allColumns[selectedCol]?.isCustom}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Column
            </button>
            {selectedCol !== null && !allColumns[selectedCol]?.isCustom && (
              <div className="absolute left-0 top-full mt-1 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Standard columns cannot be deleted
                <div className="absolute bottom-full left-4 border-4 border-transparent border-b-slate-800" />
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-slate-200 mx-1" />

          <button
            onClick={() => { setMode('save'); setTemplateName(''); setTemplateDesc(''); setSaveSuccess(false); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Save className="w-3.5 h-3.5" /> Save Template
          </button>
          <button
            onClick={() => { setMode('load'); loadTemplates(); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Load Template
          </button>

          {hasPendingChanges && (
            <>
              <div className="h-5 w-px bg-slate-200 mx-1" />
              <button
                onClick={handlePushToDashboard}
                disabled={pushing}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm"
              >
                {pushing ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                Push to Dashboard
                <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                  {stagedAdds.length + stagedDeletes.length}
                </span>
              </button>
            </>
          )}

          {selectedColDef && (
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{selectedColDef.label}</span>
              {selectedColDef.isCustom ? (
                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-semibold">CUSTOM</span>
              ) : (
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold">STANDARD</span>
              )}
            </div>
          )}
        </div>

        {mode === 'add' && (
          <div className="px-5 py-3 border-b border-blue-200 bg-blue-50/30 space-y-3">
            <div className="flex items-end gap-3 max-w-4xl">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Column Name</label>
                <input
                  type="text"
                  value={addName}
                  onChange={e => { setAddName(e.target.value); setAddError(''); }}
                  placeholder="e.g. Performance Rating"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && addType !== 'formula' && handleAdd()}
                />
                {addError && <p className="text-[10px] text-red-500 mt-0.5">{addError}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Type</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setAddType('text')}
                    className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      addType === 'text' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    <Type className="w-3 h-3" /> Text
                  </button>
                  <button
                    onClick={() => setAddType('number')}
                    className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      addType === 'number' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    <Hash className="w-3 h-3" /> Num
                  </button>
                  <button
                    onClick={() => setAddType('formula')}
                    className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      addType === 'formula' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    <Sigma className="w-3 h-3" /> Formula
                  </button>
                </div>
              </div>
              <div className="w-48">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Insert After</label>
                <select
                  value={addAfter}
                  onChange={e => setAddAfter(Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value={-1}>End of table</option>
                  {allColumns.map((c, i) => (
                    <option key={c.key + i} value={i}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setMode('view'); setAddError(''); setAddName(''); setAddFormula(''); }}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={addType === 'formula' && !addFormula.trim()}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Add
                </button>
              </div>
            </div>

            {addType === 'formula' && (
              <div className="max-w-4xl space-y-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Formula Expression</label>
                  <input
                    type="text"
                    value={addFormula}
                    onChange={e => setAddFormula(e.target.value)}
                    placeholder="e.g. new_salary - current_salary"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Available fields: <code className="text-amber-600">current_salary</code>, <code className="text-amber-600">new_salary</code>, <code className="text-amber-600">increase_percent</code>, <code className="text-amber-600">py_cash_bonus</code>, <code className="text-amber-600">py_stock_bonus</code>, <code className="text-amber-600">ltip</code>
                    {columns.length > 0 && (
                      <> | Custom: {columns.map(c => <code key={c.id} className="text-emerald-600 mr-1">{c.column_key}</code>)}</>
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Preset Formulas</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_FORMULAS.map(pf => (
                      <button
                        key={pf.label}
                        onClick={() => {
                          setAddFormula(pf.formula);
                          if (!addName.trim()) setAddName(pf.label);
                        }}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                          addFormula === pf.formula
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                        title={pf.description}
                      >
                        {pf.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'delete' && selectedColDef?.isCustom && (
          <div className="px-5 py-3 border-b border-red-200 bg-red-50/30">
            <div className="flex items-center gap-3 max-w-xl">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Delete "{selectedColDef.label}"?</p>
                <p className="text-xs text-red-600 mt-0.5">This permanently removes the column and all its data from every employee.</p>
              </div>
              <button onClick={() => setMode('view')} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                Delete
              </button>
            </div>
          </div>
        )}

        {mode === 'save' && (
          <div className="px-5 py-3 border-b border-blue-200 bg-blue-50/30">
            {saveSuccess ? (
              <div className="flex items-center gap-2 text-emerald-700">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Template saved!</span>
              </div>
            ) : (
              <div className="flex items-end gap-3 max-w-2xl">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Template Name</label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g. Annual Review 2026"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={templateDesc}
                    onChange={e => setTemplateDesc(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <button onClick={() => setMode('view')} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim()}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'load' && (
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 max-h-[180px] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Saved Templates</p>
              <button onClick={() => setMode('view')} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Close</button>
            </div>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 py-4 text-slate-400 text-xs">
                <div className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No saved templates yet. Save your current column layout as a template.</p>
            ) : (
              <div className="space-y-1.5">
                {templates.map(t => (
                  <div key={t.id} className={`flex items-center gap-3 p-2.5 bg-white border rounded-lg hover:border-slate-200 group transition-colors ${
                    t.is_global ? 'border-blue-200 bg-blue-50/20' : 'border-slate-100'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                        {t.is_global && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded uppercase">
                            <Globe className="w-2.5 h-2.5" /> Global
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {t.columns.length} columns
                        {t.description && <span> &middot; {t.description}</span>}
                        <span> &middot; {new Date(t.created_at).toLocaleString()}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleLoadTemplate(t)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <ArrowRight className="w-3 h-3" /> Apply
                    </button>
                    <button
                      onClick={() => handleLoadGlobally(t)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                      title="Apply this template for all roles (SLT, Finance, HR)"
                    >
                      <Globe className="w-3 h-3" /> Load Globally
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Columns3 className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-sm">No employee data loaded</p>
              <p className="text-xs mt-1">Load demo data or upload a CSV to see the table preview</p>
            </div>
          ) : (
            <table className="text-xs border-collapse min-w-full">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-100 border-r border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wider w-8">
                    #
                  </th>
                  {allColumns.map((col, i) => (
                    <th
                      key={col.key + i}
                      onClick={() => setSelectedCol(selectedCol === i ? null : i)}
                      className={`border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors ${
                        selectedCol === i
                          ? 'bg-blue-100 text-blue-700 ring-2 ring-inset ring-blue-400'
                          : col.isCustom
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200/60'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.isCustom && (
                          <span className={`text-[8px] font-bold px-1 py-px rounded ${
                            col.columnType === 'formula'
                              ? 'bg-amber-200/60 text-amber-700'
                              : 'bg-emerald-200/60 text-emerald-700'
                          }`}>
                            {col.columnType === 'formula' ? 'fx' : col.columnType === 'number' ? '#' : 'T'}
                          </span>
                        )}
                        {(col as { staged?: boolean }).staged && (
                          <span className="text-[8px] font-bold px-1 py-px rounded bg-blue-200/60 text-blue-700">NEW</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewEmps.map((emp, rowIdx) => (
                  <tr key={emp.id} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="sticky left-0 z-[5] bg-inherit border-r border-b border-slate-100 px-3 py-1.5 text-slate-300 font-mono text-[10px]">
                      {rowIdx + 1}
                    </td>
                    {allColumns.map((col, colIdx) => (
                      <td
                        key={col.key + colIdx}
                        className={`border-r border-b border-slate-100 px-3 py-1.5 text-slate-700 whitespace-nowrap transition-colors ${
                          selectedCol === colIdx ? 'bg-blue-50/60' : ''
                        }`}
                      >
                        {getCellValue(emp, col, columnValues, customColumnMap)}
                      </td>
                    ))}
                  </tr>
                ))}
                {employees.length > 15 && (
                  <tr>
                    <td colSpan={allColumns.length + 1} className="px-4 py-2 text-center text-slate-400 border-b border-slate-100 bg-slate-50/50">
                      ... {employees.length - 15} more rows (showing first 15 of {employees.length})
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {hasPendingChanges && (
          <div className="px-5 py-2.5 border-t border-amber-200 bg-amber-50/50 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-800 flex-1">
              <span className="font-semibold">Unpushed changes:</span>
              {stagedAdds.length > 0 && <span> {stagedAdds.length} column{stagedAdds.length !== 1 ? 's' : ''} to add</span>}
              {stagedAdds.length > 0 && stagedDeletes.length > 0 && <span>,</span>}
              {stagedDeletes.length > 0 && <span> {stagedDeletes.length} column{stagedDeletes.length !== 1 ? 's' : ''} to remove</span>}
              . Click "Push to Dashboard" to apply.
            </p>
            <button
              onClick={handlePushToDashboard}
              disabled={pushing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm"
            >
              <Upload className="w-3.5 h-3.5" /> Push Now
            </button>
          </div>
        )}

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{allColumns.length} columns total</span>
            <span className="w-px h-3 bg-slate-200" />
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300" />
              Custom columns
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300" />
              Formula columns
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-300" />
              Standard columns
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
