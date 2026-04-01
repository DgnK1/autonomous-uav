const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

type SupabaseCoordinate = {
  latitude: number;
  longitude: number;
};

type NavigationTargetInput = SupabaseCoordinate & {
  zoneCode?: string | null;
  source?: string;
  status?: string;
};

export type NavigationTargetRow = {
  id: number;
  zone_code: string | null;
  latitude: number;
  longitude: number;
  source: string | null;
  status: string | null;
  created_at?: string;
};

function findCoordinateValue(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function parseCoordinateRecord(payload: unknown): SupabaseCoordinate | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const latitude = findCoordinateValue(source, ["latitude", "lat"]);
  const longitude = findCoordinateValue(source, ["longitude", "lng", "lon"]);

  if (latitude !== null && longitude !== null) {
    return { latitude, longitude };
  }

  const nestedCandidates = [source.data, source.location, source.coordinates];
  for (const candidate of nestedCandidates) {
    const parsed = parseCoordinateRecord(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export function isSupabaseSensorLocationConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function fetchLatestSupabaseSensorLocation() {
  if (!isSupabaseSensorLocationConfigured()) {
    throw new Error(
      "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to fetch the latest transmitted sensor location.",
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/robot_runs?select=*&order=created_at.desc&limit=1`,
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
      `Supabase location fetch failed with status ${response.status}: ${errorText || "unknown error"}`,
    );
  }

  const rows = (await response.json()) as unknown;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No transmitted sensor location was found in Supabase yet.");
  }

  const latestLocation = parseCoordinateRecord(rows[0]);
  if (!latestLocation) {
    throw new Error(
      "The latest Supabase row does not include latitude/longitude values. Expected columns like latitude/longitude or lat/lng.",
    );
  }

  return latestLocation;
}

export async function createNavigationTarget(
  input: NavigationTargetInput,
): Promise<NavigationTargetRow> {
  if (!isSupabaseSensorLocationConfigured()) {
    throw new Error(
      "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to sync target locations with Supabase.",
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/navigation_targets`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        zone_code: input.zoneCode ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        source: input.source ?? "phone",
        status: input.status ?? "pending",
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase navigation target sync failed with status ${response.status}: ${errorText || "unknown error"}. Create a public navigation_targets table with insert/select policies before using phone GPS sync.`,
    );
  }

  const rows = (await response.json()) as NavigationTargetRow[];
  const createdTarget = Array.isArray(rows) ? rows[0] : null;

  if (!createdTarget || typeof createdTarget.id !== "number") {
    throw new Error(
      "Supabase navigation target sync succeeded, but no target row was returned.",
    );
  }

  return createdTarget;
}

export async function updateNavigationTargetStatus(
  targetId: number,
  status: string,
): Promise<NavigationTargetRow | null> {
  if (!isSupabaseSensorLocationConfigured()) {
    throw new Error(
      "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to update navigation target status.",
    );
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/navigation_targets?id=eq.${targetId}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Supabase navigation target status update failed with status ${response.status}: ${errorText || "unknown error"}.`,
    );
  }

  const rows = (await response.json()) as NavigationTargetRow[];
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
