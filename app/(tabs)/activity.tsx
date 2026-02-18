import { Ionicons } from "@expo/vector-icons";
import { onValue, ref } from "firebase/database";
import { useCallback, useEffect, useState } from "react";
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
import { PulsePlaceholder } from "@/components/ui/pulse-placeholder";
import { ScreenSection } from "@/components/ui/screen-section";
import { db } from "@/lib/firebase";
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
  { time: "09:00 AM", task: "System Initialization" },
  { time: "09:30 AM", task: "Pre-flight Check" },
  { time: "09:45 AM", task: "Mission Planning" },
  { time: "10:00 AM", task: "Takeoff Sequence" },
  { time: "10:30 AM", task: "Navigation Active" },
];

export default function ActivityScreen() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const typography = getAccessibleAppTypography(width, fontScale);
  const styles = createStyles(width, colors, fontScale);
  const [query, setQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [isFootageLoading, setIsFootageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [footageAvailable, setFootageAvailable] = useState(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("activity");
  const filteredTimeline = timeline.filter((item) =>
    item.task.toLowerCase().includes(query.toLowerCase().trim())
  );
  const completion = Math.round((filteredTimeline.length / timeline.length) * 100);

  useEffect(() => {
    if (!db) {
      setTelemetryError("Telemetry offline: Firebase database is not connected.");
      setFootageAvailable(false);
      setIsFootageLoading(false);
      return;
    }

    const tempRef = ref(db, "temperature_data");
    const batteryRef = ref(db, "battery_level");
    let hasTemp = false;
    let hasBattery = false;

    const updateAvailability = () => {
      const isAvailable = hasTemp || hasBattery;
      setFootageAvailable(isAvailable);
      setIsFootageLoading(false);
    };

    const unsubTemp = onValue(
      tempRef,
      (snapshot) => {
        hasTemp = snapshot.exists();
        updateAvailability();
      },
      () => {
        setTelemetryError("Telemetry stream connection lost.");
        setFootageAvailable(false);
        setIsFootageLoading(false);
      }
    );

    const unsubBattery = onValue(
      batteryRef,
      (snapshot) => {
        hasBattery = snapshot.exists();
        updateAvailability();
      },
      () => {
        setTelemetryError("Telemetry stream connection lost.");
        setFootageAvailable(false);
        setIsFootageLoading(false);
      }
    );

    return () => {
      unsubTemp();
      unsubBattery();
    };
  }, []);

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
        <Text style={styles.sectionTitle}>Drone Footage</Text>
        <Text style={styles.helperHintText}>
          Tip: Pull down to refresh the timeline and latest telemetry snapshot.
        </Text>
        {!footageAvailable ? (
          <View style={styles.offlineBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.offlineText}>
              {telemetryError ?? "Live feed unavailable. Waiting for telemetry stream."}
            </Text>
          </View>
        ) : null}

        <FadeInView delay={40}>
        <View style={styles.footageCard}>
          <View style={styles.footage}>
            {isFootageLoading ? (
              <PulsePlaceholder color={isDark ? "#ffffff16" : "#00000010"} />
            ) : null}
            <View style={styles.footageHudRow}>
              <View style={styles.hudChip}>
                <Text style={styles.hudChipText}>LIVE</Text>
              </View>
              <View style={styles.hudChip}>
                <Text style={styles.hudChipText}>HD 30 FPS</Text>
              </View>
            </View>
            <View style={styles.footageOverlay} />
            {!isFootageLoading && !footageAvailable ? (
              <View style={styles.emptyFeedOverlay}>
                <Text style={styles.emptyFeedText}>NO SIGNAL</Text>
              </View>
            ) : null}
          </View>
        </View>
        </FadeInView>

        <FadeInView delay={90} style={styles.snapshotRow}>
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>Mission Progress</Text>
            <Text style={styles.snapshotValue}>{`${completion}%`}</Text>
          </View>
          <View style={styles.snapshotCard}>
            <Text style={styles.snapshotLabel}>Events Logged</Text>
            <Text style={styles.snapshotValue}>{String(filteredTimeline.length)}</Text>
          </View>
        </FadeInView>

        <FadeInView delay={130}>
        <View style={styles.tableCard}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cellText, styles.headerCell, styles.timeCell]}>Time</Text>
            <Text style={[styles.cellText, styles.headerCell, styles.taskCell]}>Task</Text>
          </View>
          {filteredTimeline.map((item, index) => (
            <View
              style={[styles.tableRow, index % 2 === 1 && styles.altTableRow]}
              key={`${item.time}-${item.task}`}
            >
              <Text style={[styles.cellText, styles.timeCell]}>{item.time}</Text>
              <Text style={[styles.cellText, styles.taskCell]}>{item.task}</Text>
            </View>
          ))}
          {filteredTimeline.length === 0 ? (
            <View style={[styles.tableRow, styles.emptyRow]}>
              <Text style={styles.emptyRowText}>No activity records for this filter.</Text>
            </View>
          ) : null}
        </View>
        </FadeInView>

        <FadeInView delay={170}>
          <ScreenSection
            title="Activity Alerts"
            titleColor={colors.textPrimary}
            titleSize={typography.cardTitle}
            borderColor={colors.cardBorder}
            backgroundColor={colors.cardBg}
            style={styles.alertsCard}
          >
            <View style={styles.alertRow}>
              <Ionicons name="alert-circle-outline" size={18} color="#f3a73a" />
              <Text style={styles.alertText}>Crosswind spike detected at 10:20 AM. Stabilization engaged.</Text>
            </View>
            <View style={styles.alertRow}>
              <Ionicons name="information-circle-outline" size={18} color="#66a6ff" />
              <Text style={styles.alertText}>Telemetry stream healthy. No packet loss in the last 5 minutes.</Text>
            </View>
          </ScreenSection>
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
                    key={`search-${item.time}-${item.task}`}
                    style={styles.searchResultRow}
                    onPress={() => setSearchVisible(false)}
                  >
                    <Text style={styles.searchResultTask}>{item.task}</Text>
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

function createStyles(width: number, colors: AppTheme["colors"], fontScale = 1) {
  const typography = getAccessibleAppTypography(width, fontScale);
  const layout = getLayoutProfile(width);
  const largeText = fontScale >= 1.15;
  const xLargeText = fontScale >= 1.28;
  const { compact, regular } = typography;
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
    sectionTitle: {
      fontSize: typography.sectionTitle,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    helperHintText: {
      marginTop: APP_SPACING.xs,
      color: colors.textMuted,
      fontSize: typography.small,
      lineHeight: typography.compact ? 15 : 17,
      marginBottom: APP_SPACING.xs,
    },
    footageCard: {
      marginTop: sectionGap,
      borderRadius: 3,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    footage: {
      height: layout.isSmall ? 166 : layout.isLarge ? 246 : regular ? 198 : 220,
      width: "100%",
      backgroundColor: colors.mapCardBg,
      justifyContent: "flex-end",
    },
    emptyFeedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyFeedText: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle,
      fontWeight: "700",
      letterSpacing: 1,
    },
    footageOverlay: {
      height: "45%",
      backgroundColor: "rgba(28, 62, 24, 0.35)",
    },
    footageHudRow: {
      position: "absolute",
      top: APP_SPACING.sm,
      right: APP_SPACING.sm,
      flexDirection: "row",
      gap: APP_SPACING.xs,
      zIndex: 3,
    },
    hudChip: {
      borderRadius: APP_RADII.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.noticeBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.xs,
    },
    hudChipText: {
      color: colors.onAccent,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    offlineBanner: {
      marginTop: APP_SPACING.sm,
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.xs,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.md,
      backgroundColor: colors.cardBg,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.xs,
    },
    offlineText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "600",
    },
    tableCard: {
      marginTop: sectionGap,
      borderWidth: 1,
      borderColor: colors.tableHeaderBorder,
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardAltBg,
      overflow: "hidden",
      paddingVertical: 6,
    },
    snapshotRow: {
      marginTop: sectionGap,
      flexDirection: "row",
      gap: compact ? APP_SPACING.sm : APP_SPACING.md,
    },
    snapshotCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.lg,
      backgroundColor: colors.cardBg,
      paddingHorizontal: cardPadding,
      paddingVertical: cardPadding,
    },
    snapshotLabel: {
      fontSize: typography.cardTitle,
      color: colors.textMuted,
      fontWeight: "600",
      marginBottom: APP_SPACING.xs,
    },
    snapshotValue: {
      fontSize: typography.sectionTitle,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    tableHeader: {
      borderBottomWidth: 1,
      borderBottomColor: colors.tableHeaderBorder,
      marginBottom: 2,
    },
    tableRow: {
      flexDirection: "row",
      paddingHorizontal: cardPadding,
      paddingVertical: xLargeText ? 12 : largeText ? 10 : compact ? 7 : 9,
    },
    altTableRow: {
      backgroundColor: `${colors.cardBg}cc`,
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
    headerCell: {
      fontWeight: "700",
      fontSize: typography.tableHeader,
      color: colors.textPrimary,
    },
    cellText: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: xLargeText ? typography.body + 8 : undefined,
    },
    timeCell: {
      width: xLargeText ? "34%" : "28%",
    },
    taskCell: {
      width: xLargeText ? "66%" : "72%",
      paddingLeft: 8,
      flexShrink: 1,
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
    alertsCard: {
      marginTop: sectionGap,
      borderWidth: 0,
      borderColor: "transparent",
      borderRadius: APP_RADII.lg,
      backgroundColor: "transparent",
      paddingHorizontal: 0,
      paddingVertical: 0,
      gap: compact ? APP_SPACING.xs : APP_SPACING.sm,
    },
    alertRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: APP_SPACING.sm,
    },
    alertText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.compact ? 17 : 20,
    },
  });
}
