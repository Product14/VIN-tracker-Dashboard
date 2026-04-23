import type { RooftopScored } from '../lib/ragLogic';

interface Props {
  rooftops: RooftopScored[];
  active: string;
  onChange: (agent: string) => void;
}

// Fixed 4 agent types — always shown even if count is 0
const AGENT_TYPES: { label: string; border: string; stripe: string; text: string; bg: string }[] = [
  { label: 'Sales Inbound',    border: 'border-blue-500',   stripe: 'bg-blue-500',   text: 'text-blue-700',   bg: 'bg-blue-50'   },
  { label: 'Sales Outbound',   border: 'border-violet-500', stripe: 'bg-violet-500', text: 'text-violet-700', bg: 'bg-violet-50' },
  { label: 'Service Inbound',  border: 'border-amber-500',  stripe: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50'  },
  { label: 'Service Outbound', border: 'border-green-500',  stripe: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50'  },
];

function AgentCard({
  label,
  rooftops,
  isActive,
  color,
  onClick,
}: {
  label: string;
  rooftops: RooftopScored[];
  isActive: boolean;
  color: (typeof AGENT_TYPES)[number];
  onClick: () => void;
}) {
  const red   = rooftops.filter((r) => r.accountRag === 'RED').length;
  const amber = rooftops.filter((r) => r.accountRag === 'AMBER').length;
  const green = rooftops.filter((r) => r.accountRag === 'GREEN').length;

  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 rounded-xl text-left cursor-pointer transition-all overflow-hidden
        ${isActive
          ? `${color.bg} border-2 ${color.border} shadow-md`
          : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm'}
      `}
    >
      {/* Colored top accent stripe */}
      <div className={`h-1 w-full ${color.stripe}`} />
      <div className="px-5 py-3 flex items-center justify-between gap-6">
        {/* Left: label + count */}
        <div className="min-w-0 flex-shrink-0">
          <p className={`text-xs font-semibold leading-tight ${color.text}`}>{label}</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-2xl font-bold leading-none ${isActive ? color.text : 'text-slate-800'}`}>
              {rooftops.length}
            </span>
            <span className="text-xs text-slate-400">rooftops</span>
          </div>
        </div>
        {/* Right: RAG breakdown */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />{red} Red
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />{amber} Amber
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 rounded-full px-2 py-0.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />{green} Green
          </span>
        </div>
      </div>
    </button>
  );
}

export default function AgentTabs({ rooftops, active, onChange }: Props) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {AGENT_TYPES.map((agent) => (
        <AgentCard
          key={agent.label}
          label={agent.label}
          rooftops={rooftops.filter((r) => r.agentType === agent.label)}
          isActive={active === agent.label}
          color={agent}
          onClick={() => onChange(agent.label)}
        />
      ))}
    </div>
  );
}
