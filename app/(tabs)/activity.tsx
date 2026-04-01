import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
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
  time: string;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  timestampMs: number;
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

function formatLogTime(timestampMs: number) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return "--:--:--";
  }

  const totalSeconds = Math.floor(timestampMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
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
  const parts: string[] = [];

  if (typeof source.device_id === "string" && source.device_id.trim()) {
    parts.push(`Source: ${source.device_id}`);
  }

  if (typeof source.zoneIndex === "number" && Number.isFinite(source.zoneIndex)) {
    parts.push(`Zone ${source.zoneIndex + 1}`);
  }

  if (typeof source.passCount === "number" && Number.isFinite(source.passCount)) {
    parts.push(`Pass ${source.passCount}`);
  }

  const latitude = formatCoordinate(source.latitude);
  const longitude = formatCoordinate(source.longitude);
  if (latitude && longitude) {
    parts.push(`${latitude}, ${longitude}`);
  }

  return parts.length > 0 ? parts.join(" - ") : "Live mission event from the robot.";
}

function parseMissionLogs(value: unknown): MissionLogItem[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const results: MissionLogItem[] = [];

  Object.entries(value as Record<string, unknown>).forEach(([id, item]) => {
      if (id.startsWith("sample_")) {
        return;
      }

      if (typeof item !== "object" || item === null) {
        return;
      }

      const source = item as Record<string, unknown>;
      const title = typeof source.message === "string" ? source.message : "";
      if (!title.trim()) {
        return;
      }

      const type = typeof source.type === "string" ? source.type : "info";
      const timestampMs =
        typeof source.timestamp_ms === "number" && Number.isFinite(source.timestamp_ms)
          ? source.timestamp_ms
          : 0;
      const presentation = getMissionLogPresentation(type, title);

      results.push({
        id,
        time: formatLogTime(timestampMs),
        title: title.toUpperCase(),
        body: buildMissionLogBody(source),
        icon: presentation.icon,
        iconColor: presentation.iconColor,
        timestampMs,
      });
    });

  return results.sort((a, b) => b.timestampMs - a.timestampMs);
}

function parseActivityAlerts(value: unknown): ActivityAlertItem[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const results: ActivityAlertItem[] = [];

  Object.entries(value as Record<string, unknown>).forEach(([id, item]) => {
      if (id.startsWith("sample_")) {
        return;
      }

      if (typeof item !== "object" || item === null) {
        return;
      }

      const source = item as Record<string, unknown>;
      const body = typeof source.message === "string" ? source.message : "";
      if (!body.trim()) {
        return;
      }

      const severity = typeof source.severity === "string" ? source.severity : "info";
      const timestampMs =
        typeof source.timestamp_ms === "number" && Number.isFinite(source.timestamp_ms)
          ? source.timestamp_ms
          : 0;

      results.push({
        id,
        level: severity.toUpperCase(),
        title:
          severity.toLowerCase() === "critical"
            ? "Critical Robot Alert"
            : severity.toLowerCase() === "warning"
              ? "Robot Warning"
              : "Robot Notice",
        age: formatAlertAge(timestampMs),
        body,
        accent: getAlertAccent(severity),
        timestampMs,
      });
    });

  return results.sort((a, b) => b.timestampMs - a.timestampMs);
}

export default function ActivityScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const typography = getAccessibleAppTypography(width, fontScale);
  const styles = createStyles(width, colors, fontScale, isDark);
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [missionLogs, setMissionLogs] = useState<MissionLogItem[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<ActivityAlertItem[]>([]);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("activity");
  const filteredTimeline = useMemo(
    () =>
      missionLogs.filter((item) =>
        `${item.title} ${item.body}`.toLowerCase().includes(query.toLowerCase().trim()),
      ),
    [missionLogs, query],
  );
  const completion = 84;
  const completionSegments = 10;
  const filledSegments = Math.max(
    0,
    Math.min(completionSegments, Math.round((completion / 100) * completionSegments)),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 750);
  }, []);

  useEffect(() => {
    if (!db || firebaseConfigError) {
      return;
    }

    const missionLogsRef = ref(db, "missionLogs");
    const activityAlertsRef = ref(db, "activityAlerts");

    const unsubscribeLogs = onValue(missionLogsRef, (snapshot) => {
      setMissionLogs(parseMissionLogs(snapshot.val()));
    });

    const unsubscribeAlerts = onValue(activityAlertsRef, (snapshot) => {
      setLiveAlerts(parseActivityAlerts(snapshot.val()));
    });

    return () => {
      unsubscribeLogs();
      unsubscribeAlerts();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            onPress={() => setSearchVisible(true)}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Search activity tasks"
          >
            <Ionicons name="search" size={22} color={colors.icon} />
          </TouchableOpacity>
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
        <FadeInView delay={90}>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>TOTAL COMPLETION</Text>
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
            <Text style={styles.logMeta}>LIVE UPDATES</Text>
          </View>
          {filteredTimeline.map((item) => (
            <View style={styles.logCard} key={item.id}>
              <Text style={styles.logTime}>{item.time}</Text>
              <View style={styles.logContent}>
                <View style={styles.logRowTop}>
                  <Text style={styles.logEntryTitle}>{item.title}</Text>
                  <Ionicons name={item.icon} size={18} color={item.iconColor} />
                </View>
                <Text style={styles.logEntryBody}>{item.body}</Text>
              </View>
            </View>
          ))}
          {filteredTimeline.length === 0 ? (
            <View style={[styles.logCard, styles.emptyRow]}>
              <Text style={styles.emptyRowText}>
                {missionLogs.length === 0
                  ? "No mission logs yet. Mission logs will appear here after the robot starts a task and pushes entries to Firebase."
                  : "No mission logs match this search."}
              </Text>
            </View>
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
              <Text style={styles.alertsPanelCount}>
                {String(liveAlerts.length).padStart(2, "0")}
              </Text>
            </View>
            {liveAlerts.map((alert) => (
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
            {liveAlerts.length === 0 ? (
              <View style={[styles.alertTile, styles.emptyAlertTile]}>
                <Text style={styles.emptyAlertTitle}>No activity alerts yet</Text>
                <Text style={styles.emptyAlertBody}>
                  Activity alerts will show here when the robot reports warnings or critical issues
                  to Firebase, such as obstacle handling, invalid readings, or mission problems.
                </Text>
              </View>
            ) : null}
          </View>
        </FadeInView>
      </ScrollView>
      {notificationsSheet}

      <Modal visible={searchVisible} transparent animationType="fade" onRequestClose={() => setSearchVisible(false)}>
        <Pressable style={styles.searchBackdrop} onPress={() => setSearchVisible(false)}>
          <Pressable style={styles.searchCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Search Tasks</Text>
              <TouchableOpacity
                onPress={() => setSearchVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close task search"
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Type task name..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
            />
            <ScrollView style={styles.searchResultsWrap}>
              {filteredTimeline.length === 0 ? (
                <Text style={styles.noMatchesText}>No matches</Text>
              ) : (
                filteredTimeline.map((item) => (
                  <TouchableOpacity
                    key={`search-${item.time}-${item.title}`}
                    style={styles.searchResultRow}
                    onPress={() => setSearchVisible(false)}
                  >
                    <Text style={styles.searchResultTask}>{item.title}</Text>
                    <Text style={styles.searchResultTime}>{item.time}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
      backgroundColor: "#182131",
      paddingHorizontal: 4,
      alignItems: "center",
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
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: APP_SPACING.md,
    },
    logTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
    },
    logTitle: {
      color: colors.textPrimary,
      fontSize: typography.sectionTitle,
      fontWeight: "800",
    },
    logMeta: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: 1,
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
    logTime: {
      color: "#4b8dff",
      fontSize: typography.bodyStrong,
      fontWeight: "700",
      width: 66,
      paddingTop: 2,
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
    searchBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "center",
      paddingHorizontal: APP_SPACING.xxxl,
    },
    searchCard: {
      backgroundColor: colors.searchCardBg,
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: APP_SPACING.lg,
      maxHeight: "58%",
    },
    searchHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    searchTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    searchInput: {
      height: 44,
      borderWidth: 1,
      borderColor: colors.searchInputBorder,
      borderRadius: APP_RADII.md,
      backgroundColor: colors.searchInputBg,
      paddingHorizontal: APP_SPACING.lg,
      color: colors.textPrimary,
      marginBottom: APP_SPACING.md,
    },
    searchResultsWrap: {
      maxHeight: 240,
    },
    searchResultRow: {
      minHeight: 44,
      borderBottomWidth: 1,
      borderBottomColor: colors.tableRowBorder,
      justifyContent: "center",
    },
    searchResultTask: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "500",
    },
    searchResultTime: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    noMatchesText: {
      textAlign: "center",
      color: colors.textMuted,
      paddingVertical: 18,
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
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: APP_SPACING.md,
    },
    alertsPanelTitleWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
    },
    alertsPanelTitle: {
      color: "#f3b234",
      fontSize: typography.bodyStrong,
      fontWeight: "800",
      letterSpacing: 1,
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

