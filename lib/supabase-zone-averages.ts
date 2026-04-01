const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

type RobotRunAverageRow = {
  zone_code: string | null;
  soil_moisture_avg: number | null;
  soil_temp_avg: number | null;
  air_humidity: number | null;
};

export type ZoneAverages = {
  moistureValue: number;
  temperatureValue: number;
  humidityValue: number;
  hasSensorData: boolean;
};

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeZoneCode(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function isSupabaseZoneAveragesConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function fetchZoneAverages(): Promise<Record<string, ZoneAverages>> {
  if (!isSupabaseZoneAveragesConfigured()) {
    return {};
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/robot_runs?select=zone_code,soil_moisture_avg,soil_temp_avg,air_humidity&order=created_at.desc`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase zone averages fetch failed with status ${response.status}: ${errorText || "unknown error"}.`,
    );
  }

  const rows = (await response.json()) as RobotRunAverageRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return {};
  }

  const grouped = new Map<
    string,
    {
      moistureTotal: number;
      moistureCount: number;
      temperatureTotal: number;
      temperatureCount: number;
      humidityTotal: number;
      humidityCount: number;
    }
  >();

  rows.forEach((row) => {
    const zoneCode = normalizeZoneCode(row.zone_code);
    if (!zoneCode) {
      return;
    }

    const entry = grouped.get(zoneCode) ?? {
      moistureTotal: 0,
      moistureCount: 0,
      temperatureTotal: 0,
      temperatureCount: 0,
      humidityTotal: 0,
      humidityCount: 0,
    };

    const moistureValue = toFiniteNumber(row.soil_moisture_avg);
    if (moistureValue !== null) {
      entry.moistureTotal += moistureValue;
      entry.moistureCount += 1;
    }

    const temperatureValue = toFiniteNumber(row.soil_temp_avg);
    if (temperatureValue !== null) {
      entry.temperatureTotal += temperatureValue;
      entry.temperatureCount += 1;
    }

    const humidityValue = toFiniteNumber(row.air_humidity);
    if (humidityValue !== null) {
      entry.humidityTotal += humidityValue;
      entry.humidityCount += 1;
    }

    grouped.set(zoneCode, entry);
  });

  const averages: Record<string, ZoneAverages> = {};

  grouped.forEach((entry, zoneCode) => {
    const hasSensorData =
      entry.moistureCount > 0 &&
      entry.temperatureCount > 0 &&
      entry.humidityCount > 0;

    averages[zoneCode] = {
      hasSensorData,
      moistureValue: hasSensorData
        ? entry.moistureTotal / entry.moistureCount
        : 0,
      temperatureValue: hasSensorData
        ? entry.temperatureTotal / entry.temperatureCount
        : 0,
      humidityValue: hasSensorData
        ? entry.humidityTotal / entry.humidityCount
        : 0,
    };
  });

  return averages;
}
