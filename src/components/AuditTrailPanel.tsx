import { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, Clock, RefreshCw, Search, Filter,
  ArrowUpDown, TrendingUp, Users, CheckCircle, Activity,
  ChevronUp,
} from 'lucide-react';
import type { Employee } from '../types';
import type { AuditEntry, ActionType } from '../utils/audit';

interface AuditTrailPanelProps {
  entries: AuditEntry[];
  employees: Employee[];
  loading: boolean;
  onRefresh: () => void;
}

const ACTION_LABELS: Record<ActionType, { label: string; color: string }> = {
  stage_change: { label: 'Stage Change', color: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200' },
  salary_change: { label: 'Salary Change', color: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200' },
  promotion: { label: 'Promotion', color: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200' },
  pool_change: { label: 'Pool Change', color: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200' },
  fx_rate_change: { label: 'FX Rate Change', color: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200' },
  fx_rate_add: { label: 'FX Rate Added', color: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200' },
  fx_rate_remove: { label: 'FX Rate Removed', color: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200' },
  column_add: { label: 'Column Added', color: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200' },
  column_remove: { label: 'Column Removed', color: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200' },
  slt_submit: { label: 'SLT Submit', color: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200' },
  slt_unlock: { label: 'SLT Unlock', color: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200' },
  data_import: { label: 'Data Import', color: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' },
  data_export: { label: 'Data Export', color: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200' },
  demo_load: { label: 'Demo Load', color: 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200' },
  cycle_reset: { label: 'Cycle Reset', color: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200' },
  employee_update: { label: 'Employee Update', color: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200' },
};

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type SortField = 'timestamp' | 'actor_name' | 'action_type' | 'entity_name';

export default function AuditTrailPanel({ entries, employees, loading, onRefresh }: AuditTrailPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const sltProgress = useMemo(() => {
    const owners = [...new Set(employees.map(e => e.slt_owner))].sort();
    return owners.map(owner => {
      const emps = employees.filter(e => e.slt_owner === owner);
      const allocated = emps.filter(e => e.increase_percent > 0).length;
      const submitted = emps.length > 0 && emps.every(e => e.slt_submitted);
      const promos = emps.filter(e => e.change_reason === 'Promotion').length;
      return { owner, total: emps.length, allocated, submitted, promos, pct: emps.length > 0 ? Math.round((allocated / emps.length) * 100) : 0 };
    });
  }, [employees]);

  const overallStats = useMemo(() => {
    const totalEmps = employees.length;
    const allocated = employees.filter(e => e.increase_percent > 0).length;
    const submitted = employees.filter(e => e.slt_submitted).length;
    const promos = employees.filter(e => e.change_reason === 'Promotion').length;
    return {
      pctAllocated: totalEmps > 0 ? Math.round((allocated / totalEmps) * 100) : 0,
      pctSubmitted: totalEmps > 0 ? Math.round((submitted / totalEmps) * 100) : 0,
      promos,
      totalActions: entries.length,
    };
  }, [employees, entries]);

  const filteredEntries = useMemo(() => {
    let result = [...entries];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.action_detail.toLowerCase().includes(q) ||
        e.actor_name.toLowerCase().includes(q) ||
        e.entity_name.toLowerCase().includes(q)
      );
    }
    if (filterRole) result = result.filter(e => e.actor_role === filterRole);
    if (filterAction) result = result.filter(e => e.action_type === filterAction);

    result.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [entries, search, filterRole, filterAction, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const roles = [...new Set(entries.map(e => e.actor_role))].sort();
  const actionTypes = [...new Set(entries.map(e => e.action_type))].sort();

  return (
    <div data-tour="audit-trail" className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => { setExpanded(!expanded); if (!expanded) onRefresh(); }}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Audit Trail</h3>
          {entries.length > 0 && (
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {entries.length} entries
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-200">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-sm gap-2">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
              Loading audit trail...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 p-4 bg-slate-50/50 border-b border-slate-200">
                <div className="bg-white rounded-lg border border-slate-100 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 tabular-nums">{overallStats.pctAllocated}%</p>
                    <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">Allocated</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-100 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 tabular-nums">{overallStats.pctSubmitted}%</p>
                    <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">Submitted</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-100 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4.5 h-4.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 tabular-nums">{overallStats.promos}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">Promotions</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-100 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4.5 h-4.5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 tabular-nums">{overallStats.totalActions}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">Actions</p>
                  </div>
                </div>
              </div>

              {sltProgress.length > 0 && (
                <div className="p-4 border-b border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">Progress by SLT Leader</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {sltProgress.map(s => (
                      <div key={s.owner} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-700 truncate">{s.owner}</span>
                            <div className="flex items-center gap-2 text-[10px]">
                              {s.promos > 0 && <span className="text-amber-600 font-medium">{s.promos} promo{s.promos !== 1 ? 's' : ''}</span>}
                              {s.submitted ? (
                                <span className="text-blue-600 font-semibold">Submitted</span>
                              ) : (
                                <span className="text-slate-400">{s.pct}% complete</span>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${s.submitted ? 'bg-blue-500' : 'bg-emerald-500'}`}
                              style={{ width: `${s.submitted ? 100 : s.pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search actions..."
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                    className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Roles</option>
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select
                    value={filterAction}
                    onChange={e => setFilterAction(e.target.value)}
                    className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Actions</option>
                    {actionTypes.map(a => (
                      <option key={a} value={a}>{ACTION_LABELS[a as ActionType]?.label || a}</option>
                    ))}
                  </select>
                </div>
                <button onClick={onRefresh} className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 transition-colors" title="Refresh">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {filteredEntries.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    {entries.length === 0 ? 'No audit entries yet. Actions will be logged as you use SAM.' : 'No entries match your filters.'}
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 z-[2]">
                      <tr>
                        {([
                          ['timestamp', 'Time'],
                          ['actor_name', 'Actor'],
                          ['action_type', 'Action'],
                          ['entity_name', 'Entity'],
                        ] as [SortField, string][]).map(([field, label]) => (
                          <th
                            key={field}
                            onClick={() => toggleSort(field)}
                            className="px-3 py-2 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wider cursor-pointer hover:text-slate-700 transition-colors border-b border-slate-200"
                          >
                            <span className="flex items-center gap-1">
                              {label}
                              <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-500' : 'text-slate-300'}`} />
                            </span>
                          </th>
                        ))}
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">Detail</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">Changes</th>
                        <th className="px-3 py-2 border-b border-slate-200 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry, i) => {
                        const actionInfo = ACTION_LABELS[entry.action_type] || { label: entry.action_type, color: 'bg-slate-100 text-slate-600' };
                        const isExpanded = expandedEntry === entry.id;
                        return (
                          <tr
                            key={entry.id || i}
                            className={`border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}
                            onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                          >
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{relativeTime(entry.timestamp)}</td>
                            <td className="px-3 py-2 font-medium text-slate-700">{entry.actor_name}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${actionInfo.color}`}>
                                {actionInfo.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600 truncate max-w-[150px]">{entry.entity_name}</td>
                            <td className="px-3 py-2 text-slate-500 truncate max-w-[200px]">{entry.action_detail}</td>
                            <td className="px-3 py-2">
                              {(entry.old_value || entry.new_value) && (
                                <div className="flex items-center gap-1 text-[10px]">
                                  {entry.old_value && <span className="line-through text-red-400">{entry.old_value}</span>}
                                  {entry.old_value && entry.new_value && <span className="text-slate-300">→</span>}
                                  {entry.new_value && <span className="text-emerald-600 font-medium">{entry.new_value}</span>}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-300" />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
