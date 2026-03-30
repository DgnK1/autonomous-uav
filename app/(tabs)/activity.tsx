import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
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
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  getLayoutProfile,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";

const timeline = [
  {
    time: "14:22:05",
    title: "MISSION FINALIZED",
    body: "UGV successfully returned to base station. Auto-docking procedure completed.",
    icon: "checkmark-circle" as const,
    iconColor: "#38d27a",
  },
  {
    time: "14:15:30",
    title: "IRRIGATION PASS COMPLETED",
    body: "Sector 09 coverage achieved. Water delivery cycle completed without interruption.",
    icon: "water" as const,
    iconColor: "#4b8dff",
  },
  {
    time: "13:45:12",
    title: "THERMAL ANALYSIS",
    body: "Surface temperature scan completed for irrigation decision support.",
    icon: "radio" as const,
    iconColor: "#4b8dff",
  },
  {
    time: "13:10:44",
    title: "ROUTE PLANNING",
    body: "Optimal ground path generated while avoiding rough terrain zones.",
    icon: "map" as const,
    iconColor: "#94a3b8",
  },
  {
    time: "13:00:01",
    title: "SYSTEM INITIALIZATION",
    body: "Drive, sensor, and control modules completed startup validation.",
    icon: "settings" as const,
    iconColor: "#94a3b8",
  },
];

const activityAlerts = [
  {
    level: "WARNING",
    title: "Wheel Slip Detected",
    age: "2m ago",
    body: "Reduced traction detected on wet soil. Speed limiter applied for stability.",
    accent: "#f3b234",
  },
  {
    level: "CRITICAL",
    title: "Signal Degradation",
    age: "12m ago",
    body: "Control link quality dropped below threshold. Switched to backup communication path.",
    accent: "#ef5350",
  },
] as const;

export default function ActivityScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const typography = getAccessibleAppTypography(width, fontScale);
  const styles = createStyles(width, colors, fontScale, isDark);
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("activity");
  const filteredTimeline = timeline.filter((item) =>
    `${item.title} ${item.body}`.toLowerCase().includes(query.toLowerCase().trim())
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
            <View style={styles.logCard} key={`${item.time}-${item.title}`}>
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
              <Text style={styles.emptyRowText}>No activity records for this filter.</Text>
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
                {String(activityAlerts.length).padStart(2, "0")}
              </Text>
            </View>
            {activityAlerts.map((alert) => (
              <View
                key={`${alert.level}-${alert.title}`}
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
  });
}
