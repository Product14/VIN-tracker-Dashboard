import { Search, X } from 'lucide-react';
import type { RagStatus } from '../lib/ragLogic';

export interface Filters {
  search: string;
  tofu: RagStatus | 'ALL';
  outcome: RagStatus | 'ALL';
  quality: RagStatus | 'ALL';
}

const STATUS_OPTIONS: Array<RagStatus | 'ALL'> = ['ALL', 'GREEN', 'AMBER', 'RED', 'N/A'];

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

function StatusSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RagStatus | 'ALL';
  onChange: (v: RagStatus | 'ALL') => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RagStatus | 'ALL')}
        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s === 'ALL' ? 'All' : s}
          </option>
        ))}
      </select>
    </div>
  );
}

const DEFAULT_FILTERS: Filters = { search: '', tofu: 'ALL', outcome: 'ALL', quality: 'ALL' };

export default function FilterBar({ filters, onChange }: Props) {
  const hasActiveFilters =
    filters.search !== '' ||
    filters.tofu !== 'ALL' ||
    filters.outcome !== 'ALL' ||
    filters.quality !== 'ALL';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search rooftop or enterprise…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <StatusSelect
          label="TOFU"
          value={filters.tofu}
          onChange={(v) => onChange({ ...filters, tofu: v })}
        />
        <StatusSelect
          label="Outcome"
          value={filters.outcome}
          onChange={(v) => onChange({ ...filters, outcome: v })}
        />
        <StatusSelect
          label="Quality"
          value={filters.quality}
          onChange={(v) => onChange({ ...filters, quality: v })}
        />

        {hasActiveFilters && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
