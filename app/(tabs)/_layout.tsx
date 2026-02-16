import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { Alert } from "react-native";
import { getActiveDevice } from "@/lib/pairing-session";
import { useFlightMode } from "@/lib/flight-mode";

const ACTIVE_COLOR = "#141414";
const INACTIVE_COLOR = "#909090";

export default function TabsLayout() {
  const { isManualMode } = useFlightMode();

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (!user.isAnonymous && !user.emailVerified) {
        router.replace("/verify-email");
        return;
      }

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
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 4,
          letterSpacing: 0.4,
        },
        tabBarStyle: {
          height: 68,
          paddingTop: 6,
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
          },
        }}
        options={{
          title: "MANUAL",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="hub" size={size} color={isManualMode ? color : "#b7b7b7"} />
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
