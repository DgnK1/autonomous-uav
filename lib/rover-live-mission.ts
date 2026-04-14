import {
  get,
  onValue,
  ref,
  set,
  update,
  type DatabaseReference,
} from "firebase/database";

import { db, firebaseConfigError } from "@/lib/firebase";

export type RobotControlCommand = "start" | "stop";

export type RobotOverallState =
  | "idle"
  | "queued"
  | "pending"
  | "running"
  | "moving"
  | "drilling"
  | "stopping"
  | "stopped"
  | "completed"
  | "cancelled"
  | "error"
  | string;

export type MovementState =
  | "offline"
  | "idle"
  | "queued"
  | "moving"
  | "aligning"
  | "arrived"
  | "waiting_for_drill"
  | "stopping"
  | "stopped"
  | "completed"
  | "error"
  | string;

export type DrillState =
  | "offline"
  | "idle"
  | "queued"
  | "sampling"
  | "drilling"
  | "stopping"
  | "stopped"
  | "completed"
  | "error"
  | string;

export type MissionBusState = {
  missionId: number | null;
  zoneCode: string | null;
  requestDrill: boolean;
  drillStarted: boolean;
  drillDone: boolean;
  stopRequested: boolean;
  movementAck: boolean;
  drillAck: boolean;
  updatedAt: number | null;
  legacyPhase: string | null;
};

export type DevicePresence = {
  deviceId: string | null;
  deviceOnline: boolean;
  firmwareVersion: string | null;
  updatedAt: number | null;
  note: string | null;
};

export type LiveTelemetrySnapshot = {
  airHumidity: number | null;
  airTempC: number | null;
  soilMoisturePct: number | null;
  soilMoistureRaw: number | null;
  soilTempC: number | null;
  sampleCount: number;
};

export type LiveMissionSnapshot = {
  missionId: number | null;
  zoneCode: string | null;
  missionActive: boolean;
  overallState: RobotOverallState;
  robotStatus: {
    missionActive: boolean;
    missionId: number | null;
    zoneCode: string | null;
    overallState: RobotOverallState;
    updatedAt: number | null;
  };
  movementStatus: {
    deviceId: string | null;
    missionId: number | null;
    zoneCode: string | null;
    state: MovementState;
    tagId: number | null;
    tagVisible: boolean;
    tagCx: number | null;
    tagWidth: number | null;
    updatedAt: number | null;
    note: string | null;
  };
  drillStatus: {
    deviceId: string | null;
    missionId: number | null;
    zoneCode: string | null;
    state: DrillState;
    sampleCount: number;
    busy: boolean;
    runId: number | null;
    soilTempAvg: number | null;
    soilMoistureAvg: number | null;
    airHumidityAvg: number | null;
    updatedAt: number | null;
  };
  missionBus: MissionBusState;
  telemetry: LiveTelemetrySnapshot;
  devices: {
    movement: DevicePresence;
    drill: DevicePresence;
  };
  stopAwaiting: {
    movement: boolean;
    drill: boolean;
  };
};

export type DevicePresenceSnapshot = LiveMissionSnapshot["devices"];

type StartMissionControlInput = {
  missionId: number;
  zoneCode: string;
  targetTravelMs: number;
  drillIntervalMs: number;
  requestId: string;
};

type StopMissionControlInput = {
  missionId: number | null;
  zoneCode?: string | null;
  requestId: string;
};

type RobotControlPayload = {
  command: RobotControlCommand;
  missionId: number | null;
  zoneCode: string | null;
  targetTravelMs?: number;
  drillIntervalMs?: number;
  requestedAt: number;
  requestId: string;
};

function getRequiredRef(path: string) {
  if (!db || firebaseConfigError) {
    throw new Error(firebaseConfigError ?? "Firebase Realtime Database is not configured.");
  }

  return ref(db, path);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
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

function sanitizeState<T extends string>(value: string | null, fallback: T) {
  if (!value) {
    return fallback;
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_") as T | string;
}

function hasRecordShape(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createEmptySnapshot(): LiveMissionSnapshot {
  return {
    missionId: null,
    zoneCode: null,
    missionActive: false,
    overallState: "idle",
    robotStatus: {
      missionActive: false,
      missionId: null,
      zoneCode: null,
      overallState: "idle",
      updatedAt: null,
    },
    movementStatus: {
      deviceId: null,
      missionId: null,
      zoneCode: null,
      state: "offline",
      tagId: null,
      tagVisible: false,
      tagCx: null,
      tagWidth: null,
      updatedAt: null,
      note: null,
    },
    drillStatus: {
      deviceId: null,
      missionId: null,
      zoneCode: null,
      state: "offline",
      sampleCount: 0,
      busy: false,
      runId: null,
      soilTempAvg: null,
      soilMoistureAvg: null,
      airHumidityAvg: null,
      updatedAt: null,
    },
    missionBus: {
      missionId: null,
      zoneCode: null,
      requestDrill: false,
      drillStarted: false,
      drillDone: false,
      stopRequested: false,
      movementAck: false,
      drillAck: false,
      updatedAt: null,
      legacyPhase: null,
    },
    telemetry: {
      airHumidity: null,
      airTempC: null,
      soilMoisturePct: null,
      soilMoistureRaw: null,
      soilTempC: null,
      sampleCount: 0,
    },
    devices: {
      movement: {
        deviceId: null,
        deviceOnline: false,
        firmwareVersion: null,
        updatedAt: null,
        note: null,
      },
      drill: {
        deviceId: null,
        deviceOnline: false,
        firmwareVersion: null,
        updatedAt: null,
        note: null,
      },
    },
    stopAwaiting: {
      movement: false,
      drill: false,
    },
  };
}

function createRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function deriveMovementState(source: Record<string, unknown>): MovementState {
  const explicit =
    parseText(source.state) ??
    parseText(source.movementState) ??
    parseText(source.phase);

  if (explicit) {
    return sanitizeState(explicit, "idle") as MovementState;
  }

  if (parseBoolean(source.drillRequested)) {
    return "waiting_for_drill";
  }

  if (parseBoolean(source.missionActive)) {
    return "moving";
  }

  return "idle";
}

function deriveDrillState(source: Record<string, unknown>): DrillState {
  const explicit =
    parseText(source.state) ??
    parseText(source.phase);

  if (explicit) {
    return sanitizeState(explicit, "idle") as DrillState;
  }

  if (parseBoolean(source.busy)) {
    return "sampling";
  }

  return "idle";
}

function deriveRobotOverallState(
  robotStatus: LiveMissionSnapshot["robotStatus"],
  movementState: MovementState,
  drillState: DrillState,
  missionBus: MissionBusState,
) {
  const explicit = sanitizeState(robotStatus.overallState, "idle");
  if (explicit && explicit !== "idle") {
    return explicit as RobotOverallState;
  }

  if (missionBus.stopRequested) {
    return "stopping";
  }

  if (drillState !== "idle" && drillState !== "offline" && drillState !== "completed") {
    return drillState;
  }

  if (movementState !== "idle" && movementState !== "offline" && movementState !== "completed") {
    return movementState;
  }

  if (robotStatus.missionActive) {
    return "running";
  }

  if (missionBus.drillDone) {
    return "completed";
  }

  return explicit as RobotOverallState;
}

function normalizeRobotStatus(raw: unknown): LiveMissionSnapshot["robotStatus"] {
  const source = hasRecordShape(raw) ? raw : {};

  return {
    missionActive:
      parseBoolean(source.missionActive) ??
      parseBoolean(source.missionSelected) ??
      false,
    missionId: parseNumber(source.missionId) ?? parseNumber(source.targetId),
    zoneCode: parseText(source.zoneCode),
    overallState:
      sanitizeState(
        parseText(source.overallState) ?? parseText(source.missionState),
        "idle",
      ) as RobotOverallState,
    updatedAt: parseNumber(source.updatedAt) ?? parseNumber(source.lastUpdatedAt),
  };
}

function normalizeMovementStatus(raw: unknown) {
  const source = hasRecordShape(raw) ? raw : {};

  return {
    deviceId: parseText(source.deviceId) ?? parseText(source.device_id),
    missionId: parseNumber(source.missionId),
    zoneCode: parseText(source.zoneCode),
    state: deriveMovementState(source),
    tagId: parseNumber(source.tagId),
    tagVisible: parseBoolean(source.tagVisible) ?? false,
    tagCx: parseNumber(source.tagCx),
    tagWidth: parseNumber(source.tagWidth),
    updatedAt:
      parseNumber(source.updatedAt) ??
      parseNumber(source.lastSeenAt) ??
      parseNumber(source.lastTagSeenMs),
    note: parseText(source.note),
  };
}

function normalizeDrillStatus(raw: unknown) {
  const source = hasRecordShape(raw) ? raw : {};

  return {
    deviceId: parseText(source.deviceId) ?? parseText(source.device_id),
    missionId: parseNumber(source.missionId),
    zoneCode: parseText(source.zoneCode),
    state: deriveDrillState(source),
    sampleCount: parseNumber(source.sampleCount) ?? 0,
    busy: parseBoolean(source.busy) ?? false,
    runId: parseNumber(source.runId),
    soilTempAvg: parseNumber(source.soilTempAvg),
    soilMoistureAvg: parseNumber(source.soilMoistureAvg),
    airHumidityAvg: parseNumber(source.airHumidityAvg),
    updatedAt:
      parseNumber(source.updatedAt) ??
      parseNumber(source.lastHandledDrillRequestAt) ??
      parseNumber(source.drillAckAt),
  };
}

function normalizeMissionBus(raw: unknown): MissionBusState {
  const source = hasRecordShape(raw) ? raw : {};
  const legacyPhase = parseText(source.phase);
  const stopAt = parseNumber(source.stopAt);
  const drillRequested = parseBoolean(source.drillRequested);
  const drillDone = parseBoolean(source.drillDone);
  const requestDrill =
    parseBoolean(source.request_drill) ??
    drillRequested ??
    (legacyPhase
      ? ["request_drill", "drill_requested", "drilling"].includes(
          sanitizeState(legacyPhase, "idle"),
        )
      : false);
  const drillStarted =
    parseBoolean(source.drill_started) ??
    (legacyPhase
      ? ["drilling", "sampling"].includes(sanitizeState(legacyPhase, "idle"))
      : false);

  return {
    missionId: parseNumber(source.missionId),
    zoneCode: parseText(source.zoneCode),
    requestDrill,
    drillStarted,
    drillDone:
      parseBoolean(source.drill_done) ??
      drillDone ??
      (legacyPhase
        ? ["drill_done", "resume_after_drill", "completed"].includes(
            sanitizeState(legacyPhase, "idle"),
          )
        : false),
    stopRequested:
      parseBoolean(source.stop_requested) ??
      (typeof stopAt === "number" && stopAt > 0) ??
      (legacyPhase ? sanitizeState(legacyPhase, "idle") === "stopping" : false),
    movementAck:
      parseBoolean(source.movement_ack) ??
      (parseNumber(source.movementAckAt) ?? 0) > 0,
    drillAck:
      parseBoolean(source.drill_ack) ??
      (parseNumber(source.drillAckAt) ?? 0) > 0,
    updatedAt:
      parseNumber(source.updatedAt) ??
      parseNumber(source.requestedAt) ??
      parseNumber(source.drillRequestAt) ??
      parseNumber(source.drillAckAt) ??
      stopAt,
    legacyPhase,
  };
}

function normalizeDevicePresence(raw: unknown, fallbackDeviceId: string | null, fallbackUpdatedAt: number | null, fallbackNote: string | null): DevicePresence {
  const source = hasRecordShape(raw) ? raw : {};
  const deviceId = parseText(source.deviceId) ?? parseText(source.device_id) ?? fallbackDeviceId;
  const updatedAt = parseNumber(source.updatedAt) ?? parseNumber(source.lastSeenAt) ?? fallbackUpdatedAt;

  return {
    deviceId,
    deviceOnline:
      parseBoolean(source.deviceOnline) ??
      parseBoolean(source.online) ??
      Boolean(deviceId || updatedAt),
    firmwareVersion:
      parseText(source.firmwareVersion) ?? parseText(source.firmware_version),
    updatedAt,
    note: parseText(source.note) ?? fallbackNote,
  };
}

function normalizeTelemetry(raw: unknown): LiveTelemetrySnapshot {
  const source = hasRecordShape(raw) ? raw : {};

  return {
    airHumidity: parseNumber(source.airHumidity),
    airTempC: parseNumber(source.airTempC),
    soilMoisturePct: parseNumber(source.soilMoisturePct),
    soilMoistureRaw: parseNumber(source.soilMoistureRaw),
    soilTempC: parseNumber(source.soilTempC),
    sampleCount: parseNumber(source.sampleCount) ?? 0,
  };
}

function buildSnapshot(parts: {
  robotStatus: unknown;
  movementStatus: unknown;
  drillStatus: unknown;
  missionBus: unknown;
  telemetry: unknown;
  movementDevice: unknown;
  drillDevice: unknown;
}) {
  const snapshot = createEmptySnapshot();
  snapshot.robotStatus = normalizeRobotStatus(parts.robotStatus);
  snapshot.movementStatus = normalizeMovementStatus(parts.movementStatus);
  snapshot.drillStatus = normalizeDrillStatus(parts.drillStatus);
  snapshot.missionBus = normalizeMissionBus(parts.missionBus);
  snapshot.telemetry = normalizeTelemetry(parts.telemetry);
  snapshot.devices = {
    movement: normalizeDevicePresence(
      parts.movementDevice,
      snapshot.movementStatus.deviceId,
      snapshot.movementStatus.updatedAt,
      snapshot.movementStatus.note,
    ),
    drill: normalizeDevicePresence(
      parts.drillDevice,
      snapshot.drillStatus.deviceId,
      snapshot.drillStatus.updatedAt,
      null,
    ),
  };

  snapshot.missionId =
    snapshot.robotStatus.missionId ??
    snapshot.movementStatus.missionId ??
    snapshot.drillStatus.missionId ??
    snapshot.missionBus.missionId;
  snapshot.zoneCode =
    snapshot.robotStatus.zoneCode ??
    snapshot.movementStatus.zoneCode ??
    snapshot.drillStatus.zoneCode ??
    snapshot.missionBus.zoneCode;
  snapshot.overallState = deriveRobotOverallState(
    snapshot.robotStatus,
    snapshot.movementStatus.state,
    snapshot.drillStatus.state,
    snapshot.missionBus,
  );
  snapshot.missionActive =
    snapshot.robotStatus.missionActive ||
    !["idle", "offline", "completed", "cancelled", "stopped"].includes(
      snapshot.overallState,
    ) ||
    snapshot.missionBus.requestDrill ||
    snapshot.missionBus.drillStarted;
  snapshot.stopAwaiting = {
    movement: snapshot.missionBus.stopRequested && !snapshot.missionBus.movementAck,
    drill: snapshot.missionBus.stopRequested && !snapshot.missionBus.drillAck,
  };

  return snapshot;
}

function validateRobotControlWrite(raw: unknown, payload: RobotControlPayload) {
  if (!hasRecordShape(raw)) {
    return false;
  }

  const command = parseText(raw.command);
  const requestedAt = parseNumber(raw.requestedAt);
  const missionId = parseNumber(raw.missionId);
  const requestId = parseText(raw.requestId);

  if (
    command !== payload.command ||
    requestedAt !== payload.requestedAt ||
    missionId !== payload.missionId ||
    requestId !== payload.requestId
  ) {
    return false;
  }

  if (payload.command === "start") {
    return (
      parseText(raw.zoneCode) === payload.zoneCode &&
      parseNumber(raw.targetTravelMs) === payload.targetTravelMs &&
      parseNumber(raw.drillIntervalMs) === payload.drillIntervalMs
    );
  }

  return true;
}

async function writeRobotControlCommand(payload: RobotControlPayload) {
  const controlRef = getRequiredRef("robotControl");

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await set(controlRef, payload);

    const snapshot = await get(controlRef);
    if (validateRobotControlWrite(snapshot.val(), payload)) {
      return payload;
    }

    if (attempt === 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  throw new Error("Failed to persist robotControl command to Firebase.");
}

export function createMissionRequestId() {
  return createRequestId();
}

export async function resetMissionBusForStart(input: {
  missionId: number;
  zoneCode: string;
  requestedAt?: number;
}) {
  const requestedAt = input.requestedAt ?? Date.now();
  await set(getRequiredRef("missionBus"), {
    missionId: input.missionId,
    zoneCode: input.zoneCode,
    request_drill: false,
    drill_started: false,
    drill_done: false,
    stop_requested: false,
    movement_ack: false,
    drill_ack: false,
    updatedAt: requestedAt,
    phase: "starting",
    requestedAt,
    drillRequested: false,
    drillDone: false,
    drillRequestAt: 0,
    drillAckAt: 0,
    movementAckAt: 0,
    stopAt: 0,
    note: "app_start_reset",
  });
}

export async function startMission(input: StartMissionControlInput) {
  const requestedAt = Date.now();
  await resetMissionBusForStart({
    missionId: input.missionId,
    zoneCode: input.zoneCode,
    requestedAt,
  });

  const payload: RobotControlPayload = {
    command: "start",
    missionId: input.missionId,
    zoneCode: input.zoneCode,
    targetTravelMs: input.targetTravelMs,
    drillIntervalMs: input.drillIntervalMs,
    requestedAt,
    requestId: input.requestId,
  };

  await writeRobotControlCommand(payload);
  return payload;
}

export async function requestStopMission(input: StopMissionControlInput) {
  const requestedAt = Date.now();
  const missionBusRef = getRequiredRef("missionBus");
  await update(missionBusRef, {
    missionId: input.missionId,
    zoneCode: input.zoneCode ?? null,
    stop_requested: true,
    stopAt: requestedAt,
    updatedAt: requestedAt,
    phase: "stopping",
  });

  const payload: RobotControlPayload = {
    command: "stop",
    missionId: input.missionId,
    zoneCode: input.zoneCode ?? null,
    requestedAt,
    requestId: input.requestId,
  };

  await writeRobotControlCommand(payload);
  return payload;
}

export function subscribeLiveMissionSnapshot(
  onSnapshotChange: (snapshot: LiveMissionSnapshot) => void,
) {
  const refs: Record<string, DatabaseReference> = {
    robotStatus: getRequiredRef("robotStatus"),
    movementStatus: getRequiredRef("movementStatus"),
    drillStatus: getRequiredRef("drillStatus"),
    missionBus: getRequiredRef("missionBus"),
    telemetry: getRequiredRef("telemetry"),
    movementDevice: getRequiredRef("devices/movement"),
    drillDevice: getRequiredRef("devices/drill"),
  };

  const current: Record<string, unknown> = {
    robotStatus: null,
    movementStatus: null,
    drillStatus: null,
    missionBus: null,
    telemetry: null,
    movementDevice: null,
    drillDevice: null,
  };

  const emit = () => {
    onSnapshotChange(
      buildSnapshot({
        robotStatus: current.robotStatus,
        movementStatus: current.movementStatus,
        drillStatus: current.drillStatus,
        missionBus: current.missionBus,
        telemetry: current.telemetry,
        movementDevice: current.movementDevice,
        drillDevice: current.drillDevice,
      }),
    );
  };

  const unsubscribes = Object.entries(refs).map(([key, firebaseRef]) =>
    onValue(firebaseRef, (snapshot) => {
      current[key] = snapshot.val();
      emit();
    }),
  );

  emit();

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

export function subscribeDevicePresence(
  onPresenceChange: (presence: DevicePresenceSnapshot) => void,
) {
  return subscribeLiveMissionSnapshot((snapshot) => {
    onPresenceChange(snapshot.devices);
  });
}
