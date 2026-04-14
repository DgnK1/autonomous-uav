const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type CreateRoverMissionInput = {
  zoneCode: string;
  targetTravelMs: number;
  drillIntervalMs: number;
};

export type RoverMissionStatus =
  | "queued"
  | "pending"
  | "in_progress"
  | "stopping"
  | "stopped"
  | "completed"
  | "cancelled";

export type RoverMissionRow = {
  id: number;
  zone_code: string;
  status: string;
  target_travel_ms: number;
  drill_interval_ms: number;
  moved_elapsed_ms: number | null;
  sample_count: number | null;
  created_at: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  stop_requested_at?: string | null;
};

function getHeaders(prefer = "return=representation") {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured.");
  }

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

export async function createRoverMission(input: CreateRoverMissionInput): Promise<RoverMissionRow> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rover_missions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      zone_code: input.zoneCode,
      target_travel_ms: input.targetTravelMs,
      drill_interval_ms: input.drillIntervalMs,
      status: "pending",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Failed to create rover mission (${response.status}).`);
  }

  const rows = (await response.json()) as RoverMissionRow[];
  const mission = rows[0];
  if (!mission) {
    throw new Error("Supabase did not return the created rover mission.");
  }

  return mission;
}

export async function updateRoverMissionStatus(
  missionId: number,
  status: RoverMissionStatus,
  extra: Partial<Pick<RoverMissionRow, "moved_elapsed_ms" | "sample_count">> & {
    stop_requested_at?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    updated_at?: string | null;
  } = {},
) {
  const payload = {
    status,
    ...extra,
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rover_missions?id=eq.${missionId}`, {
    method: "PATCH",
    headers: getHeaders("return=minimal"),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Failed to update rover mission (${response.status}).`);
  }
}

export async function fetchLatestActiveRoverMission() {
  const statusFilter = "status=in.(queued,pending,in_progress,stopping)";
  const selects = [
    "id,zone_code,status,target_travel_ms,drill_interval_ms,moved_elapsed_ms,sample_count,created_at,updated_at,started_at,finished_at,stop_requested_at",
    "id,zone_code,status,target_travel_ms,drill_interval_ms,moved_elapsed_ms,sample_count,created_at",
  ];

  let lastError: Error | null = null;

  for (const select of selects) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rover_missions?select=${encodeURIComponent(select)}&${statusFilter}&order=created_at.desc&limit=1`,
      {
        headers: getHeaders("return=representation"),
      },
    );

    if (response.ok) {
      const rows = (await response.json()) as RoverMissionRow[];
      return rows[0] ?? null;
    }

    const errorText = await response.text();
    lastError = new Error(
      errorText || `Failed to fetch active rover mission (${response.status}).`,
    );

    if (!errorText.toLowerCase().includes("column")) {
      throw lastError;
    }
  }

  throw lastError ?? new Error("Failed to fetch active rover mission.");
}
