
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import RagBadge from './RagBadge';
import type { RooftopScored, RagStatus } from '../lib/ragLogic';

type GroupBy = 'tofu' | 'outcome' | 'quality';

interface Props {
  rooftops: RooftopScored[];
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
}

const COLUMNS: { status: RagStatus; label: string; border: string; headerBg: string; dot: string }[] = [
  { status: 'RED',   label: 'Red',   border: 'border-red-200',   headerBg: 'bg-red-50',   dot: 'bg-red-500'   },
  { status: 'AMBER', label: 'Amber', border: 'border-amber-200', headerBg: 'bg-amber-50', dot: 'bg-amber-400' },
  { status: 'GREEN', label: 'Green', border: 'border-green-200', headerBg: 'bg-green-50', dot: 'bg-green-500' },
  { status: 'N/A',   label: 'N/A',   border: 'border-slate-200', headerBg: 'bg-slate-50', dot: 'bg-slate-300' },
];

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'tofu',    label: 'TOFU'    },
  { value: 'outcome', label: 'Outcome' },
  { value: 'quality', label: 'Quality' },
];

function fmt(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('en-US');
}
function fmtPct(n: number | null): string {
  if (n === null) return '—';
  return `${Math.round(n * 100)}%`;
}
function fmtScore(n: number | null): string {
  if (n === null) return '—';
  return `${Math.round(n)}%`;
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function RooftopCard({ r }: { r: RooftopScored }) {
  const [open, setOpen] = useState(false);
  const captureRatePct = r.captureRate !== null ? `${Math.round(r.captureRate * 100)}%` : '—';

  return (
    <div
      className={`bg-white border rounded-xl shadow-sm transition-shadow overflow-hidden ${
        r.hasAnyRed ? 'border-red-200' : 'border-slate-200'
      } ${open ? 'shadow-md' : 'hover:shadow-md'}`}
    >
      {/* Card header — always visible, click to expand */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 leading-snug">{r.rooftopName}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{r.enterpriseName}</p>
          </div>
          {open
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
          }
        </div>
        <div className="flex flex-wrap gap-2.5 mt-3">
          {([
            { label: 'TOFU',    status: r.tofu.status    },
            { label: 'Quality', status: r.quality.status },
            { label: 'ROI',     status: r.outcome.status },
          ] as const).map(({ label, status }) => (
            <div key={label} className="flex flex-col items-start gap-0.5">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
              <RagBadge status={status} size="sm" />
            </div>
          ))}
        </div>
      </button>

      {/* Expanded metrics */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          open ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 space-y-2">
          <MetricRow label="Total Leads"       value={fmt(r.totalLeads)} />
          <MetricRow label="Vini Interactions" value={fmt(r.viniInteractions)} />
          <MetricRow label="Capture Rate"      value={captureRatePct} />
          <div className="border-t border-slate-200 my-1" />
          <MetricRow label="Appointments"      value={fmt(r.appointments)} />
          <MetricRow label="Appt Booking Rate" value={fmtPct(r.apptRate)} />
          <div className="border-t border-slate-200 my-1" />
          <MetricRow label="Avg Call Score"    value={fmtScore(r.avgScore)} />
          {r.smsLeads > 0 && (
            <MetricRow label="SMS Leads" value={fmt(r.smsLeads)} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function BoardView({ rooftops, groupBy, onGroupByChange }: Props) {
  const grouped = Object.fromEntries(
    COLUMNS.map((col) => [
      col.status,
      rooftops.filter((r) => r[groupBy].status === col.status),
    ])
  ) as Record<RagStatus, RooftopScored[]>;

  return (
    <div className="space-y-4">
      {/* Group-by selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Group by pillar:</span>
        <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onGroupByChange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                groupBy === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Board columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((col) => {
          const cards = grouped[col.status];
          return (
            <div key={col.status} className={`rounded-xl border ${col.border} overflow-hidden`}>
              {/* Column header */}
              <div className={`flex items-center justify-between px-4 py-3 ${col.headerBg} border-b ${col.border}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-xs font-semibold text-slate-700">{col.label}</span>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="p-3 space-y-2.5 min-h-[6rem]">
                {cards.length === 0 ? (
                  <p className="text-xs text-slate-300 text-center py-4">None</p>
                ) : (
                  cards.map((r) => (
                    <RooftopCard key={`${r.enterpriseName}::${r.rooftopName}`} r={r} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
