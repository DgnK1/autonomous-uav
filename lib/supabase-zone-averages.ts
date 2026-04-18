import { FIXED_ZONES, type Zone } from "@/lib/plots-store";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

type FixedZoneCode = (typeof FIXED_ZONES)[number]["code"];

type FixedZoneBase = {
  zoneId: string;
  zoneCode: FixedZoneCode;
  zoneLabel: string;
};

type SampleResultsReadableRow = {
  id?: string | number | null;
  zone?: string | null;
  soil_moisture_pct?: number | null;
  thermistor_c?: number | null;
  humidity_pct?: number | null;
  recommendation?: string | null;
  top_confidence?: number | null;
  prediction_status?: string | null;
  error_flag?: boolean | number | string | null;
  error_message?: string | null;
  captured_at?: string | null;
};

type SampleResultsRow = {
  id?: string | number | null;
  mission_id?: string | number | null;
  tag_id?: string | number | null;
  zone?: string | null;
  device_id?: string | null;
  soil_moisture_raw?: number | null;
  soil_moisture_pct?: number | null;
  thermistor_c?: number | null;
  air_temp_c?: number | null;
  humidity_pct?: number | null;
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
  captured_at?: string | null;
};

type MissionLogRow = {
  id?: string | number | null;
  type?: string | null;
  message?: string | null;
  zone_index?: number | null;
  created_at?: string | null;
};

type ActivityAlertRow = {
  id?: string | number | null;
  severity?: string | null;
  message?: string | null;
  zone_index?: number | null;
  created_at?: string | null;
};

export type ZoneSummary = FixedZoneBase & {
  sampleResultId: string | null;
  soilMoisturePct: number | null;
  thermistorC: number | null;
  humidityPct: number | null;
  recommendation: string | null;
  topConfidence: number | null;
  predictionStatus: string | null;
  errorFlag: boolean;
  errorMessage: string | null;
  capturedAt: string | null;
};

export type ZoneRecommendation = FixedZoneBase & {
  sampleResultId: string | null;
  missionId: string | null;
  deviceId: string | null;
  soilMoistureRaw: number | null;
  soilMoisturePct: number | null;
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
  capturedAt: string | null;
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

export type ActivityFeedItem = {
  id: string;
  source: "mission_log" | "activity_alert";
  category: "mission" | "movement" | "sampling" | "recommendation" | "alert";
  message: string;
  timestamp: string | null;
  severity: "info" | "warning" | "error" | "critical" | null;
  zone: string | null;
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

const FIXED_ZONE_LOOKUP = new Map(
  FIXED_ZONES.map((zone) => [
    zone.code.toLowerCase(),
    {
      zoneId: zone.id,
      zoneCode: zone.code,
      zoneLabel: zone.title,
    },
  ]),
);

const EMPTY_ZONE_SUMMARY_BY_CODE = FIXED_ZONES.reduce<Record<FixedZoneCode, ZoneSummary>>(
  (accumulator, zone) => {
    accumulator[zone.code] = {
      zoneId: zone.id,
      zoneCode: zone.code,
      zoneLabel: zone.title,
      sampleResultId: null,
      soilMoisturePct: null,
      thermistorC: null,
      humidityPct: null,
      recommendation: null,
      topConfidence: null,
      predictionStatus: null,
      errorFlag: false,
      errorMessage: null,
      capturedAt: null,
    };
    return accumulator;
  },
  {} as Record<FixedZoneCode, ZoneSummary>,
);

const EMPTY_ZONE_RECOMMENDATION_BY_CODE =
  FIXED_ZONES.reduce<Record<FixedZoneCode, ZoneRecommendation>>((accumulator, zone) => {
    accumulator[zone.code] = {
      zoneId: zone.id,
      zoneCode: zone.code,
      zoneLabel: zone.title,
      sampleResultId: null,
      missionId: null,
      deviceId: null,
      soilMoistureRaw: null,
      soilMoisturePct: null,
      thermistorC: null,
      airTempC: null,
      humidityPct: null,
      recommendation: null,
      confidenceIrrigateNow: null,
      confidenceScheduleSoon: null,
      confidenceHoldIrrigation: null,
      topConfidence: null,
      lowConfidence: false,
      predictionStatus: null,
      errorFlag: false,
      errorMessage: null,
      modelVersion: null,
      capturedAt: null,
    };
    return accumulator;
  }, {} as Record<FixedZoneCode, ZoneRecommendation>);

function cloneEmptySummaries() {
  return Object.fromEntries(
    FIXED_ZONES.map((zone) => [zone.code, { ...EMPTY_ZONE_SUMMARY_BY_CODE[zone.code] }]),
  ) as Record<FixedZoneCode, ZoneSummary>;
}

function cloneEmptyRecommendations() {
  return Object.fromEntries(
    FIXED_ZONES.map((zone) => [zone.code, { ...EMPTY_ZONE_RECOMMENDATION_BY_CODE[zone.code] }]),
  ) as Record<FixedZoneCode, ZoneRecommendation>;
}

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
    return normalized === "true" || normalized === "1";
  }
  return false;
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
  const stringId = coerceStringId(value);
  return stringId;
}

function coerceNumericMissionId(value: unknown) {
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

function resolveFixedZone(value: string | null | undefined): FixedZoneBase | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const numericMatch = normalized.match(/\d+/);
  const candidateCode = numericMatch ? `Zone ${numericMatch[0]}` : normalized;
  return FIXED_ZONE_LOOKUP.get(candidateCode.toLowerCase()) ?? null;
}

function getZoneCodeFromZone(zone: Zone): FixedZoneCode {
  const resolved = resolveFixedZone(zone.title);
  return resolved?.zoneCode ?? "Zone 1";
}

async function fetchTableRows<T>(
  tableName: string,
  select: string,
  options?: { limit?: number; order?: string },
) {
  const query = new URLSearchParams({
    select,
    order: options?.order ?? "captured_at.desc",
  });

  if (typeof options?.limit === "number" && Number.isFinite(options.limit)) {
    query.set("limit", String(options.limit));
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?${query.toString()}`, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase ${tableName} fetch failed with status ${response.status}: ${errorText || "unknown error"}.`,
    );
  }

  return (await response.json()) as T[];
}

function normalizeMissionLogCategory(type: string | null, message: string | null) {
  const normalizedType = (type ?? "").trim().toLowerCase();
  const normalizedMessage = (message ?? "").trim().toLowerCase();

  if (
    normalizedType.includes("sampling") ||
    normalizedMessage.includes("sample") ||
    normalizedMessage.includes("soil") ||
    normalizedMessage.includes("drill")
  ) {
    return "sampling";
  }

  if (
    normalizedType.includes("recommend") ||
    normalizedMessage.includes("recommend") ||
    normalizedMessage.includes("prediction")
  ) {
    return "recommendation";
  }

  if (
    normalizedType.includes("movement") ||
    normalizedType.includes("navigation") ||
    normalizedMessage.includes("move") ||
    normalizedMessage.includes("arriv") ||
    normalizedMessage.includes("target")
  ) {
    return "movement";
  }

  return "mission";
}

function normalizeSeverity(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "critical") {
    return "critical";
  }
  if (normalized === "error" || normalized === "failed") {
    return "error";
  }
  if (normalized === "warning" || normalized === "warn") {
    return "warning";
  }
  if (normalized) {
    return "info";
  }
  return null;
}

function inferMissionLogSeverity(type: string | null | undefined, message: string | null | undefined) {
  const normalizedType = (type ?? "").trim().toLowerCase();
  const normalizedMessage = (message ?? "").trim().toLowerCase();

  if (
    normalizedType === "error" ||
    normalizedMessage.includes("error") ||
    normalizedMessage.includes("failed") ||
    normalizedMessage.includes("timeout")
  ) {
    return "error" as const;
  }

  if (
    normalizedMessage.includes("warning") ||
    normalizedMessage.includes("obstacle") ||
    normalizedMessage.includes("retry")
  ) {
    return "warning" as const;
  }

  return "info" as const;
}

function resolveZoneFromIndex(zoneIndex: unknown) {
  if (typeof zoneIndex !== "number" || !Number.isFinite(zoneIndex)) {
    return null;
  }

  const fixedZone = FIXED_ZONES[zoneIndex];
  return fixedZone?.code ?? null;
}

function mapSampleResultRow(row: SampleResultsRow): SampleResultSnapshot {
  return {
    id: coerceStringId(row.id) ?? "unknown-sample",
    missionId: coerceMissionId(row.mission_id),
    tagId: coerceNumericMissionId(row.tag_id),
    zone: resolveFixedZone(row.zone)?.zoneCode ?? normalizeText(row.zone),
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

export async function fetchLatestZoneSummaries() {
  const summariesByZone = cloneEmptySummaries();

  if (!isSupabaseZoneAveragesConfigured()) {
    return FIXED_ZONES.map((zone) => summariesByZone[zone.code]);
  }

  const rows = await fetchTableRows<SampleResultsReadableRow>(
    "sample_results_readable",
    "id,zone,soil_moisture_pct,thermistor_c,humidity_pct,recommendation,top_confidence,prediction_status,error_flag,error_message,captured_at",
    { limit: 250, order: "captured_at.desc" },
  );

  for (const row of rows) {
    const fixedZone = resolveFixedZone(row.zone);
    if (!fixedZone) {
      continue;
    }

    const current = summariesByZone[fixedZone.zoneCode];
    if (current.sampleResultId) {
      continue;
    }

    summariesByZone[fixedZone.zoneCode] = {
      ...current,
      sampleResultId: coerceStringId(row.id),
      soilMoisturePct: toFiniteNumber(row.soil_moisture_pct),
      thermistorC: toFiniteNumber(row.thermistor_c),
      humidityPct: toFiniteNumber(row.humidity_pct),
      recommendation: normalizeText(row.recommendation),
      topConfidence: toFiniteNumber(row.top_confidence),
      predictionStatus: normalizeText(row.prediction_status),
      errorFlag: toBoolean(row.error_flag),
      errorMessage: normalizeText(row.error_message),
      capturedAt: normalizeText(row.captured_at),
    };
  }

  return FIXED_ZONES.map((zone) => summariesByZone[zone.code]);
}

export async function fetchLatestRecommendationsByZone() {
  const recommendationsByZone = cloneEmptyRecommendations();

  if (!isSupabaseZoneAveragesConfigured()) {
    return FIXED_ZONES.map((zone) => recommendationsByZone[zone.code]);
  }

  const rows = await fetchTableRows<SampleResultsRow>(
    "sample_results",
    "id,mission_id,tag_id,zone,device_id,soil_moisture_raw,soil_moisture_pct,thermistor_c,air_temp_c,humidity_pct,recommendation,confidence_irrigate_now,confidence_schedule_soon,confidence_hold_irrigation,top_confidence,low_confidence,prediction_status,error_flag,error_message,model_version,captured_at",
    { limit: 250, order: "captured_at.desc" },
  );

  for (const row of rows) {
    const fixedZone = resolveFixedZone(row.zone);
    if (!fixedZone) {
      continue;
    }

    const current = recommendationsByZone[fixedZone.zoneCode];
    if (current.sampleResultId) {
      continue;
    }

    recommendationsByZone[fixedZone.zoneCode] = {
      ...current,
      sampleResultId: coerceStringId(row.id),
      missionId: coerceMissionId(row.mission_id),
      deviceId: normalizeText(row.device_id),
      soilMoistureRaw: toFiniteNumber(row.soil_moisture_raw),
      soilMoisturePct: toFiniteNumber(row.soil_moisture_pct),
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
      capturedAt: normalizeText(row.captured_at),
    };
  }

  return FIXED_ZONES.map((zone) => recommendationsByZone[zone.code]);
}

export async function fetchLatestZoneResultsByZoneCode(): Promise<Record<string, ZoneResultSnapshot>> {
  const [summaries, recommendations] = await Promise.all([
    fetchLatestZoneSummaries(),
    fetchLatestRecommendationsByZone(),
  ]);

  const summaryMap = new Map(summaries.map((item) => [item.zoneCode, item]));
  const recommendationMap = new Map(recommendations.map((item) => [item.zoneCode, item]));
  const snapshots: Record<string, ZoneResultSnapshot> = {};

  FIXED_ZONES.forEach((fixedZone, index) => {
    const summary = summaryMap.get(fixedZone.code);
    const recommendation = recommendationMap.get(fixedZone.code);
    const moistureValue = recommendation?.soilMoisturePct ?? summary?.soilMoisturePct ?? null;
    const temperatureValue =
      recommendation?.thermistorC ??
      recommendation?.airTempC ??
      summary?.thermistorC ??
      null;
    const humidityValue = recommendation?.humidityPct ?? summary?.humidityPct ?? null;
    const hasSensorData =
      moistureValue !== null && temperatureValue !== null && humidityValue !== null;

    const snapshot: ZoneResultSnapshot = {
      moistureValue: hasSensorData ? moistureValue : 0,
      temperatureValue: hasSensorData ? temperatureValue : 0,
      humidityValue: hasSensorData ? humidityValue : 0,
      hasSensorData,
      recommendation: recommendation?.recommendation ?? summary?.recommendation ?? null,
      recommendationConfidence: recommendation?.topConfidence ?? summary?.topConfidence ?? null,
      recommendationExplanation: null,
      topConfidence: recommendation?.topConfidence ?? summary?.topConfidence ?? null,
      lowConfidence: recommendation?.lowConfidence ?? false,
      predictionStatus: recommendation?.predictionStatus ?? summary?.predictionStatus ?? null,
      errorFlag: recommendation?.errorFlag ?? summary?.errorFlag ?? false,
      errorMessage: recommendation?.errorMessage ?? summary?.errorMessage ?? null,
      confidenceIrrigateNow: recommendation?.confidenceIrrigateNow ?? null,
      confidenceScheduleSoon: recommendation?.confidenceScheduleSoon ?? null,
      confidenceHoldIrrigation: recommendation?.confidenceHoldIrrigation ?? null,
      modelVersion: recommendation?.modelVersion ?? null,
      savedMissionId: coerceNumericMissionId(recommendation?.missionId ?? null),
      savedRunStatus: recommendation?.predictionStatus ?? summary?.predictionStatus ?? null,
      savedRunCreatedAt: recommendation?.capturedAt ?? summary?.capturedAt ?? null,
      savedRunUpdatedAt: recommendation?.capturedAt ?? summary?.capturedAt ?? null,
      movementStateFinal: null,
      drillStateFinal: null,
      sampleResultId: recommendation?.sampleResultId ?? summary?.sampleResultId ?? null,
      sampleDeviceId: recommendation?.deviceId ?? null,
      sampleZoneLabel: fixedZone.title,
      soilMoistureRaw: recommendation?.soilMoistureRaw ?? null,
    };

    const numericCode = String(index + 1);
    snapshots[numericCode] = snapshot;
    snapshots[fixedZone.code] = snapshot;
  });

  return snapshots;
}

export async function fetchRecentSampleResults(limit = 20) {
  if (!isSupabaseZoneAveragesConfigured()) {
    return [] as SampleResultSnapshot[];
  }

  const rows = await fetchTableRows<SampleResultsRow>(
    "sample_results",
    "id,mission_id,tag_id,zone,device_id,soil_moisture_raw,soil_moisture_pct,thermistor_c,air_temp_c,humidity_pct,recommendation,confidence_irrigate_now,confidence_schedule_soon,confidence_hold_irrigation,top_confidence,low_confidence,prediction_status,error_flag,error_message,model_version,captured_at",
    { limit, order: "captured_at.desc" },
  );

  return rows.map(mapSampleResultRow);
}

export async function fetchActivityFeed() {
  if (!isSupabaseZoneAveragesConfigured()) {
    return [] as ActivityFeedItem[];
  }

  const [missionLogs, activityAlerts] = await Promise.all([
    fetchTableRows<MissionLogRow>(
      "mission_logs",
      "id,type,message,zone_index,created_at",
      { limit: 250, order: "created_at.desc" },
    ),
    fetchTableRows<ActivityAlertRow>(
      "activity_alerts",
      "id,severity,message,zone_index,created_at",
      { limit: 250, order: "created_at.desc" },
    ),
  ]);

  const missionItems: ActivityFeedItem[] = missionLogs.flatMap((row) => {
    const message = normalizeText(row.message);
    if (!message) {
      return [];
    }

    return [
      {
        id: `mission-log-${coerceStringId(row.id) ?? message}`,
        source: "mission_log",
        category: normalizeMissionLogCategory(row.type ?? null, message),
        message,
        timestamp: normalizeText(row.created_at),
        severity: inferMissionLogSeverity(row.type, message),
        zone: resolveZoneFromIndex(row.zone_index),
      },
    ];
  });

  const alertItems: ActivityFeedItem[] = activityAlerts.flatMap((row) => {
    const message = normalizeText(row.message);
    if (!message) {
      return [];
    }

    return [
      {
        id: `activity-alert-${coerceStringId(row.id) ?? message}`,
        source: "activity_alert",
        category: "alert",
        message,
        timestamp: normalizeText(row.created_at),
        severity: normalizeSeverity(row.severity),
        zone: resolveZoneFromIndex(row.zone_index),
      },
    ];
  });

  return [...missionItems, ...alertItems].sort((left, right) => {
    const leftTime = left.timestamp ? Date.parse(left.timestamp) : 0;
    const rightTime = right.timestamp ? Date.parse(right.timestamp) : 0;
    return rightTime - leftTime;
  });
}

export type ZoneAverages = ZoneResultSnapshot;

export async function fetchZoneAverages() {
  return fetchLatestZoneResultsByZoneCode();
}

export function buildZoneMap<T extends FixedZoneBase>(items: T[]) {
  return FIXED_ZONES.reduce<Record<FixedZoneCode, T>>((accumulator, zone, index) => {
    accumulator[zone.code] = items[index] ?? ({
      zoneId: zone.id,
      zoneCode: zone.code,
      zoneLabel: zone.title,
    } as T);
    return accumulator;
  }, {} as Record<FixedZoneCode, T>);
}

export function getFixedZoneCodeForStoreZone(zone: Zone) {
  return getZoneCodeFromZone(zone);
}
