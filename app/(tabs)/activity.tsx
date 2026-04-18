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
import { formatRelativeDateTimeLabelPH } from "@/lib/time";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  getLayoutProfile,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";

const SESSION_GAP_MS = 90 * 60 * 1000;
const HISTORY_PREVIEW_LIMIT = 5;

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

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSessionResetMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("booted and idle");
}

function splitActivitySession(items: ActivityFeedItem[]) {
  if (items.length === 0) {
    return {
      currentItems: [] as ActivityFeedItem[],
      historyItems: [] as ActivityFeedItem[],
    };
  }

  let boundaryIndex = items.length;

  for (let index = 0; index < items.length - 1; index += 1) {
    const currentTimestamp = parseTimestamp(items[index]?.timestamp);
    const nextTimestamp = parseTimestamp(items[index + 1]?.timestamp);
    const hasLargeGap =
      currentTimestamp > 0 &&
      nextTimestamp > 0 &&
      currentTimestamp - nextTimestamp > SESSION_GAP_MS;

    if (hasLargeGap || isSessionResetMessage(items[index + 1]?.message ?? "")) {
      boundaryIndex = index + 1;
      break;
    }
  }

  return {
    currentItems: items.slice(0, boundaryIndex),
    historyItems: items.slice(boundaryIndex),
  };
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
    return `Live rover mission state: ${statusLabel}. Current mission cards show the active session, while history cards keep older Supabase activity.`;
  }

  return `Live rover mission state: ${statusLabel}. The cards below separate the latest mission session from older Supabase history.`;
}

function ActivityItemRow({
  item,
  styles,
}: {
  item: ActivityFeedItem;
  styles: ReturnType<typeof createStyles>;
}) {
  const severity = getSeverityPresentation(item.severity);

  return (
    <View key={item.id} style={[styles.feedRow, { borderColor: `${severity.color}55` }]}>
      <View style={styles.feedRowHeader}>
        <View style={styles.feedRowHeaderLeft}>
          <Ionicons name={severity.icon} size={18} color={severity.color} />
          <Text style={styles.feedRowTitle}>{getSourceLabel(item.source)}</Text>
        </View>
        <Text style={styles.feedRowTime}>
          {item.timestamp ? formatRelativeDateTimeLabelPH(item.timestamp) : "Unknown time"}
        </Text>
      </View>

      <View style={styles.tagRow}>
        <View style={[styles.tagChip, { borderColor: `${severity.color}55` }]}>
          <Text style={[styles.tagChipText, { color: severity.color }]}>{severity.label}</Text>
        </View>
        <View style={styles.tagChip}>
          <Text style={styles.tagChipTextNeutral}>{formatCategoryLabel(item.category)}</Text>
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
}

function ActivitySection({
  title,
  subtitle,
  icon,
  iconColor,
  items,
  emptyTitle,
  emptyBody,
  styles,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  items: ActivityFeedItem[];
  emptyTitle: string;
  emptyBody: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.feedCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name={icon} size={18} color={iconColor} />
          <Text style={styles.feedTitle}>{title}</Text>
        </View>
        <Text style={styles.sectionCount}>{String(items.length).padStart(2, "0")}</Text>
      </View>
      {subtitle ? <Text style={styles.feedBody}>{subtitle}</Text> : null}

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyBody}>{emptyBody}</Text>
        </View>
      ) : (
        items.map((item) => <ActivityItemRow key={item.id} item={item} styles={styles} />)
      )}
    </View>
  );
}

function HistorySection({
  title,
  icon,
  iconColor,
  items,
  expanded,
  onToggle,
  emptyTitle,
  emptyBody,
  styles,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  items: ActivityFeedItem[];
  expanded: boolean;
  onToggle: () => void;
  emptyTitle: string;
  emptyBody: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const displayedItems = expanded ? items : items.slice(0, HISTORY_PREVIEW_LIMIT);

  return (
    <View style={styles.historyCard}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={expanded ? `Collapse ${title}` : `Expand ${title}`}
      >
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name={icon} size={18} color={iconColor} />
          <Text style={styles.feedTitle}>{title}</Text>
        </View>
        <View style={styles.sectionHeaderRight}>
          <Text style={styles.sectionCount}>{String(items.length).padStart(2, "0")}</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={iconColor}
          />
        </View>
      </TouchableOpacity>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyBody}>{emptyBody}</Text>
        </View>
      ) : (
        <>
          {displayedItems.map((item) => (
            <ActivityItemRow key={item.id} item={item} styles={styles} />
          ))}
          {items.length > HISTORY_PREVIEW_LIMIT ? (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={onToggle}
              accessibilityRole="button"
              accessibilityLabel={expanded ? `Show fewer ${title}` : `Show all ${title}`}
            >
              <Text style={styles.expandButtonText}>
                {expanded ? "Show Less" : `Show All ${items.length}`}
              </Text>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={iconColor}
              />
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
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
  const [missionHistoryExpanded, setMissionHistoryExpanded] = useState(false);
  const [alertHistoryExpanded, setAlertHistoryExpanded] = useState(false);
  const missionIsActive = useMemo(() => {
    const normalizedState = (liveMissionSnapshot?.overallState ?? "").toLowerCase().trim();

    return Boolean(
      liveMissionSnapshot?.missionActive ||
        ["queued", "pending", "running", "moving", "drilling", "sampling", "stopping"].includes(
          normalizedState,
        ),
    );
  }, [liveMissionSnapshot]);

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

  const { currentItems, historyItems } = useMemo(() => {
    if (!missionIsActive) {
      return {
        currentItems: [] as ActivityFeedItem[],
        historyItems: filteredFeed,
      };
    }

    return splitActivitySession(filteredFeed);
  }, [filteredFeed, missionIsActive]);

  const currentMissionLogs = useMemo(
    () => currentItems.filter((item) => item.source === "mission_log"),
    [currentItems],
  );
  const currentActivityAlerts = useMemo(
    () => currentItems.filter((item) => item.source === "activity_alert"),
    [currentItems],
  );
  const missionLogHistory = useMemo(
    () => historyItems.filter((item) => item.source === "mission_log"),
    [historyItems],
  );
  const activityAlertHistory = useMemo(
    () => historyItems.filter((item) => item.source === "activity_alert"),
    [historyItems],
  );

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
          : "Unable to load mission logs and activity alerts from Supabase.";
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
              <Text style={styles.searchTitle}>Search Activity</Text>
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
                placeholder="Search mission logs and alerts"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
              />
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={160}>
          <ActivitySection
            title="Mission Logs"
            subtitle="Current mission session"
            icon="list"
            iconColor="#4b8dff"
            items={currentMissionLogs}
            emptyTitle="No mission logs yet"
            emptyBody="Mission logs appear here only while the rover mission is active. When the mission is interrupted, completed, or returns to a zone, those entries move into Mission Log History."
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={200}>
          <ActivitySection
            title="Activity Alerts"
            subtitle="Current mission session"
            icon="warning"
            iconColor="#f2b844"
            items={currentActivityAlerts}
            emptyTitle="No activity alerts yet"
            emptyBody="Activity alerts appear here only while the rover mission is active. When the mission is no longer active, those alerts move into Activity Alert History."
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={240}>
          <HistorySection
            title="Mission Log History"
            icon="time-outline"
            iconColor="#4b8dff"
            items={missionLogHistory}
            expanded={missionHistoryExpanded}
            onToggle={() => setMissionHistoryExpanded((previous) => !previous)}
            emptyTitle="No mission log history yet"
            emptyBody="Past mission logs are kept here after the active mission session ends or is interrupted."
            styles={styles}
          />
        </FadeInView>

        <FadeInView delay={280}>
          <HistorySection
            title="Activity Alert History"
            icon="archive-outline"
            iconColor="#f2b844"
            items={activityAlertHistory}
            expanded={alertHistoryExpanded}
            onToggle={() => setAlertHistoryExpanded((previous) => !previous)}
            emptyTitle="No activity alert history yet"
            emptyBody="Past activity alerts are kept here after the active mission session ends or is interrupted."
            styles={styles}
          />
        </FadeInView>

        {loadError ? (
          <FadeInView delay={320}>
            <View style={styles.feedCard}>
              <Text style={styles.feedTitle}>Feed Load Failed</Text>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyBody}>{loadError}</Text>
              </View>
            </View>
          </FadeInView>
        ) : null}

        {!loadError && loading ? (
          <FadeInView delay={320}>
            <View style={styles.feedCard}>
              <Text style={styles.feedTitle}>Loading Activity</Text>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyBody}>
                  Fetching mission logs and activity alerts from Supabase.
                </Text>
              </View>
            </View>
          </FadeInView>
        ) : null}
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
    historyCard: {
      borderRadius: APP_RADII.xl,
      borderWidth: 1,
      borderColor: isDark ? "#465068" : "#ccd8ee",
      backgroundColor: isDark ? "#171d28" : colors.cardBg,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
      gap: APP_SPACING.sm,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: APP_SPACING.sm,
    },
    sectionHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
      flex: 1,
      minWidth: 0,
    },
    sectionHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.xs,
    },
    sectionCount: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    feedTitle: {
      color: colors.textPrimary,
      fontSize: typography.sectionTitle,
      fontWeight: "700",
      flexShrink: 1,
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
    expandButton: {
      minHeight: 42,
      borderRadius: APP_RADII.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardAltBg,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: APP_SPACING.xs,
    },
    expandButtonText: {
      color: "#4b8dff",
      fontSize: typography.chipLabel,
      fontWeight: "700",
    },
  });
}
