const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

type SampleResultRow = {
  id: string | number | null;
  mission_id?: string | number | null;
  tag_id?: string | number | null;
  air_temp_c?: number | null;
  humidity_pct?: number | null;
  thermistor_c?: number | null;
  soil_moisture_raw?: number | null;
  soil_moisture_pct?: number | null;
  recommendation?: string | null;
  confidence_irrigate_now?: number | null;
  confidence_schedule_soon?: number | null;
  confidence_hold_irrigation?: number | null;
  top_confidence?: number | null;
  low_confidence?: boolean | number | string | null;
  prediction_status?: string | null;
  error_flag?: boolean | number | string | null;
  error_message?: string | null;
  model_version?: string | null;
  zone?: string | null;
  device_id?: string | null;
  captured_at?: string | null;
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
  errorFlag: boolean;
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
  sampleResultId: string | null;
  sampleDeviceId: string | null;
  sampleZoneLabel: string | null;
  soilMoistureRaw: number | null;
};

export type SampleResultSnapshot = {
  id: string;
  missionId: string | null;
  tagId: number | null;
  zone: string | null;
  deviceId: string | null;
  capturedAt: string | null;
  soilMoisturePct: number | null;
  soilMoistureRaw: number | null;
  thermistorC: number | null;
  airTempC: number | null;
  humidityPct: number | null;
  recommendation: string | null;
  confidenceIrrigateNow: number | null;
  confidenceScheduleSoon: number | null;
  confidenceHoldIrrigation: number | null;
  topConfidence: number | null;
  lowConfidence: boolean;
  predictionStatus: string | null;
  errorFlag: boolean;
  errorMessage: string | null;
  modelVersion: string | null;
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

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeZoneCode(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  const numericMatch = normalized.match(/\d+/);
  if (numericMatch) {
    return numericMatch[0];
  }

  return normalized.toLowerCase();
}

function coerceStringId(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function coerceMissionId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function buildHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

async function fetchSampleResultRows(select: string, limit?: number) {
  const query = new URLSearchParams({
    select,
    order: "captured_at.desc",
  });

  if (typeof limit === "number" && Number.isFinite(limit)) {
    query.set("limit", String(limit));
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/sample_results?${query.toString()}`, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase sample results fetch failed with status ${response.status}: ${errorText || "unknown error"}.`,
    );
  }

  return (await response.json()) as SampleResultRow[];
}

function mapSampleResultRow(row: SampleResultRow): SampleResultSnapshot {
  return {
    id: coerceStringId(row.id) ?? "unknown-sample",
    missionId: coerceStringId(row.mission_id),
    tagId: coerceMissionId(row.tag_id),
    zone: normalizeText(row.zone),
    deviceId: normalizeText(row.device_id),
    capturedAt: normalizeText(row.captured_at),
    soilMoisturePct: toFiniteNumber(row.soil_moisture_pct),
    soilMoistureRaw: toFiniteNumber(row.soil_moisture_raw),
    thermistorC: toFiniteNumber(row.thermistor_c),
    airTempC: toFiniteNumber(row.air_temp_c),
    humidityPct: toFiniteNumber(row.humidity_pct),
    recommendation: normalizeText(row.recommendation),
    confidenceIrrigateNow: toFiniteNumber(row.confidence_irrigate_now),
    confidenceScheduleSoon: toFiniteNumber(row.confidence_schedule_soon),
    confidenceHoldIrrigation: toFiniteNumber(row.confidence_hold_irrigation),
    topConfidence: toFiniteNumber(row.top_confidence),
    lowConfidence: toBoolean(row.low_confidence),
    predictionStatus: normalizeText(row.prediction_status),
    errorFlag: toBoolean(row.error_flag),
    errorMessage: normalizeText(row.error_message),
    modelVersion: normalizeText(row.model_version),
  };
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

  const rows = await fetchSampleResultRows(
    "id,mission_id,air_temp_c,humidity_pct,thermistor_c,soil_moisture_raw,soil_moisture_pct,recommendation,confidence_irrigate_now,confidence_schedule_soon,confidence_hold_irrigation,top_confidence,low_confidence,prediction_status,error_flag,error_message,model_version,zone,device_id,captured_at",
    250,
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return {};
  }

  const latestByZone = new Map<string, SampleResultRow>();

  rows.forEach((row) => {
    const zoneCode = normalizeZoneCode(normalizeText(row.zone));
    if (!zoneCode || latestByZone.has(zoneCode)) {
      return;
    }

    latestByZone.set(zoneCode, row);
  });

  const snapshots: Record<string, ZoneResultSnapshot> = {};

  latestByZone.forEach((row, zoneCode) => {
    const moistureValue = toFiniteNumber(row.soil_moisture_pct);
    const temperatureValue =
      toFiniteNumber(row.thermistor_c) ?? toFiniteNumber(row.air_temp_c);
    const humidityValue = toFiniteNumber(row.humidity_pct);
    const hasSensorData =
      moistureValue !== null && temperatureValue !== null && humidityValue !== null;
    const errorFlag = toBoolean(row.error_flag);
    const predictionStatus = normalizeText(row.prediction_status);

    snapshots[zoneCode] = {
      hasSensorData,
      moistureValue: hasSensorData ? moistureValue : 0,
      temperatureValue: hasSensorData ? temperatureValue : 0,
      humidityValue: hasSensorData ? humidityValue : 0,
      recommendation: normalizeText(row.recommendation),
      recommendationConfidence: toFiniteNumber(row.top_confidence),
      recommendationExplanation: null,
      topConfidence: toFiniteNumber(row.top_confidence),
      lowConfidence: toBoolean(row.low_confidence),
      predictionStatus,
      errorFlag,
      errorMessage: normalizeText(row.error_message),
      confidenceIrrigateNow: toFiniteNumber(row.confidence_irrigate_now),
      confidenceScheduleSoon: toFiniteNumber(row.confidence_schedule_soon),
      confidenceHoldIrrigation: toFiniteNumber(row.confidence_hold_irrigation),
      modelVersion: normalizeText(row.model_version),
      savedMissionId: coerceMissionId(row.mission_id),
      savedRunStatus: predictionStatus,
      savedRunCreatedAt: normalizeText(row.captured_at),
      savedRunUpdatedAt: normalizeText(row.captured_at),
      movementStateFinal: null,
      drillStateFinal: null,
      sampleResultId: coerceStringId(row.id),
      sampleDeviceId: normalizeText(row.device_id),
      sampleZoneLabel: normalizeText(row.zone),
      soilMoistureRaw: toFiniteNumber(row.soil_moisture_raw),
    };
  });

  return snapshots;
}

export async function fetchRecentSampleResults(limit = 20) {
  if (!isSupabaseZoneAveragesConfigured()) {
    return [] as SampleResultSnapshot[];
  }

  const rows = await fetchSampleResultRows(
    "id,mission_id,tag_id,air_temp_c,humidity_pct,thermistor_c,soil_moisture_raw,soil_moisture_pct,recommendation,confidence_irrigate_now,confidence_schedule_soon,confidence_hold_irrigation,top_confidence,low_confidence,prediction_status,error_flag,error_message,model_version,zone,device_id,captured_at",
    limit,
  );

  return rows.map(mapSampleResultRow);
}

export type ZoneAverages = ZoneResultSnapshot;

export async function fetchZoneAverages() {
  return fetchLatestZoneResultsByZoneCode();
}
