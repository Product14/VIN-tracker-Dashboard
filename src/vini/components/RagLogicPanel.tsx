
import { useState, useEffect } from 'react';
import { X, FlaskConical } from 'lucide-react';
import { RAG_THRESHOLDS } from '../lib/ragLogic';
import type { RagStatus } from '../lib/ragLogic';

const ROW_STYLES: Record<RagStatus, { edge: string; bg: string; badge: string; text: string; dot: string }> = {
  GREEN: { edge: 'border-l-green-500',  bg: 'bg-green-50/60',  badge: 'bg-green-100 text-green-700',  text: 'text-green-700', dot: 'bg-green-500'  },
  AMBER: { edge: 'border-l-amber-400',  bg: 'bg-amber-50/60',  badge: 'bg-amber-100 text-amber-700',  text: 'text-amber-700', dot: 'bg-amber-400'  },
  RED:   { edge: 'border-l-red-500',    bg: 'bg-red-50/60',    badge: 'bg-red-100 text-red-700',      text: 'text-red-700',   dot: 'bg-red-500'    },
  'N/A': { edge: 'border-l-slate-300',  bg: 'bg-slate-50/60',  badge: 'bg-slate-100 text-slate-400',  text: 'text-slate-400', dot: 'bg-slate-300'  },
};

const STATUS_LABEL: Record<RagStatus, string> = {
  GREEN: 'GREEN', AMBER: 'AMBER', RED: 'RED', 'N/A': 'N/A',
};

export default function RagLogicPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <FlaskConical className="w-4 h-4" />
        Scoring Logic
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Scoring Logic</h2>
                <p className="text-xs text-slate-400 mt-0.5">How RAG status is computed for each pillar</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-6 py-5 space-y-6">
              {Object.entries(RAG_THRESHOLDS).map(([key, pillar]) => (
                <div key={key}>
                  {/* Pillar heading */}
                  <div className="mb-2">
                    <p className="text-xs font-bold text-slate-800">{pillar.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {pillar.metric}
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="font-mono">{pillar.formula}</span>
                    </p>
                  </div>

                  {/* Rows table */}
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    {pillar.rows.map((row, i) => {
                      const s = ROW_STYLES[row.status];
                      return (
                        <div
                          key={row.status}
                          className={`flex items-start gap-3 px-4 py-2.5 border-l-4 ${s.edge} ${s.bg} ${
                            i < pillar.rows.length - 1 ? 'border-b border-slate-100' : ''
                          }`}
                        >
                          {/* RAG badge */}
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 mt-0.5 flex-shrink-0 whitespace-nowrap ${s.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                            {STATUS_LABEL[row.status]}
                          </span>
                          {/* Text */}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700">{row.threshold}</p>
                            <p className="text-xs text-slate-400 leading-snug">{row.signal}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
