import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotificationsSheet } from "@/components/notifications-sheet";
import { FadeInView } from "@/components/ui/fade-in-view";
import { db, firebaseConfigError } from "@/lib/firebase";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  getLayoutProfile,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";
import { onValue, ref } from "firebase/database";

type MissionLogItem = {
  id: string;
  elapsedLabel: string;
  hasElapsedTime: boolean;
  clockTime: string;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  timestampMs: number;
  createdAtMs: number;
};

type ActivityAlertItem = {
  id: string;
  level: string;
  title: string;
  age: string;
  body: string;
  accent: string;
  timestampMs: number;
};

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const MISSION_PASS_TARGET = 3;
const RECENT_ACTIVITY_LIMIT = 5;
const MISSION_LOG_SELECT =
  "id,device_id,type,message,zone_index,pass_count,latitude,longitude,target_id,target_lat,target_lng,created_at";
const ACTIVITY_ALERT_SELECT =
  "id,device_id,severity,message,zone_index,pass_count,latitude,longitude,created_at";

function isBootLogTitle(title: string) {
  const normalized = title.trim().toLowerCase();
  return normalized.includes("robot booted and idle") || normalized.includes("rover booted and idle");
}

function parseFirebaseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseFirebaseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return null;
}

function parseFirebaseText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function formatElapsedMissionTime(timestampMs: number) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return "--m --s";
  }

  const totalSeconds = Math.floor(timestampMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatMissionClockTime(createdAtMs: number) {
  if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) {
    return "Time --:--:--";
  }

  const formatted = new Date(createdAtMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `Time ${formatted}`;
}

function formatAlertAge(timestampMs: number) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return "just now";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getMissionLogPresentation(type: string, message: string) {
  const normalizedType = type.toLowerCase();
  const normalizedMessage = message.toLowerCase();

  if (normalizedType === "error") {
    return { icon: "close-circle" as const, iconColor: "#ef5350" };
  }
  if (normalizedMessage.includes("reached") || normalizedMessage.includes("completed")) {
    return { icon: "checkmark-circle" as const, iconColor: "#38d27a" };
  }
  if (normalizedMessage.includes("obstacle")) {
    return { icon: "warning" as const, iconColor: "#f3b234" };
  }
  if (normalizedMessage.includes("mission started")) {
    return { icon: "play-circle" as const, iconColor: "#4b8dff" };
  }
  return { icon: "list" as const, iconColor: "#94a3b8" };
}

function getAlertAccent(severity: string) {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "error") {
    return "#ef5350";
  }
  if (normalized === "warning") {
    return "#f3b234";
  }
  return "#4b8dff";
}

function formatCoordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(6) : null;
}

function buildMissionLogBody(source: Record<string, unknown>) {
  const lines: string[] = [];

  if (typeof source.device_id === "string" && source.device_id.trim()) {
    lines.push(`Source: ${source.device_id}`);
  }

  const zoneIndex =
    typeof source.zoneIndex === "number" && Number.isFinite(source.zoneIndex)
      ? source.zoneIndex
      : typeof source.zone_index === "number" && Number.isFinite(source.zone_index)
        ? source.zone_index
        : null;
  if (zoneIndex !== null) {
    lines.push(`Zone: ${zoneIndex + 1}`);
  }

  const passCount =
    typeof source.passCount === "number" && Number.isFinite(source.passCount)
      ? source.passCount
      : typeof source.pass_count === "number" && Number.isFinite(source.pass_count)
        ? source.pass_count
        : null;
  if (passCount !== null) {
    lines.push(`Pass: ${passCount}`);
  }

  const latitude = formatCoordinate(source.latitude ?? source.target_lat);
  const longitude = formatCoordinate(source.longitude ?? source.target_lng);
  if (latitude && longitude && !(latitude === "0.000000" && longitude === "0.000000")) {
    lines.push(`Coords: ${latitude}, ${longitude}`);
  }

  return lines.length > 0 ? lines.join("\n") : "Live mission event from the rover.";
}

function normalizeMissionLogTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (isBootLogTitle(trimmed)) {
    return "ROVER BOOTED AND IDLE";
  }

  return trimmed.toUpperCase().replace(/\brobot\b/gi, "ROVER");
}

function parseMissionLogs(value: unknown): MissionLogItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const results: MissionLogItem[] = [];

  value.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      return;
    }

    const source = item as Record<string, unknown>;
    const rawId = source.id;
    const id =
      typeof rawId === "number" || typeof rawId === "string"
        ? String(rawId)
        : `mission-log-${index}`;
    const title = typeof source.message === "string" ? source.message : "";
    if (!title.trim()) {
      return;
    }

    const type = typeof source.type === "string" ? source.type : "info";
    const timestampMs =
      typeof source.timestamp_ms === "number" && Number.isFinite(source.timestamp_ms)
        ? source.timestamp_ms
        : 0;
    const createdAtRaw = typeof source.created_at === "string" ? source.created_at : "";
    const createdAtMs = createdAtRaw ? Date.parse(createdAtRaw) : 0;
    const presentation = getMissionLogPresentation(type, title);

    results.push({
      id,
      elapsedLabel: formatElapsedMissionTime(timestampMs),
      hasElapsedTime: timestampMs > 0,
      clockTime: formatMissionClockTime(createdAtMs),
      title: normalizeMissionLogTitle(title),
      body: buildMissionLogBody(source),
      icon: presentation.icon,
      iconColor: presentation.iconColor,
      timestampMs,
      createdAtMs,
    });
  });

  return results.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

function parseActivityAlerts(value: unknown): ActivityAlertItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const results: ActivityAlertItem[] = [];

  value.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      return;
    }

    const source = item as Record<string, unknown>;
    const body = typeof source.message === "string" ? source.message : "";
    if (!body.trim()) {
      return;
    }

    const severity = typeof source.severity === "string" ? source.severity : "info";
    const createdAtRaw = typeof source.created_at === "string" ? source.created_at : "";
    const timestampMs = createdAtRaw ? Date.parse(createdAtRaw) : 0;
    const rawId = source.id;
    const id =
      typeof rawId === "number" || typeof rawId === "string"
        ? String(rawId)
        : `activity-alert-${index}`;

    results.push({
      id,
      level: severity.toUpperCase(),
      title:
        severity.toLowerCase() === "critical"
          ? "Critical Rover Alert"
          : severity.toLowerCase() === "warning"
            ? "Rover Warning"
            : "Rover Notice",
      age: formatAlertAge(timestampMs),
      body,
      accent: getAlertAccent(severity),
      timestampMs,
    });
  });

  return results.sort((a, b) => b.timestampMs - a.timestampMs);
}

function computeMissionCompletion(params: {
  missionLogs: MissionLogItem[];
  missionActive: boolean;
  missionState: string | null;
  passCount: number | null;
  targetStatus: string | null;
}) {
  const { missionLogs, missionActive, missionState, passCount, targetStatus } = params;
  const normalizedMissionState = missionState?.toLowerCase() ?? "";
  const normalizedTargetStatus = targetStatus?.toLowerCase() ?? "";
  const latestTitle = missionLogs[0]?.title.toLowerCase() ?? "";

  if (normalizedMissionState === "completed" || normalizedTargetStatus === "reached") {
    return 100;
  }

  if (
    latestTitle.includes("mission completed") ||
    latestTitle.includes("zone routine completed") ||
    latestTitle.includes("navigation target reached")
  ) {
    return 100;
  }

  if (normalizedMissionState === "aborted" || normalizedMissionState === "cancelled") {
    return 0;
  }

  if (normalizedTargetStatus === "cancelled") {
    return 0;
  }

  if (missionActive) {
    const safePassCount = Math.max(0, Math.min(MISSION_PASS_TARGET, passCount ?? 0));
    const samplingProgress = Math.round((safePassCount / MISSION_PASS_TARGET) * 35);

    if (safePassCount > 0) {
      return Math.min(95, 60 + samplingProgress);
    }

    if (normalizedMissionState === "running") {
      return 45;
    }

    if (normalizedMissionState === "stopping" || normalizedMissionState === "pending") {
      return 25;
    }

    return 35;
  }

  if (
    latestTitle.includes("accepted") ||
    latestTitle.includes("start command accepted")
  ) {
    return 20;
  }

  if (missionLogs.length > 0) {
    return 10;
  }

  return 0;
}

export default function ActivityScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const typography = getAccessibleAppTypography(width, fontScale);
  const styles = createStyles(width, colors, fontScale, isDark);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [clearingMissionLogs, setClearingMissionLogs] = useState(false);
  const [clearingAlerts, setClearingAlerts] = useState(false);
  const [clearingMissionLogHistory, setClearingMissionLogHistory] = useState(false);
  const [clearingAlertHistory, setClearingAlertHistory] = useState(false);
  const [showAllMissionLogs, setShowAllMissionLogs] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [missionHistoryOpen, setMissionHistoryOpen] = useState(false);
  const [alertHistoryOpen, setAlertHistoryOpen] = useState(false);
  const [missionLogs, setMissionLogs] = useState<MissionLogItem[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<ActivityAlertItem[]>([]);
  const [robotMissionActive, setRobotMissionActive] = useState(false);
  const [robotMissionState, setRobotMissionState] = useState<string | null>(null);
  const [robotPassCount, setRobotPassCount] = useState<number | null>(null);
  const [robotTargetStatus, setRobotTargetStatus] = useState<string | null>(null);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("activity");
  const latestBootLogIndex = useMemo(
    () => missionLogs.findIndex((item) => isBootLogTitle(item.title)),
    [missionLogs],
  );
  const currentSessionLogs = useMemo(() => {
    if (latestBootLogIndex === -1) {
      return missionLogs;
    }
    return missionLogs.slice(0, latestBootLogIndex + 1);
  }, [latestBootLogIndex, missionLogs]);
  const previousSessionLogs = useMemo(() => {
    if (latestBootLogIndex === -1) {
      return [];
    }
    return missionLogs.slice(latestBootLogIndex + 1);
  }, [latestBootLogIndex, missionLogs]);
  const normalizedQuery = query.toLowerCase().trim();
  const filteredTimeline = useMemo(
    () =>
      currentSessionLogs.filter((item) =>
        `${item.title} ${item.body}`.toLowerCase().includes(normalizedQuery),
      ),
    [currentSessionLogs, normalizedQuery],
  );
  const filteredMissionLogHistory = useMemo(
    () =>
      previousSessionLogs.filter((item) =>
        `${item.title} ${item.body}`.toLowerCase().includes(normalizedQuery),
      ),
    [previousSessionLogs, normalizedQuery],
  );
  const recentMissionLogs = useMemo(
    () => filteredTimeline.slice(0, RECENT_ACTIVITY_LIMIT),
    [filteredTimeline],
  );
  const missionLogHistory = filteredMissionLogHistory;
  const displayedMissionLogs = showAllMissionLogs ? filteredTimeline : recentMissionLogs;
  const recentAlerts = useMemo(
    () => liveAlerts.slice(0, RECENT_ACTIVITY_LIMIT),
    [liveAlerts],
  );
  const alertHistory = useMemo(
    () => liveAlerts.slice(RECENT_ACTIVITY_LIMIT),
    [liveAlerts],
  );
  const displayedAlerts = showAllAlerts ? liveAlerts : recentAlerts;
  const completion = useMemo(
    () =>
      computeMissionCompletion({
        missionLogs,
        missionActive: robotMissionActive,
        missionState: robotMissionState,
        passCount: robotPassCount,
        targetStatus: robotTargetStatus,
      }),
    [missionLogs, robotMissionActive, robotMissionState, robotPassCount, robotTargetStatus],
  );
  const completionSegments = 10;
  const filledSegments = Math.max(
    0,
    Math.min(completionSegments, Math.round((completion / 100) * completionSegments)),
  );

  const loadMissionLogs = useCallback(async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setMissionLogs([]);
      return;
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/mission_logs?select=${encodeURIComponent(MISSION_LOG_SELECT)}&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        errorText || `Mission log fetch failed with status ${response.status}.`,
      );
    }

    const rows = await response.json();
    setMissionLogs(parseMissionLogs(rows));
  }, []);

  const loadActivityAlerts = useCallback(async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setLiveAlerts([]);
      return;
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/activity_alerts?select=${encodeURIComponent(ACTIVITY_ALERT_SELECT)}&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        errorText || `Activity alert fetch failed with status ${response.status}.`,
      );
    }

    const rows = await response.json();
    setLiveAlerts(parseActivityAlerts(rows));
  }, []);

  const deleteSupabaseRows = useCallback(
    async (tableName: "mission_logs" | "activity_alerts", ids: string[]) => {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Supabase is not configured in the app.");
      }

      const safeIds = Array.from(
        new Set(ids.map((id) => id.trim()).filter((id) => /^\d+$/.test(id))),
      );

      if (safeIds.length === 0) {
        return;
      }

      const query = new URLSearchParams();
      query.append("id", `in.(${safeIds.join(",")})`);

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${tableName}?${query.toString()}`,
        {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: "return=minimal",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText || `${tableName} delete failed with status ${response.status}.`,
        );
      }
    },
    [],
  );

  const handleClearMissionLogs = useCallback(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      Alert.alert(
        "Supabase not configured",
        "Mission logs can only be cleared when Supabase is configured in the app.",
      );
      return;
    }

    Alert.alert(
      "Clear recent mission logs",
      "This will delete the currently shown recent mission log rows from Supabase. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            const idsToDelete = displayedMissionLogs.map((item) => item.id).filter(Boolean);
            if (idsToDelete.length === 0) {
              return;
            }

            setClearingMissionLogs(true);

            void deleteSupabaseRows("mission_logs", idsToDelete)
              .then(() => {
                setMissionLogs((prev) => prev.filter((item) => !idsToDelete.includes(item.id)));
              })
              .then(async () => {
                await loadMissionLogs();
              })
              .catch((error) => {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to clear mission logs.";
                Alert.alert("Clear Mission Logs failed", message);
              })
              .finally(() => {
                setClearingMissionLogs(false);
              });
          },
        },
      ],
    );
  }, [deleteSupabaseRows, displayedMissionLogs, loadMissionLogs]);

  const handleClearAlerts = useCallback(() => {
    Alert.alert(
      "Clear recent activity alerts",
      "This will delete the currently shown recent activity alert rows from Supabase. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            const idsToDelete = displayedAlerts.map((item) => item.id).filter(Boolean);
            if (idsToDelete.length === 0) {
              return;
            }

            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
              Alert.alert(
                "Supabase not configured",
                "Activity alerts can only be cleared when Supabase is configured in the app.",
              );
              return;
            }

            setClearingAlerts(true);

            void deleteSupabaseRows("activity_alerts", idsToDelete)
              .then(() => {
                setLiveAlerts((prev) => prev.filter((item) => !idsToDelete.includes(item.id)));
              })
              .then(async () => {
                await loadActivityAlerts();
              })
              .catch((error) => {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to clear activity alerts.";
                Alert.alert("Clear Alerts failed", message);
              })
              .finally(() => {
                setClearingAlerts(false);
              });
          },
        },
      ],
    );
  }, [deleteSupabaseRows, displayedAlerts, loadActivityAlerts]);

  const handleClearMissionLogHistory = useCallback(() => {
    Alert.alert(
      "Clear mission log history",
      "This will delete older mission log history rows from Supabase. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            const idsToDelete = missionLogHistory.map((item) => item.id).filter(Boolean);
            if (idsToDelete.length === 0) {
              return;
            }

            setClearingMissionLogHistory(true);

            void deleteSupabaseRows("mission_logs", idsToDelete)
              .then(() => {
                setMissionLogs((prev) => prev.filter((item) => !idsToDelete.includes(item.id)));
              })
              .then(async () => {
                await loadMissionLogs();
              })
              .catch((error) => {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to clear mission log history.";
                Alert.alert("Clear Mission Log History failed", message);
              })
              .finally(() => {
                setClearingMissionLogHistory(false);
              });
          },
        },
      ],
    );
  }, [deleteSupabaseRows, loadMissionLogs, missionLogHistory]);

  const handleClearAlertHistory = useCallback(() => {
    Alert.alert(
      "Clear activity alert history",
      "This will delete older activity alert history rows from Supabase. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            const idsToDelete = alertHistory.map((item) => item.id).filter(Boolean);
            if (idsToDelete.length === 0) {
              return;
            }

            setClearingAlertHistory(true);

            void deleteSupabaseRows("activity_alerts", idsToDelete)
              .then(() => {
                setLiveAlerts((prev) => prev.filter((item) => !idsToDelete.includes(item.id)));
              })
              .then(async () => {
                await loadActivityAlerts();
              })
              .catch((error) => {
                const message =
                  error instanceof Error
                    ? error.message
                    : "Failed to clear activity alert history.";
                Alert.alert("Clear Alert History failed", message);
              })
              .finally(() => {
                setClearingAlertHistory(false);
              });
          },
        },
      ],
    );
  }, [alertHistory, deleteSupabaseRows, loadActivityAlerts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([
      loadMissionLogs().catch((error) => {
        console.warn("Failed to refresh mission logs from Supabase", error);
      }),
      loadActivityAlerts().catch((error) => {
        console.warn("Failed to refresh activity alerts from Supabase", error);
      }),
    ])
      .finally(() => {
      setRefreshing(false);
      });
  }, [loadMissionLogs, loadActivityAlerts]);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return;
    }

    let cancelled = false;

    const fetchMissionLogs = async () => {
      try {
        await loadMissionLogs();
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load mission logs from Supabase", error);
          setMissionLogs([]);
        }
      }
    };

    void fetchMissionLogs();
    const intervalId = setInterval(() => {
      void fetchMissionLogs();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [loadMissionLogs]);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return;
    }

    let cancelled = false;

    const fetchAlerts = async () => {
      try {
        await loadActivityAlerts();
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load activity alerts from Supabase", error);
          setLiveAlerts([]);
        }
      }
    };

    void fetchAlerts();
    const intervalId = setInterval(() => {
      void fetchAlerts();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [loadActivityAlerts]);

  useEffect(() => {
    if (!db || firebaseConfigError) {
      return;
    }

    const robotStatusRef = ref(db, "robotStatus");
    const unsubscribeRobotStatus = onValue(robotStatusRef, (snapshot) => {
      const nextValue = snapshot.val();
      if (typeof nextValue !== "object" || nextValue === null) {
        setRobotMissionActive(false);
        setRobotMissionState(null);
        setRobotPassCount(null);
        setRobotTargetStatus(null);
        return;
      }

      const source = nextValue as Record<string, unknown>;
      setRobotMissionActive(parseFirebaseBoolean(source.missionActive) ?? false);
      setRobotMissionState(parseFirebaseText(source.missionState));
      setRobotPassCount(parseFirebaseNumber(source.passCount));
      setRobotTargetStatus(parseFirebaseText(source.targetStatus));
    });
    return () => {
      unsubscribeRobotStatus();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            onPress={openNotifications}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
          >
            <Ionicons name="notifications" size={22} color={colors.icon} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: APP_SPACING.xxxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.icon} />}
      >
        <FadeInView delay={60}>
          <View style={styles.searchPanel}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Search Tasks</Text>
              {query.trim().length > 0 ? (
                <TouchableOpacity
                  onPress={() => setQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear task search"
                >
                  <Text style={styles.searchClearText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                placeholder="Search mission logs and tasks"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInputInline}
                value={query}
                onChangeText={setQuery}
              />
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={90}>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>MISSION PROGRESS</Text>
              <Text style={styles.progressValue}>{`${completion}%`}</Text>
            </View>
            <View style={styles.progressTrack}>
              {Array.from({ length: completionSegments }).map((_, index) => (
                <View
                  key={`progress-${index}`}
                  style={[
                    styles.progressSegment,
                    index < filledSegments
                      ? styles.progressSegmentFilled
                      : styles.progressSegmentEmpty,
                  ]}
                />
              ))}
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={130}>
        <View style={styles.logSection}>
          <View style={styles.logHeader}>
            <View style={styles.logTitleWrap}>
              <Ionicons name="list" size={18} color="#4b8dff" />
              <Text style={styles.logTitle}>MISSION LOG</Text>
            </View>
            <View style={styles.logHeaderActions}>
              <TouchableOpacity
                onPress={handleClearMissionLogs}
                disabled={clearingMissionLogs || missionLogs.length === 0}
                accessibilityRole="button"
                accessibilityLabel="Clear mission logs"
              >
                <Text
                  style={[
                    styles.logClearButton,
                    (clearingMissionLogs || missionLogs.length === 0) &&
                      styles.logClearButtonDisabled,
                  ]}
                >
                  {clearingMissionLogs ? "CLEARING..." : "CLEAR LOGS"}
                </Text>
              </TouchableOpacity>
                <Text style={styles.logMeta}>CURRENT ROVER SESSION</Text>
            </View>
          </View>
          {displayedMissionLogs.map((item) => (
            <View style={styles.logCard} key={item.id}>
              <View style={styles.logTimeWrap}>
                {item.hasElapsedTime ? (
                  <Text style={styles.logTime}>{item.elapsedLabel}</Text>
                ) : null}
                <Text style={styles.logClockTime}>{item.clockTime}</Text>
              </View>
              <View style={styles.logContent}>
                <View style={styles.logRowTop}>
                  <Text style={styles.logEntryTitle}>{item.title}</Text>
                  <Ionicons name={item.icon} size={18} color={item.iconColor} />
                </View>
                <Text style={styles.logEntryBody}>{item.body}</Text>
              </View>
            </View>
          ))}
          {displayedMissionLogs.length === 0 ? (
            <View style={[styles.logCard, styles.emptyRow]}>
              <Text style={styles.emptyRowText}>
                {missionLogs.length === 0
                  ? "No mission logs yet. Mission logs will appear here after the rover starts a task and writes entries to Supabase."
                  : "No current-session mission logs match this search."}
              </Text>
            </View>
          ) : null}
          {filteredTimeline.length > RECENT_ACTIVITY_LIMIT ? (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setShowAllMissionLogs((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={
                showAllMissionLogs ? "Show fewer mission logs" : "Show all mission logs"
              }
            >
              <Text style={styles.showMoreButtonText}>
                {showAllMissionLogs
                  ? "SHOW LESS"
                  : `SHOW ALL ${filteredTimeline.length} LOGS`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        </FadeInView>

        <FadeInView delay={170}>
          <View style={styles.alertsPanel}>
            <View style={styles.alertsPanelHeader}>
              <View style={styles.alertsPanelTitleWrap}>
                <Ionicons name="warning" size={18} color="#f3b234" />
                <Text style={styles.alertsPanelTitle}>ACTIVITY ALERTS</Text>
              </View>
              <View style={styles.alertHeaderActions}>
                <TouchableOpacity
                  onPress={handleClearAlerts}
                  disabled={clearingAlerts || liveAlerts.length === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Clear activity alerts"
                >
                  <Text
                    style={[
                      styles.alertClearButton,
                      (clearingAlerts || liveAlerts.length === 0) &&
                        styles.alertClearButtonDisabled,
                    ]}
                  >
                    {clearingAlerts ? "CLEARING..." : "CLEAR ALERTS"}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.alertsPanelCount}>
                  {String(liveAlerts.length).padStart(2, "0")}
                </Text>
              </View>
            </View>
            {displayedAlerts.map((alert) => (
              <View
                key={alert.id}
                style={[styles.alertTile, { borderColor: `${alert.accent}55` }]}
              >
                <View style={styles.alertTileHeader}>
                  <Text style={[styles.alertLevel, { color: alert.accent }]}>{alert.level}</Text>
                  <Text style={styles.alertAge}>{alert.age}</Text>
                </View>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertBody}>{alert.body}</Text>
              </View>
            ))}
            {displayedAlerts.length === 0 ? (
              <View style={[styles.alertTile, styles.emptyAlertTile]}>
                <Text style={styles.emptyAlertTitle}>No activity alerts yet</Text>
                <Text style={styles.emptyAlertBody}>
                  Activity alerts will show here when the rover reports warnings or critical issues
                  to Supabase, such as obstacle handling, invalid readings, or mission problems.
                </Text>
              </View>
            ) : null}
            {liveAlerts.length > RECENT_ACTIVITY_LIMIT ? (
              <TouchableOpacity
                style={styles.showMoreButton}
                onPress={() => setShowAllAlerts((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={
                  showAllAlerts ? "Show fewer activity alerts" : "Show all activity alerts"
                }
              >
                <Text style={styles.showMoreButtonText}>
                  {showAllAlerts ? "SHOW LESS" : `SHOW ALL ${liveAlerts.length} ALERTS`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </FadeInView>

        {!showAllMissionLogs ? (
          <FadeInView delay={210}>
            <View style={styles.logSection}>
              <View style={styles.logHeader}>
                <View style={styles.logTitleWrap}>
                  <Ionicons name="time-outline" size={18} color="#4b8dff" />
                  <Text style={styles.logTitle}>MISSION LOG HISTORY</Text>
                </View>
                <TouchableOpacity
                  style={styles.historyToggleButton}
                  onPress={() => setMissionHistoryOpen((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    missionHistoryOpen ? "Collapse mission log history" : "Expand mission log history"
                  }
                >
                  <Ionicons
                    name={missionHistoryOpen ? "chevron-down" : "chevron-forward"}
                    size={18}
                    color="#4b8dff"
                  />
                </TouchableOpacity>
              </View>
              {missionHistoryOpen ? (
                <>
                  <View style={styles.historyActionsRow}>
                    <TouchableOpacity
                      onPress={handleClearMissionLogHistory}
                      disabled={clearingMissionLogHistory || missionLogHistory.length === 0}
                      accessibilityRole="button"
                      accessibilityLabel="Clear mission log history"
                    >
                      <Text
                        style={[
                          styles.logClearButton,
                          (clearingMissionLogHistory || missionLogHistory.length === 0) &&
                            styles.logClearButtonDisabled,
                        ]}
                      >
                        {clearingMissionLogHistory ? "CLEARING..." : "CLEAR HISTORY"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {missionLogHistory.length === 0 ? (
                    <View style={[styles.logCard, styles.emptyRow]}>
                      <Text style={styles.emptyRowText}>
                        No older rover mission history yet.
                      </Text>
                    </View>
                  ) : (
                    missionLogHistory.map((item) => (
                      <View style={styles.logCard} key={`history-${item.id}`}>
                        <View style={styles.logTimeWrap}>
                          {item.hasElapsedTime ? (
                            <Text style={styles.logTime}>{item.elapsedLabel}</Text>
                          ) : null}
                          <Text style={styles.logClockTime}>{item.clockTime}</Text>
                        </View>
                        <View style={styles.logContent}>
                          <View style={styles.logRowTop}>
                            <Text style={styles.logEntryTitle}>{item.title}</Text>
                            <Ionicons name={item.icon} size={18} color={item.iconColor} />
                          </View>
                          <Text style={styles.logEntryBody}>{item.body}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </>
              ) : null}
            </View>
          </FadeInView>
        ) : null}

        {!showAllAlerts ? (
          <FadeInView delay={240}>
            <View style={styles.alertsPanel}>
              <View style={styles.alertsPanelHeader}>
                <View style={styles.alertsPanelTitleWrap}>
                  <Ionicons name="archive-outline" size={18} color="#f3b234" />
                  <Text style={styles.alertsPanelTitle}>ACTIVITY ALERT HISTORY</Text>
                </View>
                <TouchableOpacity
                  style={styles.historyToggleButton}
                  onPress={() => setAlertHistoryOpen((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    alertHistoryOpen ? "Collapse activity alert history" : "Expand activity alert history"
                  }
                >
                  <Ionicons
                    name={alertHistoryOpen ? "chevron-down" : "chevron-forward"}
                    size={18}
                    color="#f3b234"
                  />
                </TouchableOpacity>
              </View>
              {alertHistoryOpen ? (
                <>
                  <View style={styles.historyActionsRow}>
                    <TouchableOpacity
                      onPress={handleClearAlertHistory}
                      disabled={clearingAlertHistory || alertHistory.length === 0}
                      accessibilityRole="button"
                      accessibilityLabel="Clear activity alert history"
                    >
                      <Text
                        style={[
                          styles.alertClearButton,
                          (clearingAlertHistory || alertHistory.length === 0) &&
                            styles.alertClearButtonDisabled,
                        ]}
                      >
                        {clearingAlertHistory ? "CLEARING..." : "CLEAR HISTORY"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {alertHistory.length === 0 ? (
                    <View style={[styles.alertTile, styles.emptyAlertTile]}>
                      <Text style={styles.emptyAlertTitle}>No older activity alert history yet</Text>
                      <Text style={styles.emptyAlertBody}>
                        Older rover alert records will appear here after more than five alerts have been logged.
                      </Text>
                    </View>
                  ) : (
                    alertHistory.map((alert) => (
                      <View
                        key={`history-${alert.id}`}
                        style={[styles.alertTile, { borderColor: `${alert.accent}55` }]}
                      >
                        <View style={styles.alertTileHeader}>
                          <Text style={[styles.alertLevel, { color: alert.accent }]}>{alert.level}</Text>
                          <Text style={styles.alertAge}>{alert.age}</Text>
                        </View>
                        <Text style={styles.alertTitle}>{alert.title}</Text>
                        <Text style={styles.alertBody}>{alert.body}</Text>
                      </View>
                    ))
                  )}
                </>
              ) : null}
            </View>
          </FadeInView>
        ) : null}
      </ScrollView>
      {notificationsSheet}
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AppTheme["colors"], fontScale = 1, isDark = true) {
  const typography = getAccessibleAppTypography(width, fontScale);
  const layout = getLayoutProfile(width);
  const largeText = fontScale >= 1.15;
  const xLargeText = fontScale >= 1.28;
  const { compact } = typography;
  const contentPadding = layout.isSmall ? APP_SPACING.md : layout.isLarge ? APP_SPACING.xxl : APP_SPACING.lg;
  const sectionGap = layout.isSmall ? APP_SPACING.sm : APP_SPACING.md;
  const cardPadding = layout.isSmall ? APP_SPACING.sm : APP_SPACING.md;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.screenBg,
    },
    header: {
      height: largeText ? 72 : 64,
      paddingHorizontal: APP_SPACING.xxxl,
      backgroundColor: colors.headerBg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.headerBorder,
    },
    headerTitle: {
      fontSize: typography.headerTitle,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    headerIcons: {
      flexDirection: "row",
      gap: APP_SPACING.xl,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: APP_RADII.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      width: "100%",
      maxWidth: layout.isLarge ? 980 : 560,
      alignSelf: "center",
      padding: contentPadding,
    },
    progressCard: {
      marginTop: layout.isSmall ? APP_SPACING.md : APP_SPACING.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      paddingHorizontal: cardPadding,
      paddingVertical: APP_SPACING.md,
    },
    progressHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: APP_SPACING.md,
    },
    progressLabel: {
      fontSize: typography.chipLabel,
      color: colors.textMuted,
      fontWeight: "700",
      letterSpacing: 1,
    },
    progressValue: {
      fontSize: Math.max(34, typography.sectionTitle + 8),
      color: "#3b82f6",
      fontWeight: "700",
    },
    progressTrack: {
      flexDirection: "row",
      gap: 4,
      height: 14,
      borderRadius: 999,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: 4,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    progressSegment: {
      flex: 1,
      height: 8,
      borderRadius: 999,
    },
    progressSegmentFilled: {
      backgroundColor: "#3b82f6",
    },
    progressSegmentEmpty: {
      backgroundColor: "#223149",
    },
    logSection: {
      marginTop: sectionGap,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingTop: APP_SPACING.md,
      paddingBottom: APP_SPACING.sm,
    },
    logHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    logHeaderActions: {
      alignItems: "flex-end",
      gap: 4,
      flexShrink: 0,
      minWidth: layout.isSmall ? 110 : 132,
    },
    logTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
      flex: 1,
      minWidth: 0,
      paddingRight: APP_SPACING.xs,
    },
    logTitle: {
      color: colors.textPrimary,
      fontSize: typography.sectionTitle,
      fontWeight: "800",
      flexShrink: 1,
    },
    logMeta: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: 0.6,
      textAlign: "right",
    },
    logClearButton: {
      color: "#4b8dff",
      fontSize: typography.chipLabel,
      fontWeight: "800",
      letterSpacing: 0.6,
      textAlign: "right",
    },
    logClearButtonDisabled: {
      color: colors.textMuted,
    },
    historyToggleButton: {
      width: 36,
      height: 36,
      borderRadius: APP_RADII.md,
      alignItems: "center",
      justifyContent: "center",
    },
    historyActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      marginTop: -2,
      marginBottom: APP_SPACING.md,
    },
    showMoreButton: {
      minHeight: 42,
      marginTop: 2,
      marginBottom: APP_SPACING.sm,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.md,
      backgroundColor: colors.cardAltBg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: APP_SPACING.md,
    },
    showMoreButtonText: {
      color: "#4b8dff",
      fontSize: typography.chipLabel,
      fontWeight: "800",
      letterSpacing: 0.8,
    },
    logCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: APP_SPACING.md,
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      marginBottom: APP_SPACING.md,
    },
    logTimeWrap: {
      width: 72,
      paddingTop: 2,
      gap: 4,
    },
    logTime: {
      color: "#4b8dff",
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    logClockTime: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "600",
    },
    logContent: {
      flex: 1,
    },
    logRowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: APP_SPACING.sm,
      marginBottom: 4,
    },
    logEntryTitle: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle + 2,
      fontWeight: "800",
      flex: 1,
    },
    logEntryBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.compact ? 21 : 24,
    },
    emptyRow: {
      justifyContent: "center",
      minHeight: 46,
    },
    emptyRowText: {
      color: colors.textMuted,
      fontSize: typography.body,
      textAlign: "center",
      flex: 1,
    },
    searchPanel: {
      marginTop: layout.isSmall ? APP_SPACING.md : APP_SPACING.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      paddingHorizontal: cardPadding,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    searchHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    searchTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    searchClearText: {
      color: "#4b8dff",
      fontSize: typography.chipLabel,
      fontWeight: "700",
    },
    searchInputWrap: {
      height: 46,
      borderWidth: 1,
      borderColor: colors.searchInputBorder,
      borderRadius: APP_RADII.md,
      backgroundColor: colors.searchInputBg,
      paddingHorizontal: APP_SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
    },
    searchInputInline: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: typography.body,
      paddingVertical: 0,
    },
    alertsPanel: {
      marginTop: sectionGap,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
    },
    alertsPanelHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    alertHeaderActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
      flexShrink: 1,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
    alertsPanelTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
      flex: 1,
      minWidth: 0,
      paddingRight: APP_SPACING.xs,
    },
    alertsPanelTitle: {
      color: "#f3b234",
      fontSize: typography.bodyStrong,
      fontWeight: "800",
      letterSpacing: 0.6,
      flexShrink: 1,
    },
    alertsPanelCount: {
      color: "#f3b234",
      fontSize: typography.chipLabel,
      fontWeight: "800",
      backgroundColor: isDark ? "#332913" : "#e7d6ac",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: APP_RADII.sm,
    },
    alertClearButton: {
      color: "#f3b234",
      fontSize: typography.chipLabel,
      fontWeight: "800",
      letterSpacing: 0.6,
    },
    alertClearButtonDisabled: {
      color: colors.textMuted,
    },
    alertTile: {
      borderWidth: 1,
      borderRadius: APP_RADII.lg,
      backgroundColor: isDark ? "#141b28" : colors.cardAltBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      marginBottom: APP_SPACING.sm,
    },
    alertTileHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    alertLevel: {
      fontSize: typography.chipLabel,
      fontWeight: "800",
      letterSpacing: 1,
    },
    alertAge: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "600",
    },
    alertTitle: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle,
      fontWeight: "800",
      marginBottom: 4,
    },
    alertBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.compact ? 17 : 20,
    },
    emptyAlertTile: {
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
    },
    emptyAlertTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
      marginBottom: 4,
    },
    emptyAlertBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.compact ? 17 : 20,
    },
  });
}

