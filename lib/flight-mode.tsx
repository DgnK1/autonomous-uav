import { createContext, useContext, useMemo, useState } from "react";

type FlightMode = "Auto" | "Manual";

type FlightModeContextValue = {
  flightMode: FlightMode;
  isManualMode: boolean;
  isAutoMode: boolean;
  setFlightMode: (mode: FlightMode) => void;
};

const FlightModeContext = createContext<FlightModeContextValue | null>(null);

export function FlightModeProvider({ children }: { children: React.ReactNode }) {
  const [flightMode, setFlightMode] = useState<FlightMode>("Auto");

  const value = useMemo(
    () => ({
      flightMode,
      isManualMode: flightMode === "Manual",
      isAutoMode: flightMode === "Auto",
      setFlightMode,
    }),
    [flightMode]
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
