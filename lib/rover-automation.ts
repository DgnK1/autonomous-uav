import { onValue, ref, update, type DatabaseReference } from "firebase/database";

import { db, firebaseConfigError } from "@/lib/firebase";

export type MissionMode = "automatic" | "manual_override" | "maintenance";

export type Area1VerificationStatus =
  | "idle"
  | "running"
  | "passed"
  | "failed"
  | "skipped"
  | "error"
  | string;

export type AutomationSettings = {
  automaticMonitoringEnabled: boolean;
  humidityTriggerThreshold: number;
  airTemperatureTriggerThreshold: number;
  cooldownIntervalMinutes: number;
  fallbackScheduleEnabled: boolean;
  fallbackScheduleTimes: string[];
  area1VerificationEnabled: boolean;
  missionMode: MissionMode;
  updatedAt: number | null;
};

export type AutomationState = {
  lastRunAt: number | null;
  nextEligibleRunAt: number | null;
  triggerReason: string | null;
  triggerDetected: boolean;
  area1VerificationStatus: Area1VerificationStatus;
  fullMissionRequired: boolean;
  missionMode: MissionMode;
  activeMissionId: number | null;
  activeZoneCode: string | null;
  updatedAt: number | null;
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  automaticMonitoringEnabled: true,
  humidityTriggerThreshold: 65,
  airTemperatureTriggerThreshold: 30,
  cooldownIntervalMinutes: 45,
  fallbackScheduleEnabled: false,
  fallbackScheduleTimes: [],
  area1VerificationEnabled: true,
  missionMode: "automatic",
  updatedAt: null,
};

export const DEFAULT_AUTOMATION_STATE: AutomationState = {
  lastRunAt: null,
  nextEligibleRunAt: null,
  triggerReason: null,
  triggerDetected: false,
  area1VerificationStatus: "idle",
  fullMissionRequired: false,
  missionMode: "automatic",
  activeMissionId: null,
  activeZoneCode: null,
  updatedAt: null,
};

function getRequiredRef(path: string): DatabaseReference {
  if (!db || firebaseConfigError) {
    throw new Error(
      firebaseConfigError ?? "Firebase Realtime Database is not configured.",
    );
  }

  return ref(db, path);
}

function hasRecordShape(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseBoolean(value: unknown): boolean | null {
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
  return null;
}

function parseText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeScheduleTimes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => /^\d{2}:\d{2}$/.test(entry));
}

function parseMissionMode(value: unknown): MissionMode {
  const normalized = parseText(value)?.toLowerCase();
  if (
    normalized === "automatic" ||
    normalized === "manual_override" ||
    normalized === "maintenance"
  ) {
    return normalized;
  }
  return "automatic";
}

function normalizeAutomationSettings(raw: unknown): AutomationSettings {
  const source = hasRecordShape(raw) ? raw : {};
  const fallback = DEFAULT_AUTOMATION_SETTINGS;

  return {
    automaticMonitoringEnabled:
      parseBoolean(source.automatic_monitoring_enabled) ??
      parseBoolean(source.automaticMonitoringEnabled) ??
      fallback.automaticMonitoringEnabled,
    humidityTriggerThreshold:
      parseNumber(source.humidity_trigger_threshold) ??
      parseNumber(source.humidityTriggerThreshold) ??
      fallback.humidityTriggerThreshold,
    airTemperatureTriggerThreshold:
      parseNumber(source.air_temperature_trigger_threshold) ??
      parseNumber(source.airTemperatureTriggerThreshold) ??
      fallback.airTemperatureTriggerThreshold,
    cooldownIntervalMinutes:
      parseNumber(source.cooldown_interval_minutes) ??
      parseNumber(source.cooldownIntervalMinutes) ??
      fallback.cooldownIntervalMinutes,
    fallbackScheduleEnabled:
      parseBoolean(source.fallback_schedule_enabled) ??
      parseBoolean(source.fallbackScheduleEnabled) ??
      fallback.fallbackScheduleEnabled,
    fallbackScheduleTimes:
      normalizeScheduleTimes(source.fallback_schedule_times) ||
      normalizeScheduleTimes(source.fallbackScheduleTimes),
    area1VerificationEnabled:
      parseBoolean(source.area1_verification_enabled) ??
      parseBoolean(source.area1VerificationEnabled) ??
      fallback.area1VerificationEnabled,
    missionMode: parseMissionMode(source.mission_mode ?? source.missionMode),
    updatedAt:
      parseNumber(source.updatedAt) ??
      parseNumber(source.updated_at) ??
      fallback.updatedAt,
  };
}

function normalizeAutomationState(raw: unknown): AutomationState {
  const source = hasRecordShape(raw) ? raw : {};
  const fallback = DEFAULT_AUTOMATION_STATE;

  return {
    lastRunAt:
      parseNumber(source.last_run_at) ??
      parseNumber(source.lastRunAt) ??
      fallback.lastRunAt,
    nextEligibleRunAt:
      parseNumber(source.next_eligible_run_at) ??
      parseNumber(source.nextEligibleRunAt) ??
      fallback.nextEligibleRunAt,
    triggerReason:
      parseText(source.trigger_reason) ??
      parseText(source.triggerReason) ??
      fallback.triggerReason,
    triggerDetected:
      parseBoolean(source.trigger_detected) ??
      parseBoolean(source.triggerDetected) ??
      fallback.triggerDetected,
    area1VerificationStatus:
      parseText(source.area1_verification_status) ??
      parseText(source.area1VerificationStatus) ??
      fallback.area1VerificationStatus,
    fullMissionRequired:
      parseBoolean(source.full_mission_required) ??
      parseBoolean(source.fullMissionRequired) ??
      fallback.fullMissionRequired,
    missionMode: parseMissionMode(source.mission_mode ?? source.missionMode),
    activeMissionId:
      parseNumber(source.active_mission_id) ??
      parseNumber(source.activeMissionId) ??
      fallback.activeMissionId,
    activeZoneCode:
      parseText(source.active_zone_code) ??
      parseText(source.activeZoneCode) ??
      fallback.activeZoneCode,
    updatedAt:
      parseNumber(source.updatedAt) ??
      parseNumber(source.updated_at) ??
      fallback.updatedAt,
  };
}

export function subscribeAutomationSettings(
  onChange: (settings: AutomationSettings) => void,
) {
  const settingsRef = getRequiredRef("automationSettings");
  return onValue(settingsRef, (snapshot) => {
    onChange(normalizeAutomationSettings(snapshot.val()));
  });
}

export function subscribeAutomationState(
  onChange: (state: AutomationState) => void,
) {
  const stateRef = getRequiredRef("automationState");
  return onValue(stateRef, (snapshot) => {
    onChange(normalizeAutomationState(snapshot.val()));
  });
}

export async function updateAutomationSettings(
  patch: Partial<Omit<AutomationSettings, "updatedAt">>,
) {
  const payload: Record<string, unknown> = {
    updatedAt: Date.now(),
  };

  if (patch.automaticMonitoringEnabled !== undefined) {
    payload.automatic_monitoring_enabled = patch.automaticMonitoringEnabled;
  }
  if (patch.humidityTriggerThreshold !== undefined) {
    payload.humidity_trigger_threshold = patch.humidityTriggerThreshold;
  }
  if (patch.airTemperatureTriggerThreshold !== undefined) {
    payload.air_temperature_trigger_threshold = patch.airTemperatureTriggerThreshold;
  }
  if (patch.cooldownIntervalMinutes !== undefined) {
    payload.cooldown_interval_minutes = patch.cooldownIntervalMinutes;
  }
  if (patch.fallbackScheduleEnabled !== undefined) {
    payload.fallback_schedule_enabled = patch.fallbackScheduleEnabled;
  }
  if (patch.fallbackScheduleTimes !== undefined) {
    payload.fallback_schedule_times = normalizeScheduleTimes(
      patch.fallbackScheduleTimes,
    );
  }
  if (patch.area1VerificationEnabled !== undefined) {
    payload.area1_verification_enabled = patch.area1VerificationEnabled;
  }
  if (patch.missionMode !== undefined) {
    payload.mission_mode = patch.missionMode;
  }

  await update(getRequiredRef("automationSettings"), payload);
}

