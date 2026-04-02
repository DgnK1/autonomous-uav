import { Stack } from "expo-router";
import { NotificationsProvider } from "@/components/notifications-sheet";
import { FlightModeProvider } from "@/lib/flight-mode";

export default function RootLayout() {
  return (
    <FlightModeProvider>
      <NotificationsProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NotificationsProvider>
    </FlightModeProvider>
  );
}
