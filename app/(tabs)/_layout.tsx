import { Ionicons } from "@expo/vector-icons";
import { Tabs, router, useSegments } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { Alert } from "react-native";
import { ensurePairingHydrated, getActiveDevice } from "@/lib/pairing-session";
import { useFlightMode } from "@/lib/flight-mode";
import { useAppTheme } from "@/lib/ui/app-theme";

export default function TabsLayout() {
  const { isManualMode } = useFlightMode();
  const { colors } = useAppTheme();
  const segments = useSegments();
  const currentTab =
    segments[0] === "(tabs)" && typeof segments[1] === "string" ? segments[1] : "index";

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (!user.isAnonymous && !user.emailVerified) {
        router.replace("/verify-email");
        return;
      }

      await ensurePairingHydrated();
      if (!getActiveDevice()) {
        router.replace("/pair-device");
      }
    });

    return unsubscribe;
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          marginBottom: 4,
          letterSpacing: 0.2,
        },
        tabBarAllowFontScaling: false,
        tabBarStyle: {
          height: 68,
          paddingTop: 6,
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "HOME",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "ACTIVITY",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="manual"
        listeners={{
          tabPress: (event) => {
            if (isManualMode) {
              return;
            }
            event.preventDefault();
            Alert.alert(
              "Manual Mode Required",
              "Please switch to Manual Mode from the Home page to access Manual Controls."
            );
            if (currentTab === "activity") {
              router.replace("/(tabs)/settings");
              return;
            }
            if (currentTab === "settings") {
              router.replace("/(tabs)/activity");
              return;
            }
            router.replace("/(tabs)/activity");
          },
        }}
        options={{
          title: "MANUAL",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="game-controller"
              size={size}
              color={isManualMode ? color : colors.tabInactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "SETTINGS",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
