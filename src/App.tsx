// ============================================================================
// SAM - Salary Allocation Manager (Main App)
// ----------------------------------------------------------------------------
// This is the root component that orchestrates the entire SAM application.
// It manages all the state (employees, pools, FX rates, custom columns),
// handles all the database operations via Supabase, and passes data/callbacks
// down to child components.
//
// KEY CONCEPTS:
// - Cycle: A single salary review period. Has a stage (Draft -> Finalized).
// - Roles: HR Admin, SLT User, Finance Viewer. Each sees different controls.
// - Custom Columns: HR can add/remove extra columns at any time.
// - Promotions: SLT picks "Promotion" as change reason, fills in new title,
//   rationale, and responsibilities. SVP+ titles get flagged.
// - Reset Cycle: HR can reset everything back to Draft with a confirmation.
//
// DATABASE TABLES USED:
// - sam_cycles: The salary review cycle (stage, name)
// - sam_employees: All employee salary data
// - sam_slt_pools: Budget pools per SLT leader
// - sam_fx_rates: Currency exchange rates
// - sam_custom_columns: HR-defined extra columns
// - sam_custom_column_values: Values for those extra columns per employee
// ============================================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Upload,
  Download,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Database,
  Send,
  Unlock,
  Lock,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Info,
  Settings,
  Trash2,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { generateDemoData, DEFAULT_POOLS, DEFAULT_FX_RATES } from './utils/demo-data';
import { parseCSV, exportUKGTemplate, exportBlankTemplate } from './utils/csv';
import { logAudit, fetchAuditTrail } from './utils/audit';
import type { AuditEntry } from './utils/audit';
import Header from './components/Header';
import EmployeeTable from './components/EmployeeTable';
import SummaryCards from './components/SummaryCards';
import GuidedTour from './components/GuidedTour';
import FxRatesPanel from './components/FxRatesPanel';
import SpreadsheetColumnManager from './components/SpreadsheetColumnManager';
import type { StagedColumn } from './components/SpreadsheetColumnManager';
import AuditTrailPanel from './components/AuditTrailPanel';
import type { Role, Stage, Employee, SltPool, FxRate, CustomColumn } from './types';
import { STAGES, STAGE_LABELS, formatCurrency, mapDbEmployee } from './types';

type NotificationType = 'success' | 'warning' | 'error';

function App() {
  // --- Core State ---
  const [role, setRole] = useState<Role>('HR Admin');
  const [selectedSltOwner, setSelectedSltOwner] = useState('');
  const [stage, setStage] = useState<Stage>('draft');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pools, setPools] = useState<SltPool[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [columnValues, setColumnValues] = useState<Record<string, Record<string, string>>>({});
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // --- UI State ---
  const [notification, setNotification] = useState<{ type: NotificationType; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTour, setShowTour] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [poolsCollapsed, setPoolsCollapsed] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [columnToRemove, setColumnToRemove] = useState<CustomColumn | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const auditTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // --- Derived State ---

  // All unique SLT owner names from the employee list
  const sltOwners = useMemo(
    () => [...new Set(employees.map(e => e.slt_owner))].sort(),
    [employees]
  );

  // Filter employees for SLT User role
  const visibleEmployees = useMemo(() => {
    if (role === 'SLT User' && selectedSltOwner) {
      return employees.filter(e => e.slt_owner === selectedSltOwner);
    }
    return employees;
  }, [employees, role, selectedSltOwner]);

  // Check if SLT's allocations exceed their pool budget
  const poolExceeded = useMemo(() => {
    if (role !== 'SLT User' || !selectedSltOwner) return false;
    const pool = pools.find(p => p.slt_owner === selectedSltOwner);
    if (!pool) return false;
    const totalAllocated = employees
      .filter(e => e.slt_owner === selectedSltOwner)
      .reduce((sum, e) => sum + (e.new_salary_usd - e.current_salary_usd), 0);
    return totalAllocated > pool.pool_amount;
  }, [role, selectedSltOwner, pools, employees]);

  // Check if the current SLT user has already submitted
  const sltAlreadySubmitted = useMemo(() => {
    if (role !== 'SLT User' || !selectedSltOwner) return false;
    const myEmps = employees.filter(e => e.slt_owner === selectedSltOwner);
    return myEmps.length > 0 && myEmps.every(e => e.slt_submitted);
  }, [role, selectedSltOwner, employees]);

  const hasIncompletePromotions = useMemo(() => {
    const relevant = role === 'SLT User' && selectedSltOwner
      ? employees.filter(e => e.slt_owner === selectedSltOwner)
      : employees;
    return relevant.some(e =>
      e.change_reason === 'Promotion' && (
        e.new_title.trim().length < 2 ||
        e.promo_rationale.trim().length < 10 ||
        e.new_responsibilities.trim().length < 10
      )
    );
  }, [employees, role, selectedSltOwner]);

  // --- Effects ---

  // Auto-select first SLT owner when switching to SLT role
  useEffect(() => {
    if (role === 'SLT User' && sltOwners.length > 0 && !sltOwners.includes(selectedSltOwner)) {
      setSelectedSltOwner(sltOwners[0]);
    }
  }, [role, sltOwners, selectedSltOwner]);

  // Load data on mount
  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setShowTour(true), 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return;
    function onClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showExportMenu]);

  // --- Helpers ---

  const notify = useCallback((type: NotificationType, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const refreshAudit = useCallback(async () => {
    if (!cycleId) return;
    setAuditLoading(true);
    const entries = await fetchAuditTrail(cycleId);
    setAuditEntries(entries);
    setAuditLoading(false);
  }, [cycleId]);

  // --- Data Loading ---
  // Fetches (or creates) the cycle, then loads all related data

  async function loadData() {
    setLoading(true);
    try {
      const { data: cycles } = await supabase
        .from('sam_cycles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      let cycle = cycles?.[0];
      if (!cycle) {
        const { data: newCycle } = await supabase
          .from('sam_cycles')
          .insert({ name: 'Salary Review Cycle – Corporate Pilot', stage: 'draft' })
          .select()
          .maybeSingle();
        cycle = newCycle;
      }

      if (cycle) {
        setCycleId(cycle.id);
        setStage(cycle.stage as Stage);

        // Load employees
        const { data: emps } = await supabase
          .from('sam_employees')
          .select('*')
          .eq('cycle_id', cycle.id)
          .order('employee_id');
        if (emps) setEmployees(emps.map(mapDbEmployee));

        // Load pools
        const { data: poolData } = await supabase
          .from('sam_slt_pools')
          .select('*')
          .eq('cycle_id', cycle.id);
        if (poolData) {
          setPools(poolData.map(p => ({ id: p.id, slt_owner: p.slt_owner, pool_amount: Number(p.pool_amount) })));
        }

        // Load FX rates
        const { data: rates } = await supabase
          .from('sam_fx_rates')
          .select('*')
          .eq('cycle_id', cycle.id)
          .order('currency_code');
        if (rates) {
          setFxRates(rates.map(r => ({ id: r.id, currency_code: r.currency_code, rate_to_usd: Number(r.rate_to_usd) })));
        }

        // Load custom columns and their values
        const { data: cols } = await supabase
          .from('sam_custom_columns')
          .select('*')
          .eq('cycle_id', cycle.id)
          .order('sort_order');
        if (cols) {
          setCustomColumns(cols.map(c => ({
            id: c.id, column_name: c.column_name, column_key: c.column_key,
            column_type: c.column_type, sort_order: c.sort_order, formula: c.formula || '',
            insert_after: c.insert_after || '',
          })));

          if (cols.length > 0) {
            const colIds = cols.map(c => c.id);
            const { data: vals } = await supabase
              .from('sam_custom_column_values')
              .select('*')
              .in('column_id', colIds);
            if (vals) {
              const valMap: Record<string, Record<string, string>> = {};
              for (const v of vals) {
                if (!valMap[v.column_id]) valMap[v.column_id] = {};
                valMap[v.column_id][v.employee_id] = v.value;
              }
              setColumnValues(valMap);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- Demo Data ---
  // Wipes the current cycle and loads fresh demo employees, pools, and FX rates

  async function handleLoadDemoData() {
    if (!cycleId) return;

    // Clean out old data
    await supabase.from('sam_custom_column_values').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sam_custom_columns').delete().eq('cycle_id', cycleId);
    await supabase.from('sam_employees').delete().eq('cycle_id', cycleId);
    await supabase.from('sam_slt_pools').delete().eq('cycle_id', cycleId);
    await supabase.from('sam_fx_rates').delete().eq('cycle_id', cycleId);

    // Reset stage to draft
    await supabase.from('sam_cycles').update({ stage: 'draft', updated_at: new Date().toISOString() }).eq('id', cycleId);
    setStage('draft');

    // Insert demo employees
    const demoData = generateDemoData();
    const toInsert = demoData.map(e => ({ ...e, cycle_id: cycleId }));
    const { data: insertedEmps } = await supabase.from('sam_employees').insert(toInsert).select();
    if (insertedEmps) setEmployees(insertedEmps.map(mapDbEmployee));

    // Insert pools
    const poolsToInsert = DEFAULT_POOLS.map(p => ({ ...p, cycle_id: cycleId }));
    const { data: insertedPools } = await supabase.from('sam_slt_pools').insert(poolsToInsert).select();
    if (insertedPools) {
      setPools(insertedPools.map(p => ({ id: p.id, slt_owner: p.slt_owner, pool_amount: Number(p.pool_amount) })));
    }

    // Insert FX rates
    const fxToInsert = DEFAULT_FX_RATES.map(r => ({ ...r, cycle_id: cycleId }));
    const { data: insertedRates } = await supabase.from('sam_fx_rates').insert(fxToInsert).select();
    if (insertedRates) {
      setFxRates(insertedRates.map(r => ({ id: r.id, currency_code: r.currency_code, rate_to_usd: Number(r.rate_to_usd) })));
    }

    setCustomColumns([]);
    setColumnValues({});
    logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'demo_load', actionDetail: `Loaded ${demoData.length} demo employees`, entityType: 'cycle', entityId: cycleId, entityName: 'Demo Data', metadata: { count: demoData.length } });
    notify('success', `Loaded ${demoData.length} demo employees with titles, bonuses, and FX rates`);
    refreshAudit();
  }

  // --- CSV Upload ---
  // Parses a CSV file and replaces all employees in the current cycle

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !cycleId) return;

    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.length === 0) {
      notify('error', 'No valid employee data found in CSV');
      return;
    }

    await supabase.from('sam_employees').delete().eq('cycle_id', cycleId);

    const toInsert = parsed.map(emp => ({
      ...emp,
      new_salary_usd: Math.round(emp.current_salary_usd * (1 + emp.increase_percent / 100) * 100) / 100,
      cycle_id: cycleId,
    }));

    const { data: insertedEmps } = await supabase.from('sam_employees').insert(toInsert).select();

    if (insertedEmps) {
      setEmployees(insertedEmps.map(mapDbEmployee));

      // Create pools for any new SLT owners found in the CSV
      const newOwners = [...new Set(parsed.map(emp => emp.slt_owner))];
      const existingPoolOwners = pools.map(p => p.slt_owner);
      const needPools = newOwners.filter(o => o && !existingPoolOwners.includes(o));

      if (needPools.length > 0) {
        const newPools = needPools.map(o => ({ cycle_id: cycleId, slt_owner: o, pool_amount: 0 }));
        const { data: insertedPools } = await supabase.from('sam_slt_pools').insert(newPools).select();
        if (insertedPools) {
          setPools(prev => [...prev, ...insertedPools.map(p => ({ id: p.id, slt_owner: p.slt_owner, pool_amount: Number(p.pool_amount) }))]);
        }
      }
    }

    logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'data_import', actionDetail: `Imported ${parsed.length} employees from CSV`, entityType: 'cycle', entityId: cycleId, entityName: file.name, metadata: { count: parsed.length } });
    notify('success', `Loaded ${parsed.length} employees from CSV`);
    if (fileInputRef.current) fileInputRef.current.value = '';
    refreshAudit();
  }

  // --- Employee Updates ---
  // Updates a single employee's fields (salary, reason, promotion fields, etc.)

  function handleUpdateEmployee(id: string, updates: Partial<Employee>) {
    setEmployees(prev =>
      prev.map(e => {
        if (e.id !== id) return e;
        const updated = { ...e, ...updates };

        const dbUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if ('increase_percent' in updates) dbUpdate.increase_percent = updated.increase_percent;
        if ('new_salary_usd' in updates) dbUpdate.new_salary_usd = updated.new_salary_usd;
        if ('new_salary_local' in updates) dbUpdate.new_salary_local = updated.new_salary_local;
        if ('change_reason' in updates) dbUpdate.change_reason = updated.change_reason;
        if ('new_title' in updates) dbUpdate.new_title = updated.new_title;
        if ('promo_rationale' in updates) dbUpdate.promo_rationale = updated.promo_rationale;
        if ('new_responsibilities' in updates) dbUpdate.new_responsibilities = updated.new_responsibilities;

        supabase.from('sam_employees').update(dbUpdate).eq('id', id).then(() => {});

        if ('change_reason' in updates && updates.change_reason === 'Promotion') {
          logAudit({ cycleId, actorRole: role, actorName: role === 'SLT User' ? selectedSltOwner : role, actionType: 'promotion', actionDetail: `Marked ${updated.employee_name} for promotion`, entityType: 'employee', entityId: id, entityName: updated.employee_name, oldValue: e.change_reason, newValue: 'Promotion' });
        }

        if ('increase_percent' in updates && updates.increase_percent !== e.increase_percent) {
          const existing = auditTimers.current.get(id);
          if (existing) clearTimeout(existing);
          auditTimers.current.set(id, setTimeout(() => {
            logAudit({ cycleId, actorRole: role, actorName: role === 'SLT User' ? selectedSltOwner : role, actionType: 'salary_change', actionDetail: `Changed ${updated.employee_name} increase to ${updated.increase_percent}%`, entityType: 'employee', entityId: id, entityName: updated.employee_name, oldValue: `${e.increase_percent}%`, newValue: `${updated.increase_percent}%` });
            auditTimers.current.delete(id);
          }, 1500));
        }

        return updated;
      })
    );
  }

  // --- Stage Management ---

  async function handleStageChange(newStage: Stage) {
    if (!cycleId) return;

    await supabase.from('sam_cycles').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', cycleId);
    setStage(newStage);

    // When finalizing, lock all employees
    if (newStage === 'finalized') {
      const updated = employees.map(e => ({ ...e, status: 'Finalized' as const }));
      setEmployees(updated);
      await supabase.from('sam_employees').update({ status: 'Finalized', updated_at: new Date().toISOString() }).eq('cycle_id', cycleId);
    }

    logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'stage_change', actionDetail: `Stage changed to ${STAGE_LABELS[newStage]}`, entityType: 'cycle', entityId: cycleId || '', entityName: 'Cycle', oldValue: STAGE_LABELS[stage], newValue: STAGE_LABELS[newStage] });
    notify('success', `Stage changed to ${STAGE_LABELS[newStage]}`);
    refreshAudit();
  }

  // --- Reset Cycle ---
  // Resets stage to Draft, unlocks all SLT submissions, sets everyone to Pending

  async function handleResetCycle() {
    if (!cycleId) return;

    await supabase.from('sam_cycles').update({ stage: 'draft', updated_at: new Date().toISOString() }).eq('id', cycleId);
    setStage('draft');

    // Reset all employees to Pending / not submitted
    const updated = employees.map(e => ({ ...e, status: 'Pending' as const, slt_submitted: false }));
    setEmployees(updated);
    await supabase.from('sam_employees').update({
      status: 'Pending',
      slt_submitted: false,
      updated_at: new Date().toISOString(),
    }).eq('cycle_id', cycleId);

    logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'cycle_reset', actionDetail: 'Cycle reset to Draft', entityType: 'cycle', entityId: cycleId, entityName: 'Cycle' });
    notify('success', 'Cycle reset to Draft. All submissions unlocked.');
    refreshAudit();
  }

  // --- Pool Management ---

  async function handlePoolChange(sltOwner: string, amount: number) {
    const existing = pools.find(p => p.slt_owner === sltOwner);
    if (existing?.id) {
      await supabase.from('sam_slt_pools').update({ pool_amount: amount }).eq('id', existing.id);
    }
    setPools(prev => prev.map(p => (p.slt_owner === sltOwner ? { ...p, pool_amount: amount } : p)));
  }

  // --- SLT Submit ---

  async function handleSltSubmit() {
    if (!cycleId || !selectedSltOwner || poolExceeded) return;

    const updated = employees.map(e => {
      if (e.slt_owner !== selectedSltOwner) return e;
      return { ...e, slt_submitted: true, status: 'SLT Submitted' as const };
    });
    setEmployees(updated);

    await supabase.from('sam_employees').update({
      slt_submitted: true, status: 'SLT Submitted', updated_at: new Date().toISOString(),
    }).eq('cycle_id', cycleId).eq('slt_owner', selectedSltOwner);

    logAudit({ cycleId, actorRole: role, actorName: selectedSltOwner, actionType: 'slt_submit', actionDetail: `${selectedSltOwner} submitted allocations to HR`, entityType: 'slt', entityId: selectedSltOwner, entityName: selectedSltOwner });
    notify('success', `Submitted allocations to HR for ${selectedSltOwner}`);
    refreshAudit();
  }

  // --- Unlock SLT ---

  async function handleUnlockSlt(sltOwner: string) {
    if (!cycleId) return;

    const updated = employees.map(e => {
      if (e.slt_owner !== sltOwner) return e;
      return { ...e, slt_submitted: false, status: 'Pending' as const };
    });
    setEmployees(updated);

    await supabase.from('sam_employees').update({
      slt_submitted: false, status: 'Pending', updated_at: new Date().toISOString(),
    }).eq('cycle_id', cycleId).eq('slt_owner', sltOwner);

    logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'slt_unlock', actionDetail: `Unlocked ${sltOwner}'s submissions`, entityType: 'slt', entityId: sltOwner, entityName: sltOwner });
    notify('success', `Unlocked ${sltOwner}'s submissions`);
    refreshAudit();
  }

  // --- FX Rate Handlers ---

  async function handleUpdateFxRate(currencyCode: string, rate: number) {
    if (!cycleId) return;
    const oldRate = fxRates.find(r => r.currency_code === currencyCode)?.rate_to_usd;
    setFxRates(prev => prev.map(r => (r.currency_code === currencyCode ? { ...r, rate_to_usd: rate } : r)));
    await supabase.from('sam_fx_rates').update({ rate_to_usd: rate, updated_at: new Date().toISOString() })
      .eq('cycle_id', cycleId).eq('currency_code', currencyCode);
    logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'fx_rate_change', actionDetail: `Changed ${currencyCode} rate`, entityType: 'fx_rate', entityId: currencyCode, entityName: currencyCode, oldValue: String(oldRate), newValue: String(rate) });

    // Recalculate USD salaries for affected employees
    setEmployees(prev => prev.map(e => {
      if (e.local_currency !== currencyCode) return e;
      const newUsd = Math.round(e.new_salary_local * rate * 100) / 100;
      const currentUsd = Math.round(e.current_salary_local * rate * 100) / 100;
      supabase.from('sam_employees').update({ new_salary_usd: newUsd, current_salary_usd: currentUsd, updated_at: new Date().toISOString() }).eq('id', e.id).then(() => {});
      return { ...e, new_salary_usd: newUsd, current_salary_usd: currentUsd };
    }));
  }

  async function handleAddFxRate(currencyCode: string, rate: number) {
    if (!cycleId) return;
    const { data } = await supabase.from('sam_fx_rates')
      .insert({ cycle_id: cycleId, currency_code: currencyCode, rate_to_usd: rate })
      .select().maybeSingle();
    if (data) {
      setFxRates(prev => [...prev, { id: data.id, currency_code: data.currency_code, rate_to_usd: Number(data.rate_to_usd) }]);
      logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'fx_rate_add', actionDetail: `Added ${currencyCode} rate at ${rate}`, entityType: 'fx_rate', entityId: currencyCode, entityName: currencyCode, newValue: String(rate) });
    }
  }

  async function handleRemoveFxRate(currencyCode: string) {
    if (!cycleId) return;
    await supabase.from('sam_fx_rates').delete().eq('cycle_id', cycleId).eq('currency_code', currencyCode);
    setFxRates(prev => prev.filter(r => r.currency_code !== currencyCode));
    logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'fx_rate_remove', actionDetail: `Removed ${currencyCode} rate`, entityType: 'fx_rate', entityId: currencyCode, entityName: currencyCode });
  }

  // --- Custom Column Handlers ---
  // HR Admin can add new columns, remove them, and edit values per employee.
  // Changes immediately reflect in the CSV/Excel export.

  async function handlePushColumnChanges(adds: StagedColumn[], deleteIds: string[]) {
    if (!cycleId) return;

    for (const delId of deleteIds) {
      const col = customColumns.find(c => c.id === delId);
      if (!col) continue;
      await supabase.from('sam_custom_column_values').delete().eq('column_id', delId);
      await supabase.from('sam_custom_columns').delete().eq('id', delId);
      logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'column_remove', actionDetail: `Removed column "${col.column_name}"`, entityType: 'column', entityId: delId, entityName: col.column_name });
    }

    if (deleteIds.length > 0) {
      setCustomColumns(prev => prev.filter(c => !deleteIds.includes(c.id)));
      setColumnValues(prev => {
        const next = { ...prev };
        for (const id of deleteIds) delete next[id];
        return next;
      });
    }

    const newColumns: CustomColumn[] = [];
    for (const add of adds) {
      const existingKeys = [
        ...customColumns.map(c => c.column_key),
        ...newColumns.map(c => c.column_key),
      ];
      let key = add.column_key;
      let suffix = 2;
      while (existingKeys.includes(key)) {
        key = `${add.column_key}_${suffix}`;
        suffix++;
      }

      const sortOrder = customColumns.length + newColumns.length;
      const { data, error } = await supabase.from('sam_custom_columns')
        .insert({
          cycle_id: cycleId,
          column_name: add.column_name,
          column_key: key,
          column_type: add.column_type,
          sort_order: sortOrder,
          formula: add.formula || '',
          insert_after: add.insert_after || '',
        })
        .select().maybeSingle();

      if (error) {
        notify('error', `Failed to add column "${add.column_name}": ${error.message}`);
        continue;
      }
      if (data) {
        newColumns.push({
          id: data.id, column_name: data.column_name, column_key: data.column_key,
          column_type: data.column_type, sort_order: data.sort_order, formula: data.formula || '',
          insert_after: data.insert_after || '',
        });
        logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'column_add', actionDetail: `Added column "${add.column_name}" (${add.column_type})`, entityType: 'column', entityId: data.id, entityName: add.column_name });
      }
    }

    if (newColumns.length > 0) {
      setCustomColumns(prev => [...prev, ...newColumns]);
    }

    const totalChanges = deleteIds.length + adds.length;
    notify('success', `Pushed ${totalChanges} column change${totalChanges !== 1 ? 's' : ''} to dashboard`);
    refreshAudit();
  }

  async function handleRemoveColumn(columnId: string) {
    // Find the column to show its name in the confirmation
    const col = customColumns.find(c => c.id === columnId);
    if (col) setColumnToRemove(col);
  }

  async function confirmRemoveColumn() {
    if (!columnToRemove) return;
    // Delete all values for this column, then the column itself
    await supabase.from('sam_custom_column_values').delete().eq('column_id', columnToRemove.id);
    await supabase.from('sam_custom_columns').delete().eq('id', columnToRemove.id);

    setCustomColumns(prev => prev.filter(c => c.id !== columnToRemove.id));
    setColumnValues(prev => {
      const next = { ...prev };
      delete next[columnToRemove.id];
      return next;
    });
    logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'column_remove', actionDetail: `Removed column "${columnToRemove.column_name}"`, entityType: 'column', entityId: columnToRemove.id, entityName: columnToRemove.column_name });
    notify('success', `Removed column "${columnToRemove.column_name}"`);
    setColumnToRemove(null);
    refreshAudit();
  }

  async function handleUpdateColumnValue(columnId: string, employeeId: string, value: string) {
    setColumnValues(prev => ({
      ...prev,
      [columnId]: { ...prev[columnId], [employeeId]: value },
    }));

    const { data: existing } = await supabase.from('sam_custom_column_values')
      .select('id').eq('column_id', columnId).eq('employee_id', employeeId).maybeSingle();

    if (existing) {
      await supabase.from('sam_custom_column_values').update({ value }).eq('id', existing.id);
    } else {
      await supabase.from('sam_custom_column_values').insert({ column_id: columnId, employee_id: employeeId, value });
    }
  }

  // --- Export ---

  function handleExport() {
    exportUKGTemplate(employees, customColumns, columnValues);
    setShowExportMenu(false);
    logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'data_export', actionDetail: `Exported full data (${employees.length} employees)`, entityType: 'cycle', entityId: cycleId || '', entityName: 'Full Export', metadata: { count: employees.length } });
    notify('success', 'Exported sam_ukg_upload_template.csv');
  }

  function handleExportBlank() {
    exportBlankTemplate(customColumns);
    setShowExportMenu(false);
    logAudit({ cycleId, actorRole: role, actorName: role, actionType: 'data_export', actionDetail: 'Exported blank template', entityType: 'cycle', entityId: cycleId || '', entityName: 'Blank Template' });
    notify('success', 'Exported sam_upload_blank_template.csv');
  }

  // --- Computed ---

  const stageIndex = STAGES.indexOf(stage);
  const canAdvance = stageIndex < STAGES.length - 1;
  const canRevert = stageIndex > 0 && stage !== 'finalized';

  const tourDemoEmpRef = useRef<string | null>(null);

  const handleTourAnimatePromotion = useCallback(() => {
    const first = visibleEmployees.find(e => e.change_reason !== 'Promotion');
    if (!first) return;
    tourDemoEmpRef.current = first.id;
    handleUpdateEmployee(first.id, { change_reason: 'Promotion' });
  }, [visibleEmployees]);

  const handleTourCleanupPromotion = useCallback(() => {
    const empId = tourDemoEmpRef.current;
    if (!empId) return;
    tourDemoEmpRef.current = null;
    handleUpdateEmployee(empId, {
      change_reason: 'Merit Increase',
      new_title: '',
      promo_rationale: '',
      new_responsibilities: '',
    });
  }, []);

  // --- Loading Screen ---

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          Loading SAM...
        </div>
      </div>
    );
  }

  // --- Main Render ---

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        role={role}
        onRoleChange={setRole}
        stage={stage}
        selectedSltOwner={selectedSltOwner}
        onSltOwnerChange={setSelectedSltOwner}
        sltOwners={sltOwners}
        onStartTour={() => setShowTour(true)}
        onResetCycle={handleResetCycle}
      />

      {/* Notification bar */}
      {notification && (
        <div className={`border-b px-6 py-3 flex items-center gap-2 text-sm font-medium transition-all ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : notification.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {notification.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
          {notification.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
          {notification.type === 'error' && <XCircle className="w-4 h-4" />}
          {notification.message}
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">

        {/* HR Admin Toolbar */}
        {role === 'HR Admin' && (
          <div data-tour="hr-controls" className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" id="csv-upload" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={stage === 'finalized'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="w-4 h-4" /> Upload CSV
              </button>

              <button
                onClick={handleLoadDemoData}
                disabled={stage === 'finalized'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Database className="w-4 h-4" /> Load Demo Data
              </button>

              <div className="h-8 w-px bg-slate-200 mx-1" />

              <button
                onClick={() => setShowColumnManager(true)}
                disabled={stage === 'finalized'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Settings className="w-4 h-4" /> Column Manager
              </button>

              <div ref={exportMenuRef} className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={employees.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-4 h-4" /> Export <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 tour-scale-in">
                    <button onClick={handleExport} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                      <span className="font-medium">Export Full Data</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Complete data with all columns</span>
                    </button>
                    <button onClick={handleExportBlank} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                      <span className="font-medium">Export Blank Template</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Empty CSV for fresh data upload</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="h-8 w-px bg-slate-200 mx-1" />

              <button
                onClick={() => handleStageChange(STAGES[stageIndex - 1])}
                disabled={!canRevert}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <button
                onClick={() => handleStageChange(STAGES[stageIndex + 1])}
                disabled={!canAdvance || employees.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {stageIndex === STAGES.length - 2 ? (
                  <><Lock className="w-4 h-4" /> Finalize Cycle</>
                ) : (
                  <>Advance Stage <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Finance export button */}
        {role === 'Finance Viewer' && employees.length > 0 && (
          <div className="flex justify-end">
            <div ref={exportMenuRef} className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download className="w-4 h-4" /> Export <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 tour-scale-in">
                  <button onClick={handleExport} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                    <span className="font-medium">Export Full Data</span>
                    <span className="block text-xs text-slate-400 mt-0.5">Complete data with all columns</span>
                  </button>
                  <button onClick={handleExportBlank} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                    <span className="font-medium">Export Blank Template</span>
                    <span className="block text-xs text-slate-400 mt-0.5">Empty CSV for fresh data upload</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLT pool exceeded warning */}
        {role === 'SLT User' && poolExceeded && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Pool exceeded. Reduce allocations.</p>
              <p className="text-xs text-red-600 mt-0.5">Your total salary increases exceed the assigned pool budget.</p>
            </div>
          </div>
        )}

        {/* Finalized banner */}
        {stage === 'finalized' && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 flex items-center gap-3">
            <Lock className="w-5 h-5 text-teal-600 flex-shrink-0" />
            <p className="text-sm font-medium text-teal-800">Cycle finalized. All data is locked. Export the UKG template for upload.</p>
          </div>
        )}

        {/* Summary Dashboard */}
        <div data-tour="summary-cards">
          <SummaryCards employees={employees} pools={pools} role={role} selectedSltOwner={selectedSltOwner} />
        </div>

        {/* FX Rates Panel */}
        {(role === 'Finance Viewer' || role === 'HR Admin') && fxRates.length > 0 && (
          <FxRatesPanel
            fxRates={fxRates} role={role} stage={stage}
            onUpdateRate={handleUpdateFxRate} onAddRate={handleAddFxRate} onRemoveRate={handleRemoveFxRate}
          />
        )}

        {/* Pool Management Table (HR Admin only) */}
        {role === 'HR Admin' && employees.length > 0 && sltOwners.length > 0 && (
          <div data-tour="pool-management" className="bg-white border border-slate-200 rounded-lg">
            <button
              onClick={() => setPoolsCollapsed(prev => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between border-b border-slate-200 hover:bg-slate-50/50 transition-colors"
            >
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-400" /> Pool Management
                <span className="text-[10px] font-normal text-slate-400 ml-1">
                  {sltOwners.length} SLT leader{sltOwners.length !== 1 ? 's' : ''}
                </span>
              </h3>
              {poolsCollapsed ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              )}
            </button>
            {!poolsCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left border-b border-slate-200">
                      <th className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider">SLT Owner</th>
                      <th className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">Pool Amount</th>
                      <th className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">Total Allocated</th>
                      <th className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">Remaining</th>
                      <th className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider text-center">SLT Status</th>
                      <th className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sltOwners.map(owner => {
                      const pool = pools.find(p => p.slt_owner === owner);
                      const ownerEmps = employees.filter(e => e.slt_owner === owner);
                      const totalAllocated = ownerEmps.reduce((sum, e) => sum + (e.new_salary_usd - e.current_salary_usd), 0);
                      const poolAmount = pool?.pool_amount || 0;
                      const remaining = poolAmount - totalAllocated;
                      const isSubmitted = ownerEmps.length > 0 && ownerEmps.every(e => e.slt_submitted);
                      const isExceeded = totalAllocated > poolAmount && poolAmount > 0;

                      return (
                        <tr key={owner} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-medium text-slate-800">{owner}</td>
                          <td className="px-4 py-2.5 text-right">
                            {stage !== 'finalized' ? (
                              <input type="number" value={poolAmount || ''} onChange={e => handlePoolChange(owner, parseFloat(e.target.value) || 0)}
                                className="w-32 px-2 py-1 border border-slate-300 rounded text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0" min="0" />
                            ) : (
                              <span className="font-mono tabular-nums">{formatCurrency(poolAmount)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">{formatCurrency(totalAllocated)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono tabular-nums font-medium ${isExceeded ? 'text-red-600' : remaining > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {formatCurrency(remaining)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isSubmitted ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200' : 'bg-slate-100 text-slate-500'}`}>
                              {isSubmitted ? (<><Lock className="w-3 h-3" /> Submitted</>) : 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {isSubmitted && stage !== 'finalized' && (
                              <button onClick={() => handleUnlockSlt(owner)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
                              >
                                <Unlock className="w-3 h-3" /> Unlock
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Audit Trail (HR Admin only) */}
        {role === 'HR Admin' && (
          <AuditTrailPanel
            entries={auditEntries}
            employees={employees}
            loading={auditLoading}
            onRefresh={refreshAudit}
          />
        )}

        {/* Employee Table */}
        <div data-tour="employee-table">
          <EmployeeTable
            employees={visibleEmployees}
            role={role}
            stage={stage}
            selectedSltOwner={selectedSltOwner}
            onUpdateEmployee={handleUpdateEmployee}
            customColumns={customColumns}
            columnValues={columnValues}
            onUpdateColumnValue={handleUpdateColumnValue}
            onRemoveColumn={handleRemoveColumn}
            fxRates={fxRates}
          />
        </div>

        {/* SLT Submit Button */}
        {role === 'SLT User' && (showTour || (stage === 'allocation_open' && !sltAlreadySubmitted && visibleEmployees.length > 0)) && (
          <div data-tour="slt-submit" className="flex flex-col items-end gap-2">
            {hasIncompletePromotions && stage === 'allocation_open' && !sltAlreadySubmitted && visibleEmployees.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                Complete all promotion details (new title, rationale, responsibilities) before submitting.
              </div>
            )}
            {stage === 'allocation_open' && !sltAlreadySubmitted && visibleEmployees.length > 0 && (
              <button onClick={handleSltSubmit} disabled={poolExceeded || hasIncompletePromotions}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" /> Submit to HR
              </button>
            )}
          </div>
        )}

        {/* SLT already submitted banner */}
        {role === 'SLT User' && sltAlreadySubmitted && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <p className="text-sm font-medium text-blue-800">Your allocations have been submitted to HR for review.</p>
          </div>
        )}

      </main>

      {/* Modals & Overlays */}
      <GuidedTour
        show={showTour}
        onClose={() => setShowTour(false)}
        onLoadDemoData={handleLoadDemoData}
        hasEmployees={employees.length > 0}
        currentRole={role}
        onRoleChange={(r) => setRole(r as Role)}
        onAnimatePromotion={handleTourAnimatePromotion}
        onCleanupPromotion={handleTourCleanupPromotion}
      />
      <SpreadsheetColumnManager
        open={showColumnManager}
        onClose={() => setShowColumnManager(false)}
        columns={customColumns}
        columnValues={columnValues}
        employees={employees}
        onPushChanges={handlePushColumnChanges}
      />

      {/* Confirm Remove Column Dialog */}
      {columnToRemove && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setColumnToRemove(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 tour-scale-in overflow-hidden">
            <div className="h-1 bg-red-500" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Remove Column?</h3>
                  <p className="text-xs text-slate-500 mt-0.5">"{columnToRemove.column_name}"</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-5">
                This will permanently remove the column and all its data from every employee. This also
                updates future CSV/Excel exports.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setColumnToRemove(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
                <button onClick={confirmRemoveColumn} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                  Remove Column
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
