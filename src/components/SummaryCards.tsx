// ============================================================================
// Summary Cards
// ----------------------------------------------------------------------------
// The metrics dashboard at the top of the page. Shows different cards
// depending on the current role:
//
// HR Admin: Total salary increase cost, total employees, pending submissions,
//           promotions count, total comp impact
// SLT User: Their pool budget, how much they've allocated, remaining
// Finance:  Total employees, total cost impact, avg increase, total comp delta
// ============================================================================

import { DollarSign, Users, Clock, TrendingUp, Wallet, ArrowDownRight, Award } from 'lucide-react';
import type { Employee, SltPool, Role } from '../types';
import { formatCurrency, totalCompPrevious, totalCompNew } from '../types';

interface SummaryCardsProps {
  employees: Employee[];
  pools: SltPool[];
  role: Role;
  selectedSltOwner: string;
}

interface CardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'info';
  subtitle?: string;
}

function Card({ title, value, icon, variant = 'default', subtitle }: CardProps) {
  const variantStyles = {
    default: 'border-slate-200',
    success: 'border-emerald-200 bg-emerald-50/30',
    danger: 'border-red-200 bg-red-50/30',
    info: 'border-blue-200 bg-blue-50/30',
  };

  const valueColor = {
    default: 'text-slate-900',
    success: 'text-emerald-700',
    danger: 'text-red-700',
    info: 'text-blue-700',
  };

  return (
    <div className={`bg-white rounded-lg border p-4 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valueColor[variant]}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function SummaryCards({ employees, pools, role, selectedSltOwner }: SummaryCardsProps) {
  if (employees.length === 0) return null;

  // SLT User sees their own pool info
  if (role === 'SLT User' && selectedSltOwner) {
    const myEmployees = employees.filter(e => e.slt_owner === selectedSltOwner);
    const pool = pools.find(p => p.slt_owner === selectedSltOwner);
    const poolAmount = pool?.pool_amount || 0;
    const totalAllocated = myEmployees.reduce((sum, e) => sum + (e.new_salary_usd - e.current_salary_usd), 0);
    const remaining = poolAmount - totalAllocated;
    const promoCount = myEmployees.filter(e => e.change_reason === 'Promotion').length;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          title="Total Pool Assigned"
          value={formatCurrency(poolAmount)}
          icon={<Wallet className="w-5 h-5" />}
          variant="info"
        />
        <Card
          title="Total Allocated"
          value={formatCurrency(totalAllocated)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <Card
          title="Remaining Pool"
          value={formatCurrency(remaining)}
          icon={<ArrowDownRight className="w-5 h-5" />}
          variant={remaining < 0 ? 'danger' : 'success'}
        />
        <Card
          title="Promotions"
          value={String(promoCount)}
          icon={<Award className="w-5 h-5" />}
          subtitle={`of ${myEmployees.length} employees`}
        />
      </div>
    );
  }

  // Shared calculations for HR Admin and Finance
  const totalSalaryCost = employees.reduce((sum, e) => sum + (e.new_salary_usd - e.current_salary_usd), 0);
  const totalCompDelta = employees.reduce((sum, e) => sum + (totalCompNew(e) - totalCompPrevious(e)), 0);
  const promoCount = employees.filter(e => e.change_reason === 'Promotion').length;

  // Finance Viewer
  if (role === 'Finance Viewer') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          title="Total Employees"
          value={String(employees.length)}
          icon={<Users className="w-5 h-5" />}
        />
        <Card
          title="Total Salary Increase"
          value={formatCurrency(totalSalaryCost)}
          icon={<DollarSign className="w-5 h-5" />}
          variant={totalSalaryCost > 0 ? 'info' : 'default'}
        />
        <Card
          title="Total Comp Delta"
          value={formatCurrency(totalCompDelta)}
          icon={<TrendingUp className="w-5 h-5" />}
          subtitle="Salary + Bonus + LTIP change"
        />
        <Card
          title="Promotions"
          value={String(promoCount)}
          icon={<Award className="w-5 h-5" />}
          subtitle={`${employees.length > 0 ? ((promoCount / employees.length) * 100).toFixed(0) : 0}% of headcount`}
        />
      </div>
    );
  }

  // HR Admin
  const uniqueSltOwners = [...new Set(employees.map(e => e.slt_owner))];
  const pendingSubmissions = uniqueSltOwners.filter(owner => {
    const ownerEmps = employees.filter(e => e.slt_owner === owner);
    return ownerEmps.some(e => !e.slt_submitted);
  }).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        title="Total Salary Increase"
        value={formatCurrency(totalSalaryCost)}
        icon={<DollarSign className="w-5 h-5" />}
        variant={totalSalaryCost > 0 ? 'info' : 'default'}
      />
      <Card
        title="Total Employees"
        value={String(employees.length)}
        icon={<Users className="w-5 h-5" />}
        subtitle={`${promoCount} promotion${promoCount !== 1 ? 's' : ''}`}
      />
      <Card
        title="Pending SLT Submissions"
        value={String(pendingSubmissions)}
        icon={<Clock className="w-5 h-5" />}
        variant={pendingSubmissions > 0 ? 'danger' : 'success'}
      />
      <Card
        title="Total Comp Delta"
        value={formatCurrency(totalCompDelta)}
        icon={<TrendingUp className="w-5 h-5" />}
        subtitle="Salary + Bonus + LTIP change"
      />
    </div>
  );
}
