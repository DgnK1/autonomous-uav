import * as FileSystem from "expo-file-system/legacy";

type PairingState = {
  pairedDevices: string[];
  activeDevice: string | null;
};

const INITIAL_STATE: PairingState = {
  pairedDevices: [],
  activeDevice: null,
};

const STORAGE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}soaris-pairing-v1.json`
  : null;

let state: PairingState = INITIAL_STATE;
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

function isValidPairingState(value: unknown): value is PairingState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const pairingState = value as Partial<PairingState>;
  const validDevices =
    Array.isArray(pairingState.pairedDevices) &&
    pairingState.pairedDevices.every((item) => typeof item === "string");
  const validActive =
    typeof pairingState.activeDevice === "string" || pairingState.activeDevice === null;

  return validDevices && validActive;
}

function persist() {
  if (!hydrated || !STORAGE_URI) {
    return;
  }
  void FileSystem.writeAsStringAsync(STORAGE_URI, JSON.stringify(state)).catch(() => undefined);
}

export function ensurePairingHydrated() {
  if (hydrated) {
    return Promise.resolve();
  }

  if (hydrationPromise) {
    return hydrationPromise;
  }

  hydrationPromise = (async () => {
    if (!STORAGE_URI) {
      hydrated = true;
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(STORAGE_URI);
      if (!info.exists) {
        return;
      }

      const raw = await FileSystem.readAsStringAsync(STORAGE_URI);
      const parsed = JSON.parse(raw);
      if (isValidPairingState(parsed)) {
        const activeStillExists =
          parsed.activeDevice === null || parsed.pairedDevices.includes(parsed.activeDevice);
        state = {
          pairedDevices: parsed.pairedDevices,
          activeDevice: activeStillExists ? parsed.activeDevice : null,
        };
      }
    } catch {
      state = INITIAL_STATE;
    } finally {
      hydrated = true;
    }
  })();

  return hydrationPromise;
}

void ensurePairingHydrated();

export function getPairedDevices() {
  return [...state.pairedDevices];
}

export function addPairedDevice(label: string) {
  state = {
    ...state,
    pairedDevices: [...state.pairedDevices, label],
  };
  persist();
}

export function removePairedDeviceByIndex(index: number) {
  if (index < 0 || index >= state.pairedDevices.length) {
    return;
  }

  const removed = state.pairedDevices[index];
  const nextPaired = state.pairedDevices.filter((_, idx) => idx !== index);
  const nextActive = state.activeDevice === removed ? null : state.activeDevice;

  state = {
    pairedDevices: nextPaired,
    activeDevice: nextActive,
  };
  persist();
}

export function setActiveDevice(deviceLabel: string) {
  if (!state.pairedDevices.includes(deviceLabel)) {
    return;
  }
  state = {
    ...state,
    activeDevice: deviceLabel,
  };
  persist();
}

export function getActiveDevice() {
  return state.activeDevice;
}

export function clearPairingSession() {
  state = INITIAL_STATE;
  persist();
}

