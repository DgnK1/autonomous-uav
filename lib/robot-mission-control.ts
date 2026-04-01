import { ref, set } from "firebase/database";

import { db, firebaseConfigError } from "@/lib/firebase";

type MissionCommandInput = {
  targetId: number;
  zoneCode: string;
  latitude: number;
  longitude: number;
};

function getRobotControlRef() {
  if (!db || firebaseConfigError) {
    throw new Error(
      firebaseConfigError ?? "Firebase Realtime Database is not configured.",
    );
  }

  return ref(db, "robotControl");
}

export async function sendStartMissionCommand(input: MissionCommandInput) {
  const requestedAt = Date.now();

  await set(getRobotControlRef(), {
    command: "start",
    startMission: true,
    stopMission: false,
    targetId: input.targetId,
    zoneCode: input.zoneCode,
    latitude: input.latitude,
    longitude: input.longitude,
    requestedAt,
  });

  return requestedAt;
}

export async function sendStopMissionCommand(targetId?: number | null) {
  const requestedAt = Date.now();

  await set(getRobotControlRef(), {
    command: "stop",
    startMission: false,
    stopMission: true,
    targetId: targetId ?? null,
    requestedAt,
  });

  return requestedAt;
}
