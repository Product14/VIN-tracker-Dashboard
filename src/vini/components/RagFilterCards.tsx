import type { RagStatus, RooftopScored } from '../lib/ragLogic';

interface Props {
  rooftops: RooftopScored[];
  active: RagStatus | 'ALL';
  onChange: (status: RagStatus | 'ALL') => void;
}

const CARDS: {
  status: RagStatus | 'ALL';
  label: string;
  sublabel: string;
  dot: string;
  bg: string;
  border: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  countColor: string;
}[] = [
  {
    status: 'ALL',
    label: 'All Rooftops',
    sublabel: 'total in view',
    dot: 'bg-slate-400',
    bg: 'bg-white',
    border: 'border-slate-200',
    activeBg: 'bg-slate-800',
    activeBorder: 'border-slate-800',
    activeText: 'text-white',
    countColor: 'text-slate-800',
  },
  {
    status: 'RED',
    label: 'Red',
    sublabel: 'needs action',
    dot: 'bg-red-500',
    bg: 'bg-white',
    border: 'border-slate-200',
    activeBg: 'bg-red-50',
    activeBorder: 'border-red-400',
    activeText: 'text-red-700',
    countColor: 'text-red-600',
  },
  {
    status: 'AMBER',
    label: 'Amber',
    sublabel: 'watch closely',
    dot: 'bg-amber-400',
    bg: 'bg-white',
    border: 'border-slate-200',
    activeBg: 'bg-amber-50',
    activeBorder: 'border-amber-400',
    activeText: 'text-amber-700',
    countColor: 'text-amber-600',
  },
  {
    status: 'GREEN',
    label: 'Green',
    sublabel: 'performing well',
    dot: 'bg-green-500',
    bg: 'bg-white',
    border: 'border-slate-200',
    activeBg: 'bg-green-50',
    activeBorder: 'border-green-400',
    activeText: 'text-green-700',
    countColor: 'text-green-600',
  },
  {
    status: 'N/A',
    label: 'Unscored',
    sublabel: 'new or pilot',
    dot: 'bg-slate-300',
    bg: 'bg-white',
    border: 'border-slate-200',
    activeBg: 'bg-slate-50',
    activeBorder: 'border-slate-400',
    activeText: 'text-slate-600',
    countColor: 'text-slate-500',
  },
];

export default function RagFilterCards({ rooftops, active, onChange }: Props) {
  const counts: Record<string, number> = {
    ALL: rooftops.length,
    RED: rooftops.filter((r) => r.accountRag === 'RED').length,
    AMBER: rooftops.filter((r) => r.accountRag === 'AMBER').length,
    GREEN: rooftops.filter((r) => r.accountRag === 'GREEN').length,
    'N/A': rooftops.filter((r) => r.accountRag === 'N/A').length,
  };

  return (
    <div className="grid grid-cols-5 gap-3">
      {CARDS.map((card) => {
        const isActive = active === card.status;
        const count = counts[card.status as string] ?? 0;

        return (
          <button
            key={card.status}
            onClick={() => onChange(isActive && card.status !== 'ALL' ? 'ALL' : card.status)}
            className={`rounded-xl border-2 px-4 py-3.5 text-left transition-all cursor-pointer ${
              isActive
                ? `${card.activeBg} ${card.activeBorder}`
                : `${card.bg} ${card.border} hover:border-slate-300 hover:bg-slate-50`
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${card.dot}`} />
              <span className={`text-xs font-semibold ${isActive ? card.activeText : 'text-slate-600'}`}>
                {card.label}
              </span>
            </div>
            <p className={`text-2xl font-bold ${isActive ? card.activeText : card.countColor}`}>
              {count}
            </p>
            <p className={`text-xs mt-0.5 ${isActive ? card.activeText + ' opacity-70' : 'text-slate-400'}`}>
              {card.sublabel}
            </p>
          </button>
        );
      })}
    </div>
  );
}
