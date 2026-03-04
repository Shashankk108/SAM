import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Upload,
  BarChart3,
  Download,
  Users,
  GitBranch,
  Settings,
  TrendingUp,
  Wallet,
  Table2,
  RefreshCw,
  CheckCircle,
  Send,
  Eye,
  Clock,
} from 'lucide-react';

interface TourStep {
  target: string;
  icon: React.ElementType;
  title: string;
  description: string;
  requiredRole?: string;
  action?: () => void;
  cleanup?: () => void;
}

function buildHrAdminSteps(): TourStep[] {
  return [
    {
      target: 'role-selector',
      icon: Users,
      title: 'Switch Between Roles',
      description:
        'SAM supports three roles. As HR Admin, you manage the entire cycle, control stage progression, upload data, manage columns, and oversee all SLT submissions.',
    },
    {
      target: 'stage-pipeline',
      icon: GitBranch,
      title: 'Workflow Stages',
      description:
        'Every salary cycle moves through four stages: Draft (data setup), Allocation Open (SLT leaders assign raises), HR Review (final adjustments), and Finalized (locked for payroll export). You control advancement between stages.',
    },
    {
      target: 'hr-controls',
      icon: Settings,
      title: 'HR Admin Toolbar',
      description:
        'Upload CSV data, load demo data, open the Column Manager to add text, number, or formula columns. Save and load column templates, or apply them globally for all roles. Export data at any time. Stage controls let you advance or roll back the workflow.',
      requiredRole: 'HR Admin',
    },
    {
      target: 'summary-cards',
      icon: TrendingUp,
      title: 'Live Metrics Dashboard',
      description:
        'Key numbers update instantly as allocations change. Track total salary increase, total comp delta, promotions count, and pending SLT submissions at a glance.',
      requiredRole: 'HR Admin',
    },
    {
      target: 'pool-management',
      icon: Wallet,
      title: 'Budget Pool Management',
      description:
        'Assign a dollar budget to each SLT leader. This table tracks how much of each pool has been allocated and what remains. You can unlock SLT submissions here if changes are needed.',
      requiredRole: 'HR Admin',
    },
    {
      target: 'fx-rates',
      icon: RefreshCw,
      title: 'FX Rates & Currency Tooltips',
      description:
        'View currency exchange rates for the cycle. Employees paid in non-USD currencies show a conversion tooltip when you hover over their salary — showing the local amount, exchange rate, and USD equivalent.',
      requiredRole: 'HR Admin',
    },
    {
      target: 'audit-trail',
      icon: Clock,
      title: 'Audit Trail',
      description:
        'Track every action in the cycle: salary changes, promotions, SLT submissions, stage advances, and more. See completion progress per SLT leader, filter by role or action type, and drill into any entry for full details.',
      requiredRole: 'HR Admin',
    },
    {
      target: 'employee-table',
      icon: Table2,
      title: 'Employee Salary Table',
      description:
        'The core data table with all employees. Edit salary increases, change reasons, and review promotion details. Promotions require a new title, rationale, and responsibilities before submission. Formula columns auto-calculate based on salary data. Custom columns appear at the end.',
      requiredRole: 'HR Admin',
    },
    {
      target: 'employee-table',
      icon: CheckCircle,
      title: 'You\'re All Set!',
      description:
        'Explore freely! Try uploading data, assigning pools, advancing stages, and exporting the final UKG template. Open the Column Manager to add formula columns, save templates, or apply them globally.',
      requiredRole: 'HR Admin',
    },
  ];
}

function buildSltSteps(callbacks: TourCallbacks): TourStep[] {
  return [
    {
      target: 'role-selector',
      icon: Users,
      title: 'Your Role: SLT Leader',
      description:
        'As an SLT Leader, you allocate salary increases for your direct reports within an assigned budget. Select your name from the dropdown to see your team.',
    },
    {
      target: 'stage-pipeline',
      icon: GitBranch,
      title: 'Workflow Stages',
      description:
        'You can make changes during the "Allocation Open" stage. Once you submit, HR will review your allocations. After finalization, all data is locked.',
    },
    {
      target: 'summary-cards',
      icon: TrendingUp,
      title: 'Your Budget at a Glance',
      description:
        'See your assigned pool budget, how much you\'ve allocated, and how much remains. If you go over budget, you\'ll see a warning and won\'t be able to submit until you reduce.',
    },
    {
      target: 'employee-table',
      icon: Table2,
      title: 'Allocate Raises & Promotions',
      description:
        'Enter a percentage increase for each employee. To promote someone, change the reason to "Promotion" — the details section opens automatically. You must fill in the new title, rationale, and responsibilities (all mandatory). SVP-level titles are flagged for pre-approval.',
      action: () => callbacks.onAnimatePromotion?.(),
      cleanup: () => callbacks.onCleanupPromotion?.(),
    },
    {
      target: 'slt-submit',
      icon: Send,
      title: 'Submit When Ready',
      description:
        'After completing all allocations, click "Submit to HR" to lock in your changes. The button stays disabled until all promotion details are complete and you\'re within budget. Contact HR to unlock after submitting.',
      cleanup: () => callbacks.onCleanupPromotion?.(),
    },
    {
      target: 'summary-cards',
      icon: CheckCircle,
      title: 'You\'re All Set!',
      description:
        'Review each employee, set their increase percentage, and select promotions where applicable. Remember: SVP and above require pre-approval. Submit to HR when ready!',
    },
  ];
}

function buildFinanceSteps(): TourStep[] {
  return [
    {
      target: 'role-selector',
      icon: Users,
      title: 'Your Role: Finance Viewer',
      description:
        'As Finance Viewer, you have read-only access to all salary data across the organization. You can also manage FX conversion rates and export reports.',
    },
    {
      target: 'stage-pipeline',
      icon: GitBranch,
      title: 'Workflow Stages',
      description:
        'Monitor the current stage of the salary cycle. You can view data at any stage but cannot modify allocations or advance the workflow.',
    },
    {
      target: 'summary-cards',
      icon: TrendingUp,
      title: 'Financial Overview',
      description:
        'Key financial metrics update in real time. Track total salary increase, total comp delta (salary + bonus + LTIP changes), and promotion counts across the organization.',
    },
    {
      target: 'fx-rates',
      icon: RefreshCw,
      title: 'FX Conversion Rates',
      description:
        'You manage currency exchange rates for the cycle. Employees paid in non-USD currencies are automatically converted using these rates. Changing a rate instantly recalculates all affected salaries.',
      requiredRole: 'Finance Viewer',
    },
    {
      target: 'employee-table',
      icon: Table2,
      title: 'Employee Data (Read-Only)',
      description:
        'View all employee salary data, increases, bonuses, LTIP, and total compensation. Use the Export button to download full data or blank templates for offline review.',
    },
    {
      target: 'employee-table',
      icon: Eye,
      title: 'You\'re All Set!',
      description:
        'Browse employee data, manage FX rates, and export reports. All financial impacts are calculated in real time as the cycle progresses.',
    },
  ];
}

interface TourCallbacks {
  onAnimatePromotion?: () => void;
  onCleanupPromotion?: () => void;
}

function getStepsForRole(role: string, callbacks: TourCallbacks): TourStep[] {
  switch (role) {
    case 'SLT User': return buildSltSteps(callbacks);
    case 'Finance Viewer': return buildFinanceSteps();
    default: return buildHrAdminSteps();
  }
}

interface GuidedTourProps {
  show: boolean;
  onClose: () => void;
  onLoadDemoData: () => Promise<void>;
  hasEmployees: boolean;
  currentRole: string;
  onRoleChange: (role: string) => void;
  onAnimatePromotion?: () => void;
  onCleanupPromotion?: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function GuidedTour({
  show, onClose, onLoadDemoData, hasEmployees, currentRole, onRoleChange,
  onAnimatePromotion, onCleanupPromotion,
}: GuidedTourProps) {
  const [phase, setPhase] = useState<'welcome' | 'loading' | 'touring' | 'hidden'>('hidden');
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [tooltipPlacement, setTooltipPlacement] = useState<'top' | 'bottom'>('bottom');
  const [stepping, setStepping] = useState(false);
  const [roleBeforeTour, setRoleBeforeTour] = useState<string>('');
  const [tourSteps, setTourSteps] = useState<TourStep[]>([]);
  const cleanupRef = useRef<(() => void) | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (show) {
      setRoleBeforeTour(currentRole);
      setTourSteps(getStepsForRole(currentRole, { onAnimatePromotion, onCleanupPromotion }));
      setPhase('welcome');
    } else {
      setPhase('hidden');
    }
  }, [show]);

  useEffect(() => {
    if (phase === 'touring') {
      setTourSteps(getStepsForRole(
        roleBeforeTour || currentRole,
        { onAnimatePromotion, onCleanupPromotion }
      ));
    }
  }, [onAnimatePromotion, onCleanupPromotion]);

  const measureAndPosition = useCallback(() => {
    if (phase !== 'touring') return;

    const target = document.querySelector(`[data-tour="${tourSteps[step]?.target}"]`);
    if (!target) {
      setSpotlight(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const pad = 10;

    setSpotlight({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });

    const tooltipW = Math.min(420, window.innerWidth - 32);
    const tooltipH = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement = spaceBelow > tooltipH + 40 ? 'bottom' : 'top';
    setTooltipPlacement(placement);

    const centerX = rect.left + rect.width / 2;
    let left = centerX - tooltipW / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipW - 16));

    const top = placement === 'bottom' ? rect.bottom + 24 : rect.top - tooltipH - 24;

    setTooltipPos({ top: Math.max(16, top), left });
  }, [phase, step, tourSteps]);

  useEffect(() => {
    if (phase !== 'touring' || !tourSteps[step]) return;

    const requiredRole = tourSteps[step].requiredRole;
    if (requiredRole && currentRole !== requiredRole) {
      onRoleChange(requiredRole);
    } else if (!requiredRole && currentRole !== roleBeforeTour) {
      onRoleChange(roleBeforeTour || 'HR Admin');
    }

    const scrollTimer = setTimeout(() => {
      const target = document.querySelector(`[data-tour="${tourSteps[step].target}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    const actionTimer = setTimeout(() => {
      if (tourSteps[step].action) {
        tourSteps[step].action!();
      }
    }, 600);

    const posTimer = setTimeout(() => {
      measureAndPosition();
      setTimeout(() => setReady(true), 50);
    }, 800);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(actionTimer);
      clearTimeout(posTimer);
    };
  }, [phase, step, measureAndPosition, tourSteps]);

  useEffect(() => {
    if (phase !== 'touring') return;

    const onResize = () => measureAndPosition();
    const onScroll = () => measureAndPosition();

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [phase, measureAndPosition]);

  useEffect(() => {
    if (phase !== 'touring') return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') finish();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, step, tourSteps]);

  async function startTour() {
    if (!hasEmployees) {
      setPhase('loading');
      await onLoadDemoData();
      await new Promise(r => setTimeout(r, 600));
    }
    setReady(false);
    setSpotlight(null);
    setPhase('touring');
    setStep(0);
  }

  function runCleanup() {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = undefined;
    }
  }

  function next() {
    if (stepping) return;
    runCleanup();
    if (tourSteps[step]?.cleanup) {
      cleanupRef.current = tourSteps[step].cleanup;
    }
    if (step < tourSteps.length - 1) {
      setStepping(true);
      setReady(false);
      setTimeout(() => {
        setStep(s => s + 1);
        setStepping(false);
      }, 200);
    } else {
      finish();
    }
  }

  function prev() {
    if (stepping) return;
    runCleanup();
    if (step > 0) {
      setStepping(true);
      setReady(false);
      setTimeout(() => {
        setStep(s => s - 1);
        setStepping(false);
      }, 200);
    }
  }

  function finish() {
    runCleanup();
    if (roleBeforeTour && currentRole !== roleBeforeTour) {
      onRoleChange(roleBeforeTour);
    }
    setPhase('hidden');
    localStorage.setItem('sam_tour_seen', 'true');
    onClose();
  }

  if (phase === 'hidden') return null;

  if (phase === 'welcome' || phase === 'loading') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm tour-fade-in"
          onClick={() => { if (phase !== 'loading') finish(); }}
        />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden tour-scale-in">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-500" />

          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <BookOpen className="w-8 h-8 text-blue-600" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome to SAM</h2>
            <p className="text-sm text-slate-400 font-medium tracking-wide">Salary Allocation Manager</p>

            <div className="bg-slate-50 rounded-xl p-5 mt-6 text-left border border-slate-100">
              <p className="text-sm text-slate-600 leading-relaxed">
                SAM replaces manual spreadsheets for salary review cycles. It guides{' '}
                <span className="font-semibold text-slate-800">HR Admins</span>,{' '}
                <span className="font-semibold text-slate-800">SLT Leaders</span>, and{' '}
                <span className="font-semibold text-slate-800">Finance</span> through a complete
                raise and promotion workflow — from data upload to payroll export.
              </p>
              <p className="text-xs text-slate-400 mt-3">
                This tour is customized for your current role: <span className="font-semibold text-slate-600">{currentRole}</span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { Icon: Upload, label: 'Upload Data', color: 'text-blue-500' },
                { Icon: BarChart3, label: 'Allocate Raises', color: 'text-teal-500' },
                { Icon: Download, label: 'Export to Payroll', color: 'text-emerald-500' },
              ].map(({ Icon, label, color }) => (
                <div key={label} className="text-center group">
                  <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-1.5 group-hover:scale-110 transition-transform duration-200">
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{label}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-3">
              <button
                onClick={startTour}
                disabled={phase === 'loading'}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {phase === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Setting up demo data...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Take the Guided Tour
                    <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </button>
              <button
                onClick={finish}
                disabled={phase === 'loading'}
                className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
              >
                Skip, I'll explore on my own
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentStepData = tourSteps[step];
  if (!currentStepData) return null;

  const StepIcon = currentStepData.icon;
  const isLast = step === tourSteps.length - 1;
  const tooltipW = Math.min(420, typeof window !== 'undefined' ? window.innerWidth - 32 : 420);

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'none' }}>
      {spotlight && ready && (
        <div
          className="absolute rounded-xl tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
            pointerEvents: 'none',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="absolute inset-0 rounded-xl border-2 border-blue-400/60 tour-pulse-ring" />
          <div className="absolute inset-[-4px] rounded-xl border border-blue-300/30 tour-pulse-ring-outer" />
        </div>
      )}

      <div
        className={`absolute transition-all duration-300 ease-out ${!ready || stepping ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: tooltipW,
          pointerEvents: ready ? 'auto' : 'none',
          zIndex: 10000,
        }}
      >
        <div className={`bg-white rounded-xl shadow-2xl border border-slate-200/80 overflow-hidden tour-tooltip-enter ${tooltipPlacement === 'top' ? 'tour-arrow-bottom' : 'tour-arrow-top'}`}>
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500 ease-out rounded-r"
              style={{ width: `${((step + 1) / tourSteps.length) * 100}%` }}
            />
          </div>

          <div className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <StepIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                  Step {step + 1} of {tourSteps.length}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5 leading-tight">
                  {currentStepData.title}
                </h3>
              </div>
              <button onClick={finish} className="text-slate-300 hover:text-slate-500 transition-colors p-0.5 -mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed pl-[52px]">
              {currentStepData.description}
            </p>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
              <button
                onClick={prev}
                disabled={step === 0}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <div className="flex items-center gap-1.5">
                {tourSteps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step
                        ? 'w-6 bg-blue-500'
                        : i < step
                          ? 'w-1.5 bg-blue-300'
                          : 'w-1.5 bg-slate-200'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={next}
                className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                {isLast ? 'Finish' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
