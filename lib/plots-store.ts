import { useSyncExternalStore } from "react";

export type Zone = {
  id: string;
  title: string;
  notes?: string;
  latitude: number | null;
  longitude: number | null;
  hasSensorData: boolean;
  moistureValue: number;
  humidityValue: number;
  temperatureValue: number;
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
  recommendation: string | null;
  recommendationConfidence: number | null;
  recommendationTitle: string | null;
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
};

export type FarmerRunSummary = {
  zonesChecked: number;
  irrigateNowCount: number;
  scheduleSoonCount: number;
  holdIrrigationCount: number;
};

type ZonesSnapshot = {
  zones: Zone[];
  selectedZoneId: string | null;
};

export const FIXED_ZONES = [
  { id: "zone-1", code: "Zone 1", title: "Zone 1" },
  { id: "zone-2", code: "Zone 2", title: "Zone 2" },
  { id: "zone-3", code: "Zone 3", title: "Zone 3" },
  { id: "zone-4", code: "Zone 4", title: "Zone 4" },
  { id: "zone-5", code: "Zone 5", title: "Zone 5" },
  { id: "zone-6", code: "Zone 6", title: "Zone 6" },
] as const;

function createFixedZone(id: string, title: string): Zone {
  return {
    id,
    title,
    notes: undefined,
    latitude: null,
    longitude: null,
    hasSensorData: false,
    moistureValue: 0,
    humidityValue: 0,
    temperatureValue: 0,
    savedMissionId: null,
    savedRunStatus: null,
    savedRunCreatedAt: null,
    savedRunUpdatedAt: null,
    movementStateFinal: null,
    drillStateFinal: null,
    sampleResultId: null,
    sampleDeviceId: null,
    sampleZoneLabel: title,
    soilMoistureRaw: null,
    recommendation: null,
    recommendationConfidence: null,
    recommendationTitle: null,
    recommendationExplanation: null,
    topConfidence: null,
    lowConfidence: false,
    predictionStatus: null,
    errorFlag: false,
    errorMessage: null,
    confidenceIrrigateNow: null,
    confidenceScheduleSoon: null,
    confidenceHoldIrrigation: null,
    modelVersion: null,
  };
}

const INITIAL_ZONES: Zone[] = FIXED_ZONES.map((zone) => createFixedZone(zone.id, zone.title));

function buildSnapshot(zones: Zone[], selectedZoneId: string | null): ZonesSnapshot {
  return { zones, selectedZoneId };
}

class ZonesStore {
  private zones: Zone[] = INITIAL_ZONES;
  private selectedZoneId: string | null = INITIAL_ZONES[0]?.id ?? null;
  private snapshot: ZonesSnapshot = buildSnapshot(this.zones, this.selectedZoneId);
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private syncSnapshot() {
    this.snapshot = buildSnapshot(this.zones, this.selectedZoneId);
  }

  getSnapshot = (): ZonesSnapshot => this.snapshot;

  setSelectedZone = (zoneId: string | null) => {
    const nextSelectedZoneId =
      zoneId && this.zones.some((zone) => zone.id === zoneId)
        ? zoneId
        : this.zones[0]?.id ?? null;

    if (nextSelectedZoneId === this.selectedZoneId) return;
    this.selectedZoneId = nextSelectedZoneId;
    this.syncSnapshot();
    this.notify();
  };

  updateZoneSensorSnapshot = (
    zoneId: string,
    snapshot: {
      moistureValue: number;
      humidityValue: number;
      temperatureValue: number;
      hasSensorData: boolean;
    },
  ) => {
    let updated = false;
    let changed = false;

    this.zones = this.zones.map((zone) => {
      if (zone.id !== zoneId) return zone;
      updated = true;

      const nextZone = snapshot.hasSensorData
        ? {
            ...zone,
            hasSensorData: true,
            moistureValue: Math.max(0, Math.min(100, snapshot.moistureValue)),
            humidityValue: Math.max(0, Math.min(100, snapshot.humidityValue)),
            temperatureValue: snapshot.temperatureValue,
          }
        : {
            ...zone,
            hasSensorData: false,
            moistureValue: 0,
            humidityValue: 0,
            temperatureValue: 0,
          };

      changed =
        changed ||
        zone.hasSensorData !== nextZone.hasSensorData ||
        zone.moistureValue !== nextZone.moistureValue ||
        zone.humidityValue !== nextZone.humidityValue ||
        zone.temperatureValue !== nextZone.temperatureValue;

      return nextZone;
    });

    if (!updated || !changed) return;
    this.syncSnapshot();
    this.notify();
  };

  updateZoneSavedResult = (
    zoneId: string,
    snapshot: {
      moistureValue: number;
      humidityValue: number;
      temperatureValue: number;
      hasSensorData: boolean;
      savedMissionId?: number | null;
      savedRunStatus?: string | null;
      savedRunCreatedAt?: string | null;
      savedRunUpdatedAt?: string | null;
      movementStateFinal?: string | null;
      drillStateFinal?: string | null;
      sampleResultId?: string | null;
      sampleDeviceId?: string | null;
      sampleZoneLabel?: string | null;
      soilMoistureRaw?: number | null;
      recommendation?: string | null;
      recommendationConfidence?: number | null;
      recommendationTitle?: string | null;
      recommendationExplanation?: string | null;
      topConfidence?: number | null;
      lowConfidence?: boolean;
      predictionStatus?: string | null;
      errorFlag?: boolean;
      errorMessage?: string | null;
      confidenceIrrigateNow?: number | null;
      confidenceScheduleSoon?: number | null;
      confidenceHoldIrrigation?: number | null;
      modelVersion?: string | null;
    },
  ) => {
    let updated = false;
    let changed = false;

    this.zones = this.zones.map((zone) => {
      if (zone.id !== zoneId) return zone;
      updated = true;

      const nextZone = {
        ...zone,
        hasSensorData: snapshot.hasSensorData,
        moistureValue: snapshot.hasSensorData
          ? Math.max(0, Math.min(100, snapshot.moistureValue))
          : 0,
        humidityValue: snapshot.hasSensorData
          ? Math.max(0, Math.min(100, snapshot.humidityValue))
          : 0,
        temperatureValue: snapshot.hasSensorData ? snapshot.temperatureValue : 0,
        savedMissionId:
          snapshot.savedMissionId === undefined ? zone.savedMissionId : snapshot.savedMissionId,
        savedRunStatus:
          snapshot.savedRunStatus === undefined ? zone.savedRunStatus : snapshot.savedRunStatus,
        savedRunCreatedAt:
          snapshot.savedRunCreatedAt === undefined
            ? zone.savedRunCreatedAt
            : snapshot.savedRunCreatedAt,
        savedRunUpdatedAt:
          snapshot.savedRunUpdatedAt === undefined
            ? zone.savedRunUpdatedAt
            : snapshot.savedRunUpdatedAt,
        movementStateFinal:
          snapshot.movementStateFinal === undefined
            ? zone.movementStateFinal
            : snapshot.movementStateFinal,
        drillStateFinal:
          snapshot.drillStateFinal === undefined
            ? zone.drillStateFinal
            : snapshot.drillStateFinal,
        sampleResultId:
          snapshot.sampleResultId === undefined ? zone.sampleResultId : snapshot.sampleResultId,
        sampleDeviceId:
          snapshot.sampleDeviceId === undefined ? zone.sampleDeviceId : snapshot.sampleDeviceId,
        sampleZoneLabel:
          snapshot.sampleZoneLabel === undefined ? zone.sampleZoneLabel : snapshot.sampleZoneLabel,
        soilMoistureRaw:
          snapshot.soilMoistureRaw === undefined ? zone.soilMoistureRaw : snapshot.soilMoistureRaw,
        recommendation:
          snapshot.recommendation === undefined ? zone.recommendation : snapshot.recommendation,
        recommendationConfidence:
          snapshot.recommendationConfidence === undefined
            ? zone.recommendationConfidence
            : snapshot.recommendationConfidence,
        recommendationTitle:
          snapshot.recommendationTitle === undefined
            ? zone.recommendationTitle
            : snapshot.recommendationTitle,
        recommendationExplanation:
          snapshot.recommendationExplanation === undefined
            ? zone.recommendationExplanation
            : snapshot.recommendationExplanation,
        topConfidence: snapshot.topConfidence === undefined ? zone.topConfidence : snapshot.topConfidence,
        lowConfidence:
          snapshot.lowConfidence === undefined ? zone.lowConfidence : snapshot.lowConfidence,
        predictionStatus:
          snapshot.predictionStatus === undefined ? zone.predictionStatus : snapshot.predictionStatus,
        errorFlag: snapshot.errorFlag === undefined ? zone.errorFlag : snapshot.errorFlag,
        errorMessage:
          snapshot.errorMessage === undefined ? zone.errorMessage : snapshot.errorMessage,
        confidenceIrrigateNow:
          snapshot.confidenceIrrigateNow === undefined
            ? zone.confidenceIrrigateNow
            : snapshot.confidenceIrrigateNow,
        confidenceScheduleSoon:
          snapshot.confidenceScheduleSoon === undefined
            ? zone.confidenceScheduleSoon
            : snapshot.confidenceScheduleSoon,
        confidenceHoldIrrigation:
          snapshot.confidenceHoldIrrigation === undefined
            ? zone.confidenceHoldIrrigation
            : snapshot.confidenceHoldIrrigation,
        modelVersion: snapshot.modelVersion === undefined ? zone.modelVersion : snapshot.modelVersion,
      };

      changed = changed || JSON.stringify(zone) !== JSON.stringify(nextZone);
      return nextZone;
    });

    if (!updated || !changed) return;
    this.syncSnapshot();
    this.notify();
  };
}

export const zonesStore = new ZonesStore();
export const plotsStore = zonesStore;

export function getFarmerRunSummary(zones: Zone[]): FarmerRunSummary {
  const zonesChecked = zones.filter((zone) => zone.hasSensorData).length;
  const irrigateNowCount = zones.filter(
    (zone) => zone.hasSensorData && zone.recommendation === "irrigate_now",
  ).length;
  const scheduleSoonCount = zones.filter(
    (zone) => zone.hasSensorData && zone.recommendation === "schedule_soon",
  ).length;
  const holdIrrigationCount = zones.filter(
    (zone) => zone.hasSensorData && zone.recommendation === "hold_irrigation",
  ).length;

  return {
    zonesChecked,
    irrigateNowCount,
    scheduleSoonCount,
    holdIrrigationCount,
  };
}

export function useZonesStore() {
  return useSyncExternalStore(
    zonesStore.subscribe,
    zonesStore.getSnapshot,
    zonesStore.getSnapshot,
  );
}

export function usePlotsStore() {
  return useZonesStore();
}
