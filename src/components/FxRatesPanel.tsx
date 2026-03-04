import { useState } from 'react';
import { RefreshCw, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { FxRate, Role, Stage } from '../types';
import { COMMON_CURRENCIES } from '../types';

interface FxRatesPanelProps {
  fxRates: FxRate[];
  role: Role;
  stage: Stage;
  onUpdateRate: (currencyCode: string, rate: number) => void;
  onAddRate: (currencyCode: string, rate: number) => void;
  onRemoveRate: (currencyCode: string) => void;
}

export default function FxRatesPanel({
  fxRates,
  role,
  stage,
  onUpdateRate,
  onAddRate,
  onRemoveRate,
}: FxRatesPanelProps) {
  const [addCurrency, setAddCurrency] = useState('');
  const [expanded, setExpanded] = useState(false);
  const canEdit = role === 'Finance Viewer' && stage !== 'finalized';
  const existingCodes = fxRates.map(r => r.currency_code);
  const availableCurrencies = COMMON_CURRENCIES.filter(c => !existingCodes.includes(c));

  return (
    <div data-tour="fx-rates" className="bg-white border border-slate-200 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors rounded-lg"
      >
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <RefreshCw className="w-4 h-4 text-slate-400" />
          FX Conversion Rates
          <span className="text-xs font-normal text-slate-400 ml-1">({fxRates.length} currencies)</span>
        </h3>
        <span className="text-xs text-slate-400">Base: USD</span>
      </button>

      {expanded && (
        <>
          <div className="border-t border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-200">
                  <th className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                    Currency
                  </th>
                  <th className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">
                    Rate to USD
                  </th>
                  <th className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider text-right">
                    1 unit = USD
                  </th>
                  {canEdit && (
                    <th className="px-4 py-2 font-semibold text-slate-600 text-xs uppercase tracking-wider text-center w-16" />
                  )}
                </tr>
              </thead>
              <tbody>
                {fxRates.map(rate => {
                  const isBase = rate.currency_code === 'USD';
                  return (
                    <tr key={rate.currency_code} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-8 h-5 bg-slate-100 rounded text-[10px] font-bold text-slate-600 flex items-center justify-center">
                            {rate.currency_code}
                          </span>
                          {isBase && (
                            <span className="text-[10px] text-slate-400 font-medium uppercase">Base</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canEdit && !isBase ? (
                          <input
                            type="number"
                            value={rate.rate_to_usd}
                            onChange={e => onUpdateRate(rate.currency_code, parseFloat(e.target.value) || 0)}
                            className="w-28 px-2 py-1 border border-slate-300 rounded text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            step="0.0001"
                            min="0"
                          />
                        ) : (
                          <span className="font-mono tabular-nums text-slate-700">
                            {rate.rate_to_usd.toFixed(4)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500 text-xs">
                        ${rate.rate_to_usd.toFixed(4)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-2.5 text-center">
                          {!isBase && (
                            <button
                              onClick={() => onRemoveRate(rate.currency_code)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                              title="Remove currency"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canEdit && availableCurrencies.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
              <select
                value={addCurrency}
                onChange={e => setAddCurrency(e.target.value)}
                className="text-sm border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Add currency...</option>
                {availableCurrencies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (addCurrency) {
                    onAddRate(addCurrency, 1.0);
                    setAddCurrency('');
                  }
                }}
                disabled={!addCurrency}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
