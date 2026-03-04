// ============================================================================
// Header Component
// ----------------------------------------------------------------------------
// The top bar of SAM. Shows the app title, stage pipeline, role selector,
// SLT owner selector (when in SLT mode), and action buttons.
//
// KEY FEATURES:
// - "Reset Cycle" button: resets the entire cycle back to Draft stage,
//   clears all SLT submissions and sets everyone to Pending.
//   Shows a confirmation dialog first so nobody accidentally loses work.
// - "Tour" button: starts the guided walkthrough
// - Stage pipeline: visual breadcrumb of the 4 workflow stages
// ============================================================================

import { Fragment, useState } from 'react';
import { ChevronRight, Shield, Users, Eye, HelpCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import type { Role, Stage } from '../types';
import { STAGE_LABELS, STAGES } from '../types';

interface HeaderProps {
  role: Role;
  onRoleChange: (role: Role) => void;
  stage: Stage;
  selectedSltOwner: string;
  onSltOwnerChange: (owner: string) => void;
  sltOwners: string[];
  onStartTour: () => void;
  onResetCycle: () => void;
}

const ROLE_ICONS = {
  'HR Admin': Shield,
  'SLT User': Users,
  'Finance Viewer': Eye,
};

export default function Header({
  role,
  onRoleChange,
  stage,
  selectedSltOwner,
  onSltOwnerChange,
  sltOwners,
  onStartTour,
  onResetCycle,
}: HeaderProps) {
  const Icon = ROLE_ICONS[role];
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                SAM
                <span className="text-slate-300 font-light mx-1.5">/</span>
                <span className="font-normal text-slate-600">Salary Allocation Manager</span>
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Salary Review Cycle &ndash; Corporate Pilot
              </p>
            </div>

            <div className="flex items-center gap-3">
              {role === 'HR Admin' && stage !== 'draft' && (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Reset cycle back to Draft stage"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Cycle
                </button>
              )}

              <button
                onClick={onStartTour}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title="Take a guided tour"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Tour
              </button>

              {role === 'SLT User' && sltOwners.length > 0 && (
                <select
                  value={selectedSltOwner}
                  onChange={e => onSltOwnerChange(e.target.value)}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {sltOwners.map(owner => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              )}

              <div data-tour="role-selector" className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                <Icon className="w-4 h-4 text-slate-500" />
                <select
                  value={role}
                  onChange={e => onRoleChange(e.target.value as Role)}
                  className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer pr-1"
                >
                  <option value="HR Admin">HR Admin</option>
                  <option value="SLT User">SLT User</option>
                  <option value="Finance Viewer">Finance Viewer</option>
                </select>
              </div>
            </div>
          </div>

          <div data-tour="stage-pipeline" className="flex items-center gap-1.5 mt-4">
            {STAGES.map((s, i) => {
              const currentIndex = STAGES.indexOf(stage);
              const isActive = s === stage;
              const isPast = i < currentIndex;

              return (
                <Fragment key={s}>
                  {i > 0 && (
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${i <= currentIndex ? 'text-blue-400' : 'text-slate-300'}`} />
                  )}
                  <div className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isPast
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-400'
                  }`}>
                    {STAGE_LABELS[s]}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </header>

      {showResetConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 tour-scale-in overflow-hidden">
            <div className="h-1 bg-red-500" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reset Entire Cycle?</h3>
                  <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone</p>
                </div>
              </div>

              <div className="bg-red-50/50 border border-red-100 rounded-lg p-3 mb-5">
                <p className="text-xs text-red-800 leading-relaxed">
                  This will reset the cycle back to <strong>Draft</strong> stage. All SLT submissions
                  will be unlocked, all employee statuses will return to <strong>Pending</strong>,
                  and every SLT member will need to re-submit their allocations.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    onResetCycle();
                  }}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                >
                  Yes, Reset to Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
