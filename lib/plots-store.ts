import * as FileSystem from "expo-file-system/legacy";
import { useSyncExternalStore } from "react";

type PlotCoordinate = {
  latitude: number;
  longitude: number;
};

export type Plot = PlotCoordinate & {
  id: string;
  title: string;
  moisture: string;
  moistureValue: number;
  humidity: string;
  humidityValue: number;
  temperature: string;
  temperatureValue: number;
};

type PlotsSnapshot = {
  plots: Plot[];
  selectedPlotId: string | null;
};

type PlotTemplate = {
  moisture: string;
  moistureValue: number;
  humidity: string;
  humidityValue: number;
  temperature: string;
  temperatureValue: number;
};

type PersistedPlotsState = {
  plots: Plot[];
  selectedPlotId: string | null;
};

const DEFAULT_REGION_CENTER = {
  latitude: 10.5424,
  longitude: 123.9448,
};

const DEFAULT_TEMPLATES: PlotTemplate[] = [
  {
    moisture: "Dry (18%)",
    moistureValue: 18,
    humidity: "Low (30%)",
    humidityValue: 30,
    temperature: "35°C",
    temperatureValue: 35,
  },
  {
    moisture: "Moist (76%)",
    moistureValue: 76,
    humidity: "Humid (70%)",
    humidityValue: 70,
    temperature: "24°C",
    temperatureValue: 24,
  },
  {
    moisture: "Moderate (30%)",
    moistureValue: 30,
    humidity: "Balanced (45%)",
    humidityValue: 45,
    temperature: "31°C",
    temperatureValue: 31,
  },
  {
    moisture: "Wet (76%)",
    moistureValue: 76,
    humidity: "Humid (70%)",
    humidityValue: 70,
    temperature: "24°C",
    temperatureValue: 24,
  },
];

const INITIAL_PLOTS: Plot[] = [
  {
    id: "plot1",
    title: "Plot 1",
    latitude: 10.5432,
    longitude: 123.9439,
    ...DEFAULT_TEMPLATES[0],
  },
  {
    id: "plot2",
    title: "Plot 2",
    latitude: 10.5426,
    longitude: 123.9448,
    ...DEFAULT_TEMPLATES[1],
  },
  {
    id: "plot3",
    title: "Plot 3",
    latitude: 10.5419,
    longitude: 123.9441,
    ...DEFAULT_TEMPLATES[2],
  },
  {
    id: "plot4",
    title: "Plot 4",
    latitude: 10.5415,
    longitude: 123.9452,
    ...DEFAULT_TEMPLATES[3],
  },
];

const STORAGE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}soaris-plots-v4.json`
  : null;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizePlot(value: unknown, index: number): Plot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const plot = value as Partial<Plot>;
  const fallbackTemplate =
    DEFAULT_TEMPLATES[index] ?? DEFAULT_TEMPLATES[DEFAULT_TEMPLATES.length - 1];

  if (
    typeof plot.id !== "string" ||
    typeof plot.title !== "string" ||
    !isFiniteNumber(plot.latitude) ||
    !isFiniteNumber(plot.longitude) ||
    typeof plot.moisture !== "string" ||
    !isFiniteNumber(plot.moistureValue) ||
    typeof plot.temperature !== "string" ||
    !isFiniteNumber(plot.temperatureValue)
  ) {
    return null;
  }

  return {
    id: plot.id,
    title: plot.title,
    latitude: plot.latitude,
    longitude: plot.longitude,
    moisture: plot.moisture,
    moistureValue: plot.moistureValue,
    humidity:
      typeof plot.humidity === "string" ? plot.humidity : fallbackTemplate.humidity,
    humidityValue: isFiniteNumber(plot.humidityValue)
      ? plot.humidityValue
      : fallbackTemplate.humidityValue,
    temperature: plot.temperature,
    temperatureValue: plot.temperatureValue,
  };
}

function buildPlotFromCoordinate(coordinate: PlotCoordinate, index: number): Plot {
  const fallbackTemplate = DEFAULT_TEMPLATES[DEFAULT_TEMPLATES.length - 1];
  const template = DEFAULT_TEMPLATES[index] ?? fallbackTemplate;
  return {
    id: `plot${index + 1}`,
    title: `Plot ${index + 1}`,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    ...template,
  };
}

function fallbackCoordinates(count: number): PlotCoordinate[] {
  const offsetStep = 0.0004;
  return Array.from({ length: count }).map((_, index) => ({
    latitude:
      DEFAULT_REGION_CENTER.latitude +
      (index % 2 === 0 ? 1 : -1) * offsetStep * (index + 1),
    longitude:
      DEFAULT_REGION_CENTER.longitude +
      (index % 2 === 0 ? -1 : 1) * offsetStep * (index + 1),
  }));
}

class PlotsStore {
  private plots: Plot[] = INITIAL_PLOTS;
  private selectedPlotId: string | null = INITIAL_PLOTS[0]?.id ?? null;
  private snapshot: PlotsSnapshot = {
    plots: this.plots,
    selectedPlotId: this.selectedPlotId,
  };
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
    this.snapshot = {
      plots: this.plots,
      selectedPlotId: this.selectedPlotId,
    };
  }

  private persist() {
    if (!this.hydrated || !STORAGE_URI) {
      return;
    }

    const payload: PersistedPlotsState = {
      plots: this.plots,
      selectedPlotId: this.selectedPlotId,
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
      const parsed = JSON.parse(raw) as Partial<PersistedPlotsState>;
      const nextPlots = Array.isArray(parsed.plots)
        ? parsed.plots
            .map((plot, index) => normalizePlot(plot, index))
            .filter((plot): plot is Plot => plot !== null)
        : [];

      if (nextPlots.length > 0) {
        this.plots = nextPlots;
      }

      const nextSelected =
        typeof parsed.selectedPlotId === "string" ? parsed.selectedPlotId : null;
      this.selectedPlotId =
        nextSelected && this.plots.some((plot) => plot.id === nextSelected)
          ? nextSelected
          : this.plots[0]?.id ?? null;
    } catch {
      this.plots = INITIAL_PLOTS;
      this.selectedPlotId = INITIAL_PLOTS[0]?.id ?? null;
    } finally {
      this.hydrated = true;
      this.syncSnapshot();
      this.notify();
    }
  }

  getSnapshot = (): PlotsSnapshot => this.snapshot;

  setSelectedPlot = (plotId: string | null) => {
    const nextSelectedPlotId =
      plotId && this.plots.some((plot) => plot.id === plotId)
        ? plotId
        : this.plots[0]?.id ?? null;
    if (nextSelectedPlotId === this.selectedPlotId) {
      return;
    }
    this.selectedPlotId = nextSelectedPlotId;
    this.syncSnapshot();
    this.persist();
    this.notify();
  };

  addPlot = (plot: Plot) => {
    this.plots = [...this.plots, plot];
    if (!this.selectedPlotId) {
      this.selectedPlotId = plot.id;
    }
    this.syncSnapshot();
    this.persist();
    this.notify();
  };

  removePlot = (plotId: string) => {
    this.plots = this.plots.filter((plot) => plot.id !== plotId);
    if (this.selectedPlotId === plotId) {
      this.selectedPlotId = this.plots[0]?.id ?? null;
    }
    this.syncSnapshot();
    this.persist();
    this.notify();
  };

  setPlots = (nextPlots: Plot[]) => {
    this.plots = nextPlots;
    if (
      this.selectedPlotId &&
      !nextPlots.some((plot) => plot.id === this.selectedPlotId)
    ) {
      this.selectedPlotId = nextPlots[0]?.id ?? null;
    }
    this.syncSnapshot();
    this.persist();
    this.notify();
  };

  setPlotsFromCoordinates = (coordinates: PlotCoordinate[]) => {
    if (coordinates.length === 0) {
      return;
    }

    const nextCoordinates = coordinates.slice(0, 4);
    if (nextCoordinates.length < 4) {
      const backup = fallbackCoordinates(4);
      for (let index = nextCoordinates.length; index < 4; index += 1) {
        nextCoordinates.push(backup[index]);
      }
    }

    this.plots = nextCoordinates.map((coordinate, index) =>
      buildPlotFromCoordinate(coordinate, index),
    );
    this.selectedPlotId = this.plots[0]?.id ?? null;
    this.syncSnapshot();
    this.persist();
    this.notify();
  };
}

export const plotsStore = new PlotsStore();

export function usePlotsStore() {
  return useSyncExternalStore(
    plotsStore.subscribe,
    plotsStore.getSnapshot,
    plotsStore.getSnapshot,
  );
}
