import { Stack } from "expo-router";
import { FlightModeProvider } from "@/lib/flight-mode";

export default function RootLayout() {
  return (
    <FlightModeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </FlightModeProvider>
  );
}
