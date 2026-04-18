import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import {
  subscribeLiveMissionSnapshot,
  type LiveMissionSnapshot,
} from "@/lib/robot-mission-control";
import { fetchActivityFeed, type ActivityFeedItem } from "@/lib/supabase-zone-averages";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  getLayoutProfile,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Unknown time";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCategoryLabel(category: ActivityFeedItem["category"]) {
  return category.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());
}

function getSeverityPresentation(severity: ActivityFeedItem["severity"]) {
  if (severity === "critical") {
    return { color: "#ef5350", icon: "warning" as const, label: "Critical" };
  }
  if (severity === "error") {
    return { color: "#ef5350", icon: "close-circle" as const, label: "Error" };
  }
  if (severity === "warning") {
    return { color: "#f2b844", icon: "alert-circle" as const, label: "Warning" };
  }
  return { color: "#4b8dff", icon: "information-circle" as const, label: "Info" };
}

function getSourceLabel(source: ActivityFeedItem["source"]) {
  return source === "mission_log" ? "Mission Log" : "Activity Alert";
}

function snapshotSummary(snapshot: LiveMissionSnapshot | null) {
  if (!snapshot) {
    return "Waiting for live rover mission state.";
  }

  const normalizedState = (snapshot.overallState ?? "idle").replace(/_/g, " ").trim();
  const statusLabel = normalizedState
    ? normalizedState.replace(/\b\w/g, (value) => value.toUpperCase())
    : "Idle";

  if (snapshot.missionActive) {
    return `Live rover mission state: ${statusLabel}. Saved activity history below comes from Supabase.`;
  }

  return `Live rover mission state: ${statusLabel}. The feed below shows saved mission logs and activity alerts from Supabase.`;
}

export default function ActivityScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const styles = createStyles(width, colors, fontScale, isDark);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("activity");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveMissionSnapshot, setLiveMissionSnapshot] = useState<LiveMissionSnapshot | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);

  const filteredFeed = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return activityFeed;
    }

    return activityFeed.filter((item) =>
      `${item.message} ${item.category} ${item.zone ?? ""} ${item.severity ?? ""}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [activityFeed, query]);

  const missionLogCount = useMemo(
    () => activityFeed.filter((item) => item.source === "mission_log").length,
    [activityFeed],
  );
  const activityAlertCount = useMemo(
    () => activityFeed.filter((item) => item.source === "activity_alert").length,
    [activityFeed],
  );

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const items = await fetchActivityFeed();
      setActivityFeed(items);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load the unified activity feed from Supabase.";
      setLoadError(message);
      setActivityFeed([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    try {
      return subscribeLiveMissionSnapshot((snapshot) => {
        setLiveMissionSnapshot(snapshot);
      });
    } catch (error) {
      console.warn("Failed to subscribe to live mission snapshot", error);
      return undefined;
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadFeed().finally(() => {
      setTimeout(() => setRefreshing(false), 350);
    });
  }, [loadFeed]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <TouchableOpacity
          onPress={openNotifications}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
        >
          <Ionicons name="notifications" size={22} color={colors.icon} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: APP_SPACING.xxl + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.icon} />
        }
        showsVerticalScrollIndicator={false}
      >
        <FadeInView delay={40}>
          <View style={styles.liveCard}>
            <Text style={styles.liveCardLabel}>Live Rover Context</Text>
            <Text style={styles.liveCardBody}>{snapshotSummary(liveMissionSnapshot)}</Text>
          </View>
        </FadeInView>

        <FadeInView delay={90}>
          <View style={styles.rollupCard}>
            <View style={styles.rollupMetric}>
              <Text style={styles.rollupLabel}>Mission Logs</Text>
              <Text style={styles.rollupValue}>{missionLogCount}</Text>
            </View>
            <View style={styles.rollupMetric}>
              <Text style={styles.rollupLabel}>Activity Alerts</Text>
              <Text style={styles.rollupValue}>{activityAlertCount}</Text>
            </View>
            <View style={styles.rollupMetric}>
              <Text style={styles.rollupLabel}>Combined Feed</Text>
              <Text style={styles.rollupValue}>{activityFeed.length}</Text>
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={120}>
          <View style={styles.searchPanel}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Unified Supabase Feed</Text>
              {query ? (
                <TouchableOpacity
                  onPress={() => setQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear activity search"
                >
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search messages, zones, categories"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
              />
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={160}>
          <View style={styles.feedCard}>
            <Text style={styles.feedTitle}>Latest Activity</Text>
            <Text style={styles.feedBody}>
              Mission logs and activity alerts are merged here, normalized by category, and sorted
              newest first.
            </Text>

            {loadError ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Feed load failed</Text>
                <Text style={styles.emptyBody}>{loadError}</Text>
              </View>
            ) : null}

            {!loadError && loading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Loading activity feed</Text>
                <Text style={styles.emptyBody}>
                  Fetching saved mission logs and activity alerts from Supabase.
                </Text>
              </View>
            ) : null}

            {!loadError && !loading && activityFeed.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No combined activity yet</Text>
                <Text style={styles.emptyBody}>
                  There are no saved mission logs or activity alerts in Supabase yet.
                </Text>
              </View>
            ) : null}

            {!loadError && !loading && activityFeed.length > 0 && filteredFeed.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No matching activity</Text>
                <Text style={styles.emptyBody}>
                  The current search does not match any saved mission logs or activity alerts.
                </Text>
              </View>
            ) : null}

            {!loadError && !loading && filteredFeed.length > 0
              ? filteredFeed.map((item) => {
                  const severity = getSeverityPresentation(item.severity);
                  return (
                    <View
                      key={item.id}
                      style={[styles.feedRow, { borderColor: `${severity.color}55` }]}
                    >
                      <View style={styles.feedRowHeader}>
                        <View style={styles.feedRowHeaderLeft}>
                          <Ionicons name={severity.icon} size={18} color={severity.color} />
                          <Text style={styles.feedRowTitle}>{getSourceLabel(item.source)}</Text>
                        </View>
                        <Text style={styles.feedRowTime}>{formatTimestamp(item.timestamp)}</Text>
                      </View>

                      <View style={styles.tagRow}>
                        <View style={[styles.tagChip, { borderColor: `${severity.color}55` }]}>
                          <Text style={[styles.tagChipText, { color: severity.color }]}>
                            {severity.label}
                          </Text>
                        </View>
                        <View style={styles.tagChip}>
                          <Text style={styles.tagChipTextNeutral}>
                            {formatCategoryLabel(item.category)}
                          </Text>
                        </View>
                        {item.zone ? (
                          <View style={styles.tagChip}>
                            <Text style={styles.tagChipTextNeutral}>{item.zone}</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.feedMessage}>{item.message}</Text>
                    </View>
                  );
                })
              : null}
          </View>
        </FadeInView>
      </ScrollView>
      {notificationsSheet}
    </SafeAreaView>
  );
}

function createStyles(
  width: number,
  colors: AppTheme["colors"],
  fontScale = 1,
  isDark = true,
) {
  const typography = getAccessibleAppTypography(width, fontScale);
  const layout = getLayoutProfile(width);
  const largeText = fontScale >= 1.15;
  const { compact } = typography;

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
      paddingHorizontal: layout.isSmall ? APP_SPACING.md : APP_SPACING.xl,
      paddingTop: APP_SPACING.md,
      gap: APP_SPACING.md,
    },
    liveCard: {
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.xs,
    },
    liveCardLabel: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle,
      fontWeight: "700",
    },
    liveCardBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    rollupCard: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.sm,
    },
    rollupMetric: {
      flex: 1,
      minWidth: 100,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.sm,
      gap: 4,
    },
    rollupLabel: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    rollupValue: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "800",
    },
    searchPanel: {
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
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
    clearText: {
      color: "#4b8dff",
      fontSize: typography.chipLabel,
      fontWeight: "700",
    },
    searchInputWrap: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: colors.searchInputBorder,
      borderRadius: APP_RADII.md,
      backgroundColor: colors.searchInputBg,
      paddingHorizontal: APP_SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: typography.body,
      paddingVertical: 0,
    },
    feedCard: {
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    feedTitle: {
      color: colors.textPrimary,
      fontSize: typography.sectionTitle,
      fontWeight: "700",
    },
    feedBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    feedRow: {
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      backgroundColor: isDark ? "#141b28" : colors.cardAltBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.xs,
    },
    feedRowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: APP_SPACING.sm,
    },
    feedRowHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.xs,
      flex: 1,
    },
    feedRowTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    feedRowTime: {
      color: colors.textMuted,
      fontSize: typography.small,
      fontWeight: "600",
      textAlign: "right",
    },
    tagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: APP_SPACING.xs,
    },
    tagChip: {
      borderRadius: APP_RADII.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.xs,
      paddingVertical: 4,
    },
    tagChipText: {
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    tagChipTextNeutral: {
      color: colors.textSecondary,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    feedMessage: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
    emptyCard: {
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.xs,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    emptyBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: compact ? 18 : 20,
    },
  });
}
