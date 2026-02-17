import { router } from "expo-router";
import { useMemo, useRef } from "react";
import { Alert, PanResponder } from "react-native";
import { useFlightMode } from "@/lib/flight-mode";

type TabKey = "index" | "activity" | "manual" | "settings";

const TAB_ORDER: TabKey[] = ["index", "activity", "manual", "settings"];

const TAB_ROUTE: Record<TabKey, "/(tabs)" | "/(tabs)/activity" | "/(tabs)/manual" | "/(tabs)/settings"> = {
  index: "/(tabs)",
  activity: "/(tabs)/activity",
  manual: "/(tabs)/manual",
  settings: "/(tabs)/settings",
};

function getNeighborTab(current: TabKey, direction: "left" | "right"): TabKey | null {
  const currentIndex = TAB_ORDER.indexOf(current);
  if (currentIndex < 0) {
    return null;
  }
  const nextIndex = direction === "left" ? currentIndex + 1 : currentIndex - 1;
  if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) {
    return null;
  }
  return TAB_ORDER[nextIndex];
}

export function useTabSwipe(currentTab: TabKey) {
  const { isManualMode } = useFlightMode();
  const lastSwipeAtRef = useRef(0);

  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dx) > 18 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderRelease: (_event, gestureState) => {
          const now = Date.now();
          if (now - lastSwipeAtRef.current < 300) {
            return;
          }

          const absDx = Math.abs(gestureState.dx);
          const absDy = Math.abs(gestureState.dy);
          if (absDx < 52 || absDx <= absDy) {
            return;
          }

          const direction: "left" | "right" = gestureState.dx < 0 ? "left" : "right";
          const targetTab = getNeighborTab(currentTab, direction);
          if (!targetTab) {
            return;
          }

          if (targetTab === "manual" && !isManualMode) {
            Alert.alert(
              "Manual Mode Required",
              "Switch to Manual Mode from Home before opening Manual Controls."
            );
            if (currentTab === "activity") {
              router.replace(TAB_ROUTE.settings);
            } else if (currentTab === "settings") {
              router.replace(TAB_ROUTE.activity);
            } else {
              router.replace(TAB_ROUTE.activity);
            }
            lastSwipeAtRef.current = now;
            return;
          }

          router.replace(TAB_ROUTE[targetTab]);
          lastSwipeAtRef.current = now;
        },
      }),
    [currentTab, isManualMode]
  ).panHandlers;
}
