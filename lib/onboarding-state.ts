import * as FileSystem from "expo-file-system/legacy";

const STORAGE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}soaris-onboarding-v1.txt`
  : null;

let hydrated = false;
let completed = false;
let hydrationPromise: Promise<void> | null = null;

export function ensureOnboardingHydrated() {
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
      completed = raw.trim() === "done";
    } catch {
      completed = false;
    } finally {
      hydrated = true;
    }
  })();

  return hydrationPromise;
}

export function hasCompletedOnboarding() {
  return completed;
}

export async function markOnboardingComplete() {
  completed = true;
  hydrated = true;

  if (!STORAGE_URI) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(STORAGE_URI, "done");
  } catch {
    // Ignore persistence failures and allow the user to continue.
  }
}

void ensureOnboardingHydrated();
