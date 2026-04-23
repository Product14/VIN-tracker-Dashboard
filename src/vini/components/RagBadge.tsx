import type { RagStatus } from '../lib/ragLogic';

const STYLES: Record<RagStatus, { bg: string; text: string; dot: string }> = {
  GREEN: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  AMBER: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
  RED:   { bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500'   },
  'N/A': { bg: 'bg-slate-100', text: 'text-slate-400', dot: 'bg-slate-300' },
};

const LABEL: Record<RagStatus, string> = {
  GREEN: 'GREEN',
  AMBER: 'AMBER',
  RED:   'RED',
  'N/A': '—',
};

interface Props {
  status: RagStatus;
  size?: 'sm' | 'md';
}

// Unified pill: ● LABEL — used everywhere (TOFU, Quality, ROI, Account RAG)
export default function RagBadge({ status, size = 'md' }: Props) {
  const s = STYLES[status];
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-xs whitespace-nowrap ${padding} ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      <span>{LABEL[status]}</span>
    </span>
  );
}

// For use in the logic panel only — shows full word (GREEN/AMBER/RED/N/A)
export function StatusDot({ status }: { status: RagStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium text-xs px-2 py-0.5 ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {status}
    </span>
  );
}

// Color token helper for inline metric highlighting
export const RAG_TEXT: Record<RagStatus, string> = {
  GREEN: 'text-green-700',
  AMBER: 'text-amber-600',
  RED:   'text-red-600',
  'N/A': 'text-slate-400',
};
