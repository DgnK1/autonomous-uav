import * as FileSystem from "expo-file-system/legacy";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type FlightMode = "Auto" | "Manual";

type FlightModeContextValue = {
  flightMode: FlightMode;
  isManualMode: boolean;
  isAutoMode: boolean;
  setFlightMode: (mode: FlightMode) => void;
};

const STORAGE_URI = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}soaris-flight-mode-v1.txt`
  : null;

const FlightModeContext = createContext<FlightModeContextValue | null>(null);

function isFlightMode(value: string): value is FlightMode {
  return value === "Auto" || value === "Manual";
}

export function FlightModeProvider({ children }: { children: React.ReactNode }) {
  const [flightMode, setFlightModeState] = useState<FlightMode>("Auto");
  const didUserSetModeRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      if (!STORAGE_URI) {
        return;
      }

      try {
        const info = await FileSystem.getInfoAsync(STORAGE_URI);
        if (!info.exists) {
          return;
        }
        const raw = await FileSystem.readAsStringAsync(STORAGE_URI);
        const saved = raw.trim();
        if (mounted && !didUserSetModeRef.current && isFlightMode(saved)) {
          setFlightModeState(saved);
        }
      } catch {
        // Keep default Auto mode when storage read fails.
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setFlightMode = useCallback((mode: FlightMode) => {
    didUserSetModeRef.current = true;
    setFlightModeState(mode);
    if (!STORAGE_URI) {
      return;
    }
    void FileSystem.writeAsStringAsync(STORAGE_URI, mode).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({
      flightMode,
      isManualMode: flightMode === "Manual",
      isAutoMode: flightMode === "Auto",
      setFlightMode,
    }),
    [flightMode, setFlightMode]
  );

  return <FlightModeContext.Provider value={value}>{children}</FlightModeContext.Provider>;
}

export function useFlightMode() {
  const context = useContext(FlightModeContext);
  if (!context) {
    throw new Error("useFlightMode must be used within FlightModeProvider");
  }
  return context;
}
