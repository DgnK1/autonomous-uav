import { ref, set, onValue, get, type DatabaseReference } from "firebase/database";

import { db, firebaseConfigError } from "@/lib/firebase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

type CreateRoverMissionInput = {
  zoneCode: string;
  targetTravelMs: number;
  drillIntervalMs: number;
};

type RoverMissionRow = {
  id: number;
  zone_code: string;
  status: string;
  target_travel_ms: number;
  drill_interval_ms: number;
};

export type RoverMissionStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type RoverStatus = {
  missionActive: boolean;
  missionState: string;
  missionId: number | null;
  zoneCode: string | null;
  sampleCount: number;
  movedElapsedMs: number;
  targetTravelMs: number | null;
  drillIntervalMs: number | null;
};

type RobotControlStartPayload = {
  command: "start";
  missionId: number;
  zoneCode: string;
  targetTravelMs: number;
  drillIntervalMs: number;
  requestedAt: number;
};

type RobotControlStopPayload = {
  command: "stop";
  missionId: number | null;
  requestedAt: number;
};

type RobotControlPayload = RobotControlStartPayload | RobotControlStopPayload;

function getRobotControlRef() {
  if (!db || firebaseConfigError) {
    throw new Error(firebaseConfigError ?? "Firebase Realtime Database is not configured.");
  }

  return ref(db, "robotControl");
}

function getRobotStatusRef() {
  if (!db || firebaseConfigError) {
    throw new Error(firebaseConfigError ?? "Firebase Realtime Database is not configured.");
  }

  return ref(db, "robotStatus");
}

function getHeaders() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured.");
  }

  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseBoolean(value: unknown) {
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
  return false;
}

function validateRobotControlWrite(raw: unknown, payload: RobotControlPayload) {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }

  const source = raw as Record<string, unknown>;
  const command = typeof source.command === "string" ? source.command : "";
  const requestedAt = parseNumber(source.requestedAt);
  const missionId = parseNumber(source.missionId);

  if (command !== payload.command) {
    return false;
  }

  if (requestedAt !== payload.requestedAt) {
    return false;
  }

  if (payload.command === "start") {
    const zoneCode = typeof source.zoneCode === "string" ? source.zoneCode : "";
    const targetTravelMs = parseNumber(source.targetTravelMs);
    const drillIntervalMs = parseNumber(source.drillIntervalMs);

    return (
      missionId === payload.missionId &&
      zoneCode === payload.zoneCode &&
      targetTravelMs === payload.targetTravelMs &&
      drillIntervalMs === payload.drillIntervalMs
    );
  }

  return missionId === payload.missionId;
}

async function writeRobotControlCommand(payload: RobotControlPayload) {
  const controlRef = getRobotControlRef();

  // Retry once because occasional set() races can leave stale null in Realtime DB.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await set(controlRef, payload);

    const snapshot = await get(controlRef);
    const persisted = snapshot.val();
    const ok = validateRobotControlWrite(persisted, payload);

    if (ok) {
      return;
    }

    if (attempt === 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  throw new Error("Failed to persist robotControl command to Firebase.");
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

export async function sendStartMissionCommand(input: {
  missionId: number;
  zoneCode: string;
  targetTravelMs: number;
  drillIntervalMs: number;
}) {
  const requestedAt = Date.now();

  const payload: RobotControlStartPayload = {
    command: "start",
    missionId: input.missionId,
    zoneCode: input.zoneCode,
    targetTravelMs: input.targetTravelMs,
    drillIntervalMs: input.drillIntervalMs,
    requestedAt,
  };

  await writeRobotControlCommand(payload);
  return requestedAt;
}

export async function sendStopMissionCommand(missionId?: number | null) {
  const requestedAt = Date.now();

  const payload: RobotControlStopPayload = {
    command: "stop",
    missionId: missionId ?? null,
    requestedAt,
  };

  await writeRobotControlCommand(payload);
  return requestedAt;
}

export async function updateRoverMissionStatus(missionId: number, status: RoverMissionStatus) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rover_missions?id=eq.${missionId}`,
    {
      method: "PATCH",
      headers: {
        ...getHeaders(),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Failed to update rover mission (${response.status}).`);
  }
}

export async function forceCancelMission(input: {
  missionId: number | null;
  targetTravelMs?: number | null;
  drillIntervalMs?: number | null;
}) {
  const requestedAt = await sendStopMissionCommand(input.missionId);

  await set(getRobotStatusRef(), {
    device_id: "rover-01",
    missionActive: false,
    missionState: "idle",
    missionId: 0,
    zoneCode: "",
    sampleCount: 0,
    movedElapsedMs: 0,
    targetTravelMs: input.targetTravelMs ?? 0,
    drillIntervalMs: input.drillIntervalMs ?? 0,
  });

  if (typeof input.missionId === "number" && input.missionId > 0) {
    await updateRoverMissionStatus(input.missionId, "cancelled");
  }

  return requestedAt;
}

export function subscribeRobotStatus(onStatus: (status: RoverStatus) => void) {
  const statusRef: DatabaseReference = getRobotStatusRef();

  return onValue(statusRef, (snapshot) => {
    const raw = snapshot.val();
    const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

    onStatus({
      missionActive: parseBoolean(source.missionActive),
      missionState: typeof source.missionState === "string" ? source.missionState : "idle",
      missionId: parseNumber(source.missionId),
      zoneCode: typeof source.zoneCode === "string" ? source.zoneCode : null,
      sampleCount: parseNumber(source.sampleCount) ?? 0,
      movedElapsedMs: parseNumber(source.movedElapsedMs) ?? 0,
      targetTravelMs: parseNumber(source.targetTravelMs),
      drillIntervalMs: parseNumber(source.drillIntervalMs),
    });
  });
}
