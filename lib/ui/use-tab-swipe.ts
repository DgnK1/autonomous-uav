import { router } from "expo-router";
import { useMemo, useRef } from "react";
import { PanResponder } from "react-native";

type TabKey = "index" | "activity" | "summary" | "settings";

const TAB_ORDER: TabKey[] = ["index", "activity", "summary", "settings"];

const TAB_ROUTE: Record<TabKey, "/(tabs)" | "/(tabs)/activity" | "/(tabs)/summary" | "/(tabs)/settings"> = {
  index: "/(tabs)",
  activity: "/(tabs)/activity",
  summary: "/(tabs)/summary",
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

          router.replace(TAB_ROUTE[targetTab]);
          lastSwipeAtRef.current = now;
        },
      }),
    [currentTab]
  ).panHandlers;
}
