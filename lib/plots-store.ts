import * as FileSystem from "expo-file-system/legacy";
import { useSyncExternalStore } from "react";

type ZoneCoordinate = {
  latitude: number;
  longitude: number;
};

export type Zone = ZoneCoordinate & {
  id: string;
  title: string;
  hasSensorData: boolean;
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

type PersistedZonesState = {
  zones: Zone[];
  selectedZoneId: string | null;
};

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

function normalizeZone(value: unknown, index: number): Zone | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const zone = value as Partial<Zone>;

  if (
    typeof zone.id !== "string" ||
    typeof zone.title !== "string" ||
    !isFiniteNumber(zone.latitude) ||
    !isFiniteNumber(zone.longitude) ||
    !isValidLatitude(zone.latitude) ||
    !isValidLongitude(zone.longitude) ||
    typeof zone.moisture !== "string" ||
    !isFiniteNumber(zone.moistureValue) ||
    typeof zone.humidity !== "string" ||
    !isFiniteNumber(zone.humidityValue) ||
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
    hasSensorData: zone.hasSensorData === true,
    moisture: zone.moisture,
    moistureValue: zone.moistureValue,
    humidity: zone.humidity,
    humidityValue: zone.humidityValue,
    temperature: zone.temperature,
    temperatureValue: zone.temperatureValue,
    recommendation:
      typeof zone.recommendation === "string" || zone.recommendation === null
        ? zone.recommendation
        : null,
    recommendationConfidence: isFiniteNumber(zone.recommendationConfidence)
      ? zone.recommendationConfidence
      : null,
    recommendationTitle:
      typeof zone.recommendationTitle === "string" || zone.recommendationTitle === null
        ? zone.recommendationTitle
        : null,
    recommendationExplanation:
      typeof zone.recommendationExplanation === "string" ||
      zone.recommendationExplanation === null
        ? zone.recommendationExplanation
        : null,
  };
}

function formatZoneTitle(order: number) {
  return `Zone ${order}`;
}

function renumberZones(zones: Zone[]) {
  return zones.map((zone, index) => ({
    ...zone,
    title: formatZoneTitle(index + 1),
  }));
}

function createZone(latitude: number, longitude: number, index: number): Zone {
  return {
    id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: formatZoneTitle(index + 1),
    latitude,
    longitude,
    hasSensorData: false,
    moisture: "No data yet",
    moistureValue: 0,
    humidity: "No data yet",
    humidityValue: 0,
    temperature: "No data yet",
    temperatureValue: 0,
    recommendation: null,
    recommendationConfidence: null,
    recommendationTitle: null,
    recommendationExplanation: null,
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

      this.zones = renumberZones(nextZones);

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
    this.zones = renumberZones([...this.zones, zone]);

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

    this.zones = renumberZones(this.zones.filter((zone) => zone.id !== zoneId));

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
      if (zone.id !== zoneId) {
        return zone;
      }

      updated = true;

      if (!snapshot.hasSensorData) {
        const nextZone = {
          ...zone,
          hasSensorData: false,
          moisture: "No data yet",
          moistureValue: 0,
          humidity: "No data yet",
          humidityValue: 0,
          temperature: "No data yet",
          temperatureValue: 0,
        };

        changed =
          changed ||
          zone.hasSensorData !== nextZone.hasSensorData ||
          zone.moisture !== nextZone.moisture ||
          zone.moistureValue !== nextZone.moistureValue ||
          zone.humidity !== nextZone.humidity ||
          zone.humidityValue !== nextZone.humidityValue ||
          zone.temperature !== nextZone.temperature ||
          zone.temperatureValue !== nextZone.temperatureValue;

        return changed ? nextZone : zone;
      }

      const moistureValue = Math.max(0, Math.min(100, snapshot.moistureValue));
      const humidityValue = Math.max(0, Math.min(100, snapshot.humidityValue));
      const temperatureValue = snapshot.temperatureValue;

      const nextZone = {
        ...zone,
        hasSensorData: true,
        moisture: `${Math.round(moistureValue)}% avg`,
        moistureValue,
        humidity: `${Math.round(humidityValue)}% avg`,
        humidityValue,
        temperature: `${temperatureValue.toFixed(1)}C avg`,
        temperatureValue,
      };

      const zoneChanged =
        zone.hasSensorData !== nextZone.hasSensorData ||
        zone.moisture !== nextZone.moisture ||
        zone.moistureValue !== nextZone.moistureValue ||
        zone.humidity !== nextZone.humidity ||
        zone.humidityValue !== nextZone.humidityValue ||
        zone.temperature !== nextZone.temperature ||
        zone.temperatureValue !== nextZone.temperatureValue;

      changed = changed || zoneChanged;

      return zoneChanged ? nextZone : zone;
    });

    if (!updated || !changed) {
      return;
    }

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
