const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

type RobotRunRow = {
  zone_code: string | null;
  soil_moisture_avg?: number | null;
  soil_temp_avg?: number | null;
  air_humidity?: number | null;
  recommendation?: string | null;
  recommendation_confidence?: number | null;
  recommendation_explanation?: string | null;
  top_confidence?: number | null;
  low_confidence?: boolean | null;
  prediction_status?: string | null;
  error_message?: string | null;
  confidence_irrigate_now?: number | null;
  confidence_schedule_soon?: number | null;
  confidence_hold_irrigation?: number | null;
  model_version?: string | null;
  mission_id?: number | null;
  status?: string | null;
  movement_state_final?: string | null;
  drill_state_final?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export type ZoneResultSnapshot = {
  moistureValue: number;
  temperatureValue: number;
  humidityValue: number;
  hasSensorData: boolean;
  recommendation: string | null;
  recommendationConfidence: number | null;
  recommendationExplanation: string | null;
  topConfidence: number | null;
  lowConfidence: boolean;
  predictionStatus: string | null;
  errorMessage: string | null;
  confidenceIrrigateNow: number | null;
  confidenceScheduleSoon: number | null;
  confidenceHoldIrrigation: number | null;
  modelVersion: string | null;
  savedMissionId: number | null;
  savedRunStatus: string | null;
  savedRunCreatedAt: string | null;
  savedRunUpdatedAt: string | null;
  movementStateFinal: string | null;
  drillStateFinal: string | null;
};

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return false;
}

function normalizeZoneCode(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isTerminalStatus(status: string | null) {
  const normalized = status?.trim().toLowerCase() ?? "";
  return ["completed", "stopped", "cancelled"].includes(normalized);
}

function buildHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

async function fetchRobotRunRows(select: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/robot_runs?select=${encodeURIComponent(select)}&order=created_at.desc`,
    {
      headers: buildHeaders(),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase zone results fetch failed with status ${response.status}: ${errorText || "unknown error"}.`,
    );
  }

  return (await response.json()) as RobotRunRow[];
}

export function isSupabaseZoneAveragesConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function fetchLatestZoneResultsByZoneCode(): Promise<
  Record<string, ZoneResultSnapshot>
> {
  if (!isSupabaseZoneAveragesConfigured()) {
    return {};
  }

  let rows: RobotRunRow[];

  try {
    rows = await fetchRobotRunRows(
      "zone_code,soil_moisture_avg,soil_temp_avg,air_humidity,recommendation,recommendation_confidence,recommendation_explanation,top_confidence,low_confidence,prediction_status,error_message,confidence_irrigate_now,confidence_schedule_soon,confidence_hold_irrigation,model_version,mission_id,status,movement_state_final,drill_state_final,created_at,updated_at,started_at,finished_at",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.toLowerCase().includes("column")) {
      throw error;
    }

    rows = await fetchRobotRunRows(
      "zone_code,soil_moisture_avg,soil_temp_avg,air_humidity,recommendation,recommendation_confidence,recommendation_explanation,created_at",
    );
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return {};
  }

  const latestByZone = new Map<string, RobotRunRow>();

  rows.forEach((row) => {
    const zoneCode = normalizeZoneCode(row.zone_code);
    if (!zoneCode) {
      return;
    }

    const existing = latestByZone.get(zoneCode);
    const rowStatus = normalizeText(row.status);

    if (!existing) {
      latestByZone.set(zoneCode, row);
      return;
    }

    const existingStatus = normalizeText(existing.status);
    const existingIsTerminal = isTerminalStatus(existingStatus);
    const rowIsTerminal = isTerminalStatus(rowStatus);

    if (rowIsTerminal && !existingIsTerminal) {
      latestByZone.set(zoneCode, row);
    }
  });

  const snapshots: Record<string, ZoneResultSnapshot> = {};

  latestByZone.forEach((row, zoneCode) => {
    const moistureValue = toFiniteNumber(row.soil_moisture_avg);
    const temperatureValue = toFiniteNumber(row.soil_temp_avg);
    const humidityValue = toFiniteNumber(row.air_humidity);
    const hasSensorData =
      moistureValue !== null &&
      temperatureValue !== null &&
      humidityValue !== null;

    snapshots[zoneCode] = {
      hasSensorData,
      moistureValue: hasSensorData ? moistureValue : 0,
      temperatureValue: hasSensorData ? temperatureValue : 0,
      humidityValue: hasSensorData ? humidityValue : 0,
      recommendation: normalizeText(row.recommendation),
      recommendationConfidence: toFiniteNumber(row.recommendation_confidence),
      recommendationExplanation: normalizeText(row.recommendation_explanation),
      topConfidence: toFiniteNumber(row.top_confidence),
      lowConfidence: toBoolean(row.low_confidence),
      predictionStatus: normalizeText(row.prediction_status),
      errorMessage: normalizeText(row.error_message),
      confidenceIrrigateNow: toFiniteNumber(row.confidence_irrigate_now),
      confidenceScheduleSoon: toFiniteNumber(row.confidence_schedule_soon),
      confidenceHoldIrrigation: toFiniteNumber(row.confidence_hold_irrigation),
      modelVersion: normalizeText(row.model_version),
      savedMissionId: toFiniteNumber(row.mission_id),
      savedRunStatus: normalizeText(row.status),
      savedRunCreatedAt: normalizeText(row.created_at),
      savedRunUpdatedAt: normalizeText(row.updated_at),
      movementStateFinal: normalizeText(row.movement_state_final),
      drillStateFinal: normalizeText(row.drill_state_final),
    };
  });

  return snapshots;
}

export type ZoneAverages = ZoneResultSnapshot;

export async function fetchZoneAverages() {
  return fetchLatestZoneResultsByZoneCode();
}
