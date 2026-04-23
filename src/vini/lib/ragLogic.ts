export type RagStatus = 'GREEN' | 'AMBER' | 'RED' | 'N/A';

export interface RagResult {
  status: RagStatus;
  value: string;
}

export interface Rooftop {
  teamId: string | null;
  enterpriseName: string;
  rooftopName: string;
  agentType: string;
  totalLeads: number;
  viniInteractions: number;
  callLeads: number;
  smsLeads: number;
  appointments: number;
  apptRate: number | null;
  avgScore: number | null;
}

export function rooftopKey(r: Pick<Rooftop, 'teamId' | 'enterpriseName' | 'rooftopName'>): string {
  return r.teamId ?? `${r.enterpriseName}::${r.rooftopName}`;
}

export type DeploymentStatus = 'Live' | 'In Progress' | 'Approval' | 'Declined' | 'Not Live' | null;

export interface SalesInboundStatuses {
  smartView:  DeploymentStatus;
  stl:        DeploymentStatus;
  afterHours: DeploymentStatus;
  overflow:   DeploymentStatus;
  fullDay:    DeploymentStatus;
  followup14: DeploymentStatus;
  daily:      DeploymentStatus;
  weekly:     DeploymentStatus;
  monthly:    DeploymentStatus;
}

export const EMPTY_SALES_INBOUND_STATUSES: SalesInboundStatuses = {
  smartView: null, stl: null, afterHours: null, overflow: null,
  fullDay: null, followup14: null, daily: null, weekly: null, monthly: null,
};

export const DEPLOYMENT_STATUS_OPTIONS: { value: Exclude<DeploymentStatus, null>; color: 'GREEN' | 'AMBER' | 'RED' }[] = [
  { value: 'Live',        color: 'GREEN' },
  { value: 'In Progress', color: 'AMBER' },
  { value: 'Approval',    color: 'AMBER' },
  { value: 'Declined',    color: 'RED'   },
  { value: 'Not Live',    color: 'RED'   },
];

export interface RooftopScored extends Rooftop {
  captureRate: number | null;
  tofu: RagResult;
  outcome: RagResult;
  quality: RagResult;
  accountRag: RagStatus;
  hasAnyRed: boolean;
}

export const EXCLUDE_NAMES = new Set([
  'spyne motors', 'spyne', 'prompt testing', 'team 1',
  'onboardtest3', 'onboardtest4', 'khandelwal', 'speed to lead',
  'approval genie', 'spyne auto group',
]);

export const RAG_THRESHOLDS = {
  tofu: {
    label: 'TOFU — Is Vini in the game?',
    metric: 'Vini Capture Rate',
    formula: 'Vini Interactions / Total Leads',
    rows: [
      { status: 'GREEN' as RagStatus, threshold: '≥ 80%', signal: 'Well-integrated — Vini seeing most leads' },
      { status: 'AMBER' as RagStatus, threshold: '50% – 79%', signal: 'Partial deployment — some sources not routed' },
      { status: 'RED' as RagStatus, threshold: '< 50% or 0 interactions', signal: 'Largely inactive — CRM/routing review needed' },
      { status: 'N/A' as RagStatus, threshold: '< 20 total leads', signal: 'Insufficient volume to score' },
    ],
  },
  outcome: {
    label: 'ROI — Is Vini booking appointments?',
    metric: 'Appointment Booking Rate',
    formula: 'Appointments / Vini Interactions',
    rows: [
      { status: 'GREEN' as RagStatus, threshold: '≥ 20%', signal: 'Strong — above industry baseline for AI voice' },
      { status: 'AMBER' as RagStatus, threshold: '7% – 19%', signal: 'Functional but below potential' },
      { status: 'RED' as RagStatus, threshold: '< 7% or 0% (with interactions)', signal: 'Not converting — prompt or config review needed' },
      { status: 'N/A' as RagStatus, threshold: '< 10 Vini interactions', signal: 'Insufficient data' },
    ],
  },
  quality: {
    label: 'Quality — Is Vini representing the store well?',
    metric: 'Avg Call Quality Score',
    formula: 'avg_score_percentage (0–100)',
    rows: [
      { status: 'GREEN' as RagStatus, threshold: '≥ 70%', signal: 'On-brand, following the road to sold' },
      { status: 'AMBER' as RagStatus, threshold: '50% – 69%', signal: 'Some gaps — review call categories' },
      { status: 'RED' as RagStatus, threshold: '< 50%', signal: 'Quality issues — prompt or QC intervention needed' },
      { status: 'N/A' as RagStatus, threshold: 'No scored calls', signal: 'No voice interactions to evaluate' },
    ],
  },
};

export function computeTofu(totalLeads: number, interactions: number): RagResult {
  if (totalLeads < 20) return { status: 'N/A', value: '—' };
  if (interactions === 0) return { status: 'RED', value: '0%' };
  const rate = interactions / totalLeads;
  const pct = `${Math.round(rate * 100)}%`;
  if (rate >= 0.80) return { status: 'GREEN', value: pct };
  if (rate >= 0.50) return { status: 'AMBER', value: pct };
  return { status: 'RED', value: pct };
}

export function computeOutcome(interactions: number, apptRate: number | null): RagResult {
  if (interactions < 20) return { status: 'N/A', value: '—' };
  if (!apptRate || apptRate === 0) return { status: 'RED', value: '0%' };
  const pct = `${Math.round(apptRate * 100)}%`;
  if (apptRate >= 0.20) return { status: 'GREEN', value: pct };
  if (apptRate >= 0.07) return { status: 'AMBER', value: pct };
  return { status: 'RED', value: pct };
}

export function computeQuality(score: number | null, interactions: number): RagResult {
  if (score === null || interactions < 20) return { status: 'N/A', value: '—' };
  const pct = `${Math.round(score)}%`;
  if (score >= 70) return { status: 'GREEN', value: pct };
  if (score >= 50) return { status: 'AMBER', value: pct };
  return { status: 'RED', value: pct };
}

export function computeAccountRag(
  tofu: RagResult,
  outcome: RagResult,
  quality: RagResult
): RagStatus {
  const pillars = [tofu, outcome, quality];
  const statuses = pillars.map((p) => p.status);

  // Rule 1: TOFU RED → account RED (system not running)
  if (tofu.status === 'RED') return 'RED';
  // Rule 2: Any pillar RED → account RED
  if (statuses.includes('RED')) return 'RED';
  // Rule 3: All pillars GREEN (ignoring N/A)
  const scored = statuses.filter((s) => s !== 'N/A');
  if (scored.length > 0 && scored.every((s) => s === 'GREEN')) return 'GREEN';
  // Rule 4: Any AMBER, none RED
  if (statuses.includes('AMBER')) return 'AMBER';
  // Rule 5: All N/A
  return 'N/A';
}

export function scoreRooftop(r: Rooftop): RooftopScored {
  // Not enough data to score anything
  if (r.totalLeads < 20) {
    const na: RagResult = { status: 'N/A', value: '—' };
    return { ...r, captureRate: null, tofu: na, outcome: na, quality: na, accountRag: 'N/A', hasAnyRed: false };
  }
  const captureRate = r.totalLeads >= 20 ? r.viniInteractions / r.totalLeads : null;
  const tofu = computeTofu(r.totalLeads, r.viniInteractions);
  const outcome = computeOutcome(r.viniInteractions, r.apptRate);
  const quality = computeQuality(r.avgScore, r.viniInteractions);
  const accountRag = computeAccountRag(tofu, outcome, quality);
  const hasAnyRed = [tofu, outcome, quality].some((x) => x.status === 'RED');
  return { ...r, captureRate, tofu, outcome, quality, accountRag, hasAnyRed };
}

export function parseCSVRow(row: Record<string, string>): Rooftop | null {
  const name = (row['rooftop_name'] || '').trim();
  const enterprise = (row['enterprise_name'] || '').trim();
  if (!name || EXCLUDE_NAMES.has(name.toLowerCase())) return null;

  const agentType = (row['Agent Type'] || row['agent_type'] || '').trim() || 'Unknown';

  const n = (key: string) => {
    const v = row[key];
    if (v === '' || v === null || v === undefined) return null;
    // Strip commas (e.g. "1,482") and percent signs (e.g. "7.78%")
    const cleaned = v.replace(/,/g, '').replace(/%$/, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const pct = (key: string) => {
    // CSV stores rates as percentages ("7.78%") — convert to decimal (0.0778)
    const v = n(key);
    return v === null ? null : v / 100;
  };

  const teamId = (row['team_id'] || '').trim() || null;

  return {
    teamId,
    enterpriseName: enterprise,
    rooftopName: name,
    agentType,
    totalLeads: n('total_leads') ?? 0,
    viniInteractions: n('total_leads_interacted_with_vini') ?? 0,
    callLeads: n('total_leads_with_calls') ?? 0,
    smsLeads: n('total_leads_with_sms') ?? 0,
    appointments: n('total_appointments') ?? 0,
    apptRate: pct('appointment_booking_rate'),
    avgScore: n('avg_score_percentage'),
  };
}
