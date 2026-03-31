import * as FileSystem from "expo-file-system/legacy";
import { useSyncExternalStore } from "react";

type ZoneCoordinate = {
  latitude: number;
  longitude: number;
};

export type Zone = ZoneCoordinate & {
  id: string;
  title: string;
  moisture: string;
  moistureValue: number;
  humidity: string;
  humidityValue: number;
  temperature: string;
  temperatureValue: number;
  recommendation: string | null;
  recommendationConfidence: number | null;
  recommendationTitle: string | null;
  recommendationExplanation: string | null;
};

type ZonesSnapshot = {
  zones: Zone[];
  selectedZoneId: string | null;
};

type ZoneTemplate = {
  moisture: string;
  moistureValue: number;
  humidity: string;
  humidityValue: number;
  temperature: string;
  temperatureValue: number;
  recommendation: string | null;
  recommendationConfidence: number | null;
  recommendationTitle: string | null;
  recommendationExplanation: string | null;
};

type PersistedZonesState = {
  zones: Zone[];
  selectedZoneId: string | null;
};

const DEFAULT_TEMPLATES: ZoneTemplate[] = [
  {
    moisture: "Drying (21%)",
    moistureValue: 21,
    humidity: "Low (30%)",
    humidityValue: 30,
    temperature: "35C",
    temperatureValue: 35,
    recommendation: null,
    recommendationConfidence: null,
    recommendationTitle: null,
    recommendationExplanation: null,
  },
  {
    moisture: "Stable (72%)",
    moistureValue: 72,
    humidity: "Humid (70%)",
    humidityValue: 70,
    temperature: "24C",
    temperatureValue: 24,
    recommendation: null,
    recommendationConfidence: null,
    recommendationTitle: null,
    recommendationExplanation: null,
  },
  {
    moisture: "Moderate (45%)",
    moistureValue: 45,
    humidity: "Balanced (45%)",
    humidityValue: 45,
    temperature: "31C",
    temperatureValue: 31,
    recommendation: null,
    recommendationConfidence: null,
    recommendationTitle: null,
    recommendationExplanation: null,
  },
  {
    moisture: "Moist (84%)",
    moistureValue: 84,
    humidity: "Humid (62%)",
    humidityValue: 62,
    temperature: "22C",
    temperatureValue: 22,
    recommendation: null,
    recommendationConfidence: null,
    recommendationTitle: null,
    recommendationExplanation: null,
  },
];

const INITIAL_ZONES: Zone[] = [];

const STORAGE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}soaris-zones-v1.json`
  : null;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLatitude(latitude: number) {
  return latitude >= -90 && latitude <= 90;
}

function isValidLongitude(longitude: number) {
  return longitude >= -180 && longitude <= 180;
}

function getTemplate(index: number) {
  return DEFAULT_TEMPLATES[index % DEFAULT_TEMPLATES.length];
}

function normalizeZone(value: unknown, index: number): Zone | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const zone = value as Partial<Zone>;
  const fallbackTemplate = getTemplate(index);

  if (
    typeof zone.id !== "string" ||
    typeof zone.title !== "string" ||
    !isFiniteNumber(zone.latitude) ||
    !isFiniteNumber(zone.longitude) ||
    !isValidLatitude(zone.latitude) ||
    !isValidLongitude(zone.longitude) ||
    typeof zone.moisture !== "string" ||
    !isFiniteNumber(zone.moistureValue) ||
    typeof zone.temperature !== "string" ||
    !isFiniteNumber(zone.temperatureValue)
  ) {
    return null;
  }

  return {
    id: zone.id,
    title: zone.title,
    latitude: zone.latitude,
    longitude: zone.longitude,
    moisture: zone.moisture,
    moistureValue: zone.moistureValue,
    humidity:
      typeof zone.humidity === "string" ? zone.humidity : fallbackTemplate.humidity,
    humidityValue: isFiniteNumber(zone.humidityValue)
      ? zone.humidityValue
      : fallbackTemplate.humidityValue,
    temperature: zone.temperature,
    temperatureValue: zone.temperatureValue,
    recommendation:
      typeof zone.recommendation === "string" || zone.recommendation === null
        ? zone.recommendation
        : fallbackTemplate.recommendation,
    recommendationConfidence: isFiniteNumber(zone.recommendationConfidence)
      ? zone.recommendationConfidence
      : fallbackTemplate.recommendationConfidence,
    recommendationTitle:
      typeof zone.recommendationTitle === "string" || zone.recommendationTitle === null
        ? zone.recommendationTitle
        : fallbackTemplate.recommendationTitle,
    recommendationExplanation:
      typeof zone.recommendationExplanation === "string" ||
      zone.recommendationExplanation === null
        ? zone.recommendationExplanation
        : fallbackTemplate.recommendationExplanation,
  };
}

function formatZoneTitle(order: number) {
  return `Zone ${order}`;
}

function createZone(latitude: number, longitude: number, index: number): Zone {
  const template = getTemplate(index);

  return {
    id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: formatZoneTitle(index + 1),
    latitude,
    longitude,
    ...template,
  };
}

function buildSnapshot(
  zones: Zone[],
  selectedZoneId: string | null,
): ZonesSnapshot {
  return {
    zones,
    selectedZoneId,
  };
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
    if (!this.hydrated || !STORAGE_URI) {
      return;
    }

    const payload: PersistedZonesState = {
      zones: this.zones,
      selectedZoneId: this.selectedZoneId,
    };

    void FileSystem.writeAsStringAsync(STORAGE_URI, JSON.stringify(payload)).catch(
      () => undefined,
    );
  }

  private async hydrate() {
    if (this.hydrated || !STORAGE_URI) {
      this.hydrated = true;
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(STORAGE_URI);
      if (!info.exists) {
        return;
      }

      const raw = await FileSystem.readAsStringAsync(STORAGE_URI);
      const parsed = JSON.parse(raw) as Partial<PersistedZonesState>;
      const nextZones = Array.isArray(parsed.zones)
        ? parsed.zones
            .map((zone, index) => normalizeZone(zone, index))
            .filter((zone): zone is Zone => zone !== null)
        : [];

      this.zones = nextZones;

      const nextSelected =
        typeof parsed.selectedZoneId === "string" ? parsed.selectedZoneId : null;
      this.selectedZoneId =
        nextSelected && this.zones.some((zone) => zone.id === nextSelected)
          ? nextSelected
          : this.zones[0]?.id ?? null;
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
    const nextSelectedZoneId =
      zoneId && this.zones.some((zone) => zone.id === zoneId)
        ? zoneId
        : this.zones[0]?.id ?? null;

    if (nextSelectedZoneId === this.selectedZoneId) {
      return;
    }

    this.selectedZoneId = nextSelectedZoneId;
    this.syncSnapshot();
    this.persist();
    this.notify();
  };

  addZone = (latitude: number, longitude: number) => {
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      throw new Error("Zone coordinates are out of range.");
    }

    const zone = createZone(latitude, longitude, this.zones.length);
    this.zones = [...this.zones, zone];

    if (!this.selectedZoneId) {
      this.selectedZoneId = zone.id;
    }

    this.syncSnapshot();
    this.persist();
    this.notify();
    return zone;
  };

  updateZone = (zoneId: string, latitude: number, longitude: number) => {
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      throw new Error("Zone coordinates are out of range.");
    }

    let updated = false;
    this.zones = this.zones.map((zone) => {
      if (zone.id !== zoneId) {
        return zone;
      }

      updated = true;
      return {
        ...zone,
        latitude,
        longitude,
      };
    });

    if (!updated) {
      return null;
    }

    this.syncSnapshot();
    this.persist();
    this.notify();
    return this.zones.find((zone) => zone.id === zoneId) ?? null;
  };

  removeZone = (zoneId: string) => {
    const removedIndex = this.zones.findIndex((zone) => zone.id === zoneId);
    if (removedIndex === -1) {
      return;
    }

    this.zones = this.zones.filter((zone) => zone.id !== zoneId);

    if (this.selectedZoneId === zoneId) {
      this.selectedZoneId =
        this.zones[removedIndex]?.id ??
        this.zones[removedIndex - 1]?.id ??
        this.zones[0]?.id ??
        null;
    }

    this.syncSnapshot();
    this.persist();
    this.notify();
  };

  updateZoneRecommendation = (
    zoneId: string,
    recommendation: {
      recommendation: string | null;
      recommendationConfidence: number | null;
      recommendationTitle: string | null;
      recommendationExplanation: string | null;
    },
  ) => {
    this.zones = this.zones.map((zone) =>
      zone.id === zoneId ? { ...zone, ...recommendation } : zone,
    );
    this.syncSnapshot();
    this.persist();
    this.notify();
  };
}

export const zonesStore = new ZonesStore();
export const plotsStore = zonesStore;

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
