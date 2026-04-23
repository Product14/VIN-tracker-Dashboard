/**
 * Deployment status rows for Vini Account Health (Product14/vini-dashboard).
 * Requires SUPABASE_URL + SUPABASE_SECRET_KEY and table `deployment_statuses`.
 */
import { createClient } from "@supabase/supabase-js";

const TABLE = "deployment_statuses";

const EMPTY = {
  smartView: null,
  stl: null,
  afterHours: null,
  overflow: null,
  fullDay: null,
  followup14: null,
  daily: null,
  weekly: null,
  monthly: null,
};

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function rowToStatuses(row) {
  return {
    smartView: row.smart_view ?? null,
    stl: row.stl ?? null,
    afterHours: row.after_hours ?? null,
    overflow: row.overflow ?? null,
    fullDay: row.full_day ?? null,
    followup14: row.followup14 ?? null,
    daily: row.daily ?? null,
    weekly: row.weekly ?? null,
    monthly: row.monthly ?? null,
  };
}

function statusesToRow(rooftopKey, rooftopName, enterprise, statuses) {
  return {
    rooftop_key: rooftopKey,
    rooftop_name: rooftopName,
    enterprise,
    smart_view: statuses.smartView,
    stl: statuses.stl,
    after_hours: statuses.afterHours,
    overflow: statuses.overflow,
    full_day: statuses.fullDay,
    followup14: statuses.followup14,
    daily: statuses.daily,
    weekly: statuses.weekly,
    monthly: statuses.monthly,
    updated_at: new Date().toISOString(),
  };
}

export async function getAllDeploymentStatuses() {
  const supabase = getClient();
  if (!supabase) return {};
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw new Error(`Supabase select failed: ${error.message}`);
  const map = {};
  for (const row of data ?? []) {
    map[row.rooftop_key] = rowToStatuses(row);
  }
  return map;
}

export async function upsertDeploymentStatus(rooftopKey, rooftopName, enterprise, statuses) {
  const supabase = getClient();
  if (!supabase) {
    throw new Error("Supabase not configured (SUPABASE_URL / SUPABASE_SECRET_KEY)");
  }
  const row = statusesToRow(rooftopKey, rooftopName, enterprise, {
    ...EMPTY,
    ...statuses,
  });
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: "rooftop_key" });
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
}
