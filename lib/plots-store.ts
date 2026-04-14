import * as FileSystem from "expo-file-system/legacy";
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
  recommendation: string | null;
  recommendationConfidence: number | null;
  recommendationTitle: string | null;
  recommendationExplanation: string | null;
};

type ZonesSnapshot = {
  zones: Zone[];
  selectedZoneId: string | null;
};

type PersistedZonesState = {
  zones: unknown[];
  selectedZoneId: string | null;
};

const INITIAL_ZONES: Zone[] = [];
const STORAGE_URI = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}soaris-zones-v2.json` : null;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLatitude(value: number | null) {
  return value === null || (value >= -90 && value <= 90);
}

function isValidLongitude(value: number | null) {
  return value === null || (value >= -180 && value <= 180);
}

function normalizeCoordinate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatZoneTitle(order: number) {
  return `Zone ${order}`;
}

function normalizeZone(value: unknown, index: number): Zone | null {
  if (typeof value !== "object" || value === null) return null;
  const zone = value as Record<string, unknown>;
  const latitude = normalizeCoordinate(zone.latitude);
  const longitude = normalizeCoordinate(zone.longitude);

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;

  return {
    id: typeof zone.id === "string" && zone.id.trim() ? zone.id : `zone-${Date.now()}-${index}`,
    title: typeof zone.title === "string" && zone.title.trim() ? zone.title.trim() : formatZoneTitle(index + 1),
    notes: typeof zone.notes === "string" && zone.notes.trim() ? zone.notes.trim() : undefined,
    latitude,
    longitude,
    hasSensorData: zone.hasSensorData === true,
    moistureValue: isFiniteNumber(zone.moistureValue) ? zone.moistureValue : 0,
    humidityValue: isFiniteNumber(zone.humidityValue) ? zone.humidityValue : 0,
    temperatureValue: isFiniteNumber(zone.temperatureValue) ? zone.temperatureValue : 0,
    savedMissionId: isFiniteNumber(zone.savedMissionId) ? zone.savedMissionId : null,
    savedRunStatus:
      typeof zone.savedRunStatus === "string" || zone.savedRunStatus === null
        ? (zone.savedRunStatus as string | null)
        : null,
    savedRunCreatedAt:
      typeof zone.savedRunCreatedAt === "string" || zone.savedRunCreatedAt === null
        ? (zone.savedRunCreatedAt as string | null)
        : null,
    savedRunUpdatedAt:
      typeof zone.savedRunUpdatedAt === "string" || zone.savedRunUpdatedAt === null
        ? (zone.savedRunUpdatedAt as string | null)
        : null,
    movementStateFinal:
      typeof zone.movementStateFinal === "string" || zone.movementStateFinal === null
        ? (zone.movementStateFinal as string | null)
        : null,
    drillStateFinal:
      typeof zone.drillStateFinal === "string" || zone.drillStateFinal === null
        ? (zone.drillStateFinal as string | null)
        : null,
    recommendation: typeof zone.recommendation === "string" || zone.recommendation === null ? zone.recommendation as string | null : null,
    recommendationConfidence: isFiniteNumber(zone.recommendationConfidence) ? zone.recommendationConfidence : null,
    recommendationTitle: typeof zone.recommendationTitle === "string" || zone.recommendationTitle === null ? zone.recommendationTitle as string | null : null,
    recommendationExplanation: typeof zone.recommendationExplanation === "string" || zone.recommendationExplanation === null ? zone.recommendationExplanation as string | null : null,
  };
}

function renumberZones(zones: Zone[]) {
  return zones.map((zone, index) => ({
    ...zone,
    title: typeof zone.title === "string" && zone.title.trim() ? zone.title : formatZoneTitle(index + 1),
  }));
}

function createZone(title: string, latitude: number | null, longitude: number | null, index: number, notes?: string): Zone {
  return {
    id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim() || formatZoneTitle(index + 1),
    notes: notes?.trim() ? notes.trim() : undefined,
    latitude,
    longitude,
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
    recommendation: null,
    recommendationConfidence: null,
    recommendationTitle: null,
    recommendationExplanation: null,
  };
}

function buildSnapshot(zones: Zone[], selectedZoneId: string | null): ZonesSnapshot {
  return { zones, selectedZoneId };
}

class ZonesStore {
  private zones: Zone[] = INITIAL_ZONES;
  private selectedZoneId: string | null = INITIAL_ZONES[0]?.id ?? null;
  private snapshot: ZonesSnapshot = buildSnapshot(this.zones, this.selectedZoneId);
  private listeners = new Set<() => void>();
  private hydrated = false;

  constructor() {
    void this.hydrate();
  }

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

  private persist() {
    if (!this.hydrated || !STORAGE_URI) return;

    const payload: PersistedZonesState = {
      zones: this.zones,
      selectedZoneId: this.selectedZoneId,
    };

    void FileSystem.writeAsStringAsync(STORAGE_URI, JSON.stringify(payload)).catch(() => undefined);
  }

  private async hydrate() {
    if (this.hydrated || !STORAGE_URI) {
      this.hydrated = true;
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(STORAGE_URI);
      if (!info.exists) return;
      const raw = await FileSystem.readAsStringAsync(STORAGE_URI);
      const parsed = JSON.parse(raw) as Partial<PersistedZonesState>;
      const nextZones = Array.isArray(parsed.zones)
        ? parsed.zones.map((zone, index) => normalizeZone(zone, index)).filter((zone): zone is Zone => zone !== null)
        : [];

      this.zones = renumberZones(nextZones);
      const nextSelected = typeof parsed.selectedZoneId === "string" ? parsed.selectedZoneId : null;
      this.selectedZoneId = nextSelected && this.zones.some((zone) => zone.id === nextSelected) ? nextSelected : this.zones[0]?.id ?? null;
    } catch {
      this.zones = INITIAL_ZONES;
      this.selectedZoneId = INITIAL_ZONES[0]?.id ?? null;
    } finally {
      this.hydrated = true;
      this.syncSnapshot();
      this.notify();
    }
  }

  getSnapshot = (): ZonesSnapshot => this.snapshot;

  setSelectedZone = (zoneId: string | null) => {
    const nextSelectedZoneId = zoneId && this.zones.some((zone) => zone.id === zoneId) ? zoneId : this.zones[0]?.id ?? null;
    if (nextSelectedZoneId === this.selectedZoneId) return;
    this.selectedZoneId = nextSelectedZoneId;
    this.syncSnapshot();
    this.persist();
    this.notify();
  };

  addZone = (title: string, latitude: number | null, longitude: number | null, notes?: string) => {
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      throw new Error("Zone reference coordinates are out of range.");
    }

    const zone = createZone(title, latitude, longitude, this.zones.length, notes);
    this.zones = renumberZones([...this.zones, zone]);
    if (!this.selectedZoneId) this.selectedZoneId = zone.id;
    this.syncSnapshot();
    this.persist();
    this.notify();
    return zone;
  };

  updateZone = (zoneId: string, title: string, latitude: number | null, longitude: number | null, notes?: string) => {
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      throw new Error("Zone reference coordinates are out of range.");
    }

    let updated = false;
    this.zones = this.zones.map((zone) => {
      if (zone.id !== zoneId) return zone;
      updated = true;
      return {
        ...zone,
        title: title.trim() || zone.title,
        latitude,
        longitude,
        notes: notes?.trim() ? notes.trim() : undefined,
      };
    });

    if (!updated) return null;
    this.syncSnapshot();
    this.persist();
    this.notify();
    return this.zones.find((zone) => zone.id === zoneId) ?? null;
  };

  removeZone = (zoneId: string) => {
    const removedIndex = this.zones.findIndex((zone) => zone.id === zoneId);
    if (removedIndex === -1) return;
    this.zones = renumberZones(this.zones.filter((zone) => zone.id !== zoneId));
    if (this.selectedZoneId === zoneId) {
      this.selectedZoneId = this.zones[removedIndex]?.id ?? this.zones[removedIndex - 1]?.id ?? this.zones[0]?.id ?? null;
    }
    this.syncSnapshot();
    this.persist();
    this.notify();
  };

  updateZoneRecommendation = (zoneId: string, recommendation: { recommendation: string | null; recommendationConfidence: number | null; recommendationTitle: string | null; recommendationExplanation: string | null; }) => {
    this.zones = this.zones.map((zone) => zone.id === zoneId ? { ...zone, ...recommendation } : zone);
    this.syncSnapshot();
    this.persist();
    this.notify();
  };

  updateZoneSensorSnapshot = (zoneId: string, snapshot: { moistureValue: number; humidityValue: number; temperatureValue: number; hasSensorData: boolean; }) => {
    let updated = false;
    let changed = false;
    this.zones = this.zones.map((zone) => {
      if (zone.id !== zoneId) return zone;
      updated = true;
      const nextZone = snapshot.hasSensorData
        ? { ...zone, hasSensorData: true, moistureValue: Math.max(0, Math.min(100, snapshot.moistureValue)), humidityValue: Math.max(0, Math.min(100, snapshot.humidityValue)), temperatureValue: snapshot.temperatureValue }
        : { ...zone, hasSensorData: false, moistureValue: 0, humidityValue: 0, temperatureValue: 0 };
      changed = changed || zone.hasSensorData !== nextZone.hasSensorData || zone.moistureValue !== nextZone.moistureValue || zone.humidityValue !== nextZone.humidityValue || zone.temperatureValue !== nextZone.temperatureValue;
      return nextZone;
    });
    if (!updated || !changed) return;
    this.syncSnapshot();
    this.persist();
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
      recommendation?: string | null;
      recommendationConfidence?: number | null;
      recommendationTitle?: string | null;
      recommendationExplanation?: string | null;
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
      };
      changed =
        changed ||
        JSON.stringify(zone) !== JSON.stringify(nextZone);
      return nextZone;
    });
    if (!updated || !changed) return;
    this.syncSnapshot();
    this.persist();
    this.notify();
  };
}

export const zonesStore = new ZonesStore();
export const plotsStore = zonesStore;

export function useZonesStore() {
  return useSyncExternalStore(zonesStore.subscribe, zonesStore.getSnapshot, zonesStore.getSnapshot);
}

export function usePlotsStore() {
  return useZonesStore();
}



