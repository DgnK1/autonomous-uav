import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polygon } from "../../components/map-adapter";
import { useNotificationsSheet } from "@/components/notifications-sheet";
import { FadeInView } from "@/components/ui/fade-in-view";
import { ScreenSection } from "@/components/ui/screen-section";
import { useFlightMode } from "@/lib/flight-mode";
import { buildRegionFromCoordinates } from "@/lib/map-region";
import { plotsStore, usePlotsStore } from "@/lib/plots-store";
import {
  APP_RADII,
  APP_SPACING,
  getAppTypography,
  getLayoutProfile,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { useTabSwipe } from "@/lib/ui/use-tab-swipe";

export default function ManualScreen() {
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const typography = getAppTypography(width);
  const styles = createStyles(width, colors);
  const { isManualMode } = useFlightMode();
  const { openNotifications, notificationsSheet } = useNotificationsSheet();
  const swipeHandlers = useTabSwipe("manual");
  const { plots, selectedPlotId } = usePlotsStore();
  const [refreshing, setRefreshing] = useState(false);
  const coordinates = useMemo(
    () => plots.map((plot) => ({ latitude: plot.latitude, longitude: plot.longitude })),
    [plots]
  );
  const selectedPlot = useMemo(
    () => plots.find((plot) => plot.id === selectedPlotId) ?? null,
    [plots, selectedPlotId]
  );
  const avgMoisture = useMemo(
    () => (plots.length ? plots.reduce((sum, plot) => sum + plot.moistureValue, 0) / plots.length : 0),
    [plots]
  );
  const avgTemp = useMemo(
    () =>
      plots.length ? plots.reduce((sum, plot) => sum + plot.temperatureValue, 0) / plots.length : 0,
    [plots]
  );
  const manualAlerts = useMemo(() => {
    if (plots.length === 0) {
      return ["No mapped plots found. Start a mapping run to populate manual controls."];
    }
    const alerts: string[] = [];
    if (selectedPlot && selectedPlot.moistureValue < 30) {
      alerts.push(`${selectedPlot.title} is dry. Prioritize this zone for irrigation.`);
    }
    if (selectedPlot && selectedPlot.temperatureValue > 35) {
      alerts.push(`${selectedPlot.title} has elevated temperature. Monitor drill dwell time.`);
    }
    if (alerts.length === 0) {
      alerts.push("No immediate manual-control risks detected. Continue route monitoring.");
    }
    return alerts;
  }, [plots.length, selectedPlot]);
  const hasPlots = plots.length > 0;
  const region = useMemo(() => buildRegionFromCoordinates(coordinates), [coordinates]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }, []);

  if (!isManualMode) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manual Controls</Text>
          <View style={styles.headerRight}>
            <View style={styles.modeChip}>
              <Text style={styles.modeChipText}>MANUAL</Text>
            </View>
            <TouchableOpacity onPress={openNotifications} hitSlop={10}>
              <Ionicons name="notifications" size={22} color={colors.icon} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.blockedWrap}>
          <Text style={styles.blockedTitle}>Manual Mode Required</Text>
          <Text style={styles.blockedText}>
            Switch to Manual Mode from the Home page to access this screen.
          </Text>
          <TouchableOpacity style={styles.blockedButton} onPress={() => router.back()}>
            <Text style={styles.blockedButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
        {notificationsSheet}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} {...swipeHandlers}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manual Controls</Text>
        <View style={styles.headerRight}>
          <View style={styles.modeChip}>
            <Text style={styles.modeChipText}>MANUAL</Text>
          </View>
          <TouchableOpacity onPress={openNotifications} hitSlop={10}>
            <Ionicons name="notifications" size={22} color={colors.icon} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.icon} />}
      >
        <FadeInView delay={40}>
        <View style={styles.mapFrame}>
          <MapView
            key={`${region.latitude}-${region.longitude}-${region.latitudeDelta}-${region.longitudeDelta}`}
            style={styles.map}
            initialRegion={region}
          >
            {coordinates.length >= 3 && (
              <Polygon
                coordinates={coordinates}
                fillColor="rgba(56, 132, 219, 0.2)"
                strokeColor="#2f8eff"
                strokeWidth={2}
              />
            )}
            {plots.map((plot) => (
              <Marker
                key={plot.id}
                coordinate={{ latitude: plot.latitude, longitude: plot.longitude }}
                onPress={() => plotsStore.setSelectedPlot(plot.id)}
              >
                <View style={[styles.marker, selectedPlotId === plot.id && styles.selectedMarker]}>
                  <View style={styles.markerCore} />
                </View>
              </Marker>
            ))}
          </MapView>
          <View style={styles.mapHudRow}>
            <View style={styles.hudChip}>
              <Text style={styles.hudChipText}>{`PLOT: ${selectedPlot?.title ?? "--"}`}</Text>
            </View>
            <View style={styles.hudChip}>
              <Text style={styles.hudChipText}>{selectedPlot ? "RPM 1200" : "RPM 0"}</Text>
            </View>
          </View>
          {!hasPlots ? (
            <View style={styles.emptyMapOverlay}>
              <Text style={styles.emptyMapText}>No mapped area yet</Text>
            </View>
          ) : null}
        </View>
        </FadeInView>

        {hasPlots ? (
          <FadeInView delay={90} style={styles.widgetsRow}>
            <View style={styles.widgetCard}>
              <Text style={styles.widgetLabel}>Selected Plot</Text>
              <Text style={styles.widgetValue}>{selectedPlot?.title ?? "--"}</Text>
            </View>
            <View style={styles.widgetCard}>
              <Text style={styles.widgetLabel}>Drill RPM</Text>
              <Text style={styles.widgetValue}>{selectedPlot ? "1200 RPM" : "0 RPM"}</Text>
            </View>
          </FadeInView>
        ) : (
          <FadeInView delay={90}>
            <ScreenSection
              title="No Plot Data"
              titleColor={colors.textPrimary}
              titleSize={typography.cardTitle}
              borderColor={colors.cardBorder}
              backgroundColor={colors.cardBg}
              style={styles.emptyStateCard}
            >
              <Text style={styles.emptyStateText}>
                No mapped plots available yet. Complete a mapping run from Home to unlock manual controls.
              </Text>
            </ScreenSection>
          </FadeInView>
        )}

        {hasPlots ? (
          <FadeInView delay={120} style={styles.widgetsRow}>
            <View style={styles.widgetCard}>
              <Text style={styles.widgetLabel}>Avg Moisture</Text>
              <Text style={styles.widgetValue}>{`${avgMoisture.toFixed(0)}%`}</Text>
            </View>
            <View style={styles.widgetCard}>
              <Text style={styles.widgetLabel}>Avg Temp</Text>
              <Text style={styles.widgetValue}>{`${avgTemp.toFixed(1)}°C`}</Text>
            </View>
          </FadeInView>
        ) : null}

        {hasPlots ? (
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <View style={styles.plotCell}>
                <Text style={styles.headerCell}>Plot</Text>
              </View>
              <View style={styles.moistureCell}>
                <Text style={styles.headerCell}>Moisture</Text>
              </View>
              <View style={styles.tempCell}>
                <Text style={[styles.headerCell, styles.tempText]}>Temp</Text>
              </View>
            </View>
            {plots.map((plot, index) => {
              const titleText = `Plot ${index + 1}`;
              const moistureText =
                (plot.moisture ?? "").replace(/\s+/g, " ").trim() ||
                `${Math.round(plot.moistureValue)}%`;
              const tempText =
                (plot.temperature ?? "").replace(/\s+/g, " ").trim() ||
                `${Math.round(plot.temperatureValue)}°C`;
              return (
                <Pressable
                  key={plot.id}
                  onPress={() => plotsStore.setSelectedPlot(plot.id)}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 && styles.altTableRow,
                    selectedPlotId === plot.id && styles.selectedTableRow,
                  ]}
                >
                  <View style={styles.plotCell}>
                    <Text style={styles.bodyCell} numberOfLines={1}>
                      {titleText}
                    </Text>
                  </View>
                  <View style={styles.moistureCell}>
                    <Text style={styles.bodyCell} numberOfLines={1}>
                      {moistureText}
                    </Text>
                  </View>
                  <View style={styles.tempCell}>
                    <Text style={[styles.bodyCell, styles.tempText]} numberOfLines={1}>
                      {tempText}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <FadeInView delay={190}>
          <ScreenSection
            title="Manual Alerts"
            titleColor={colors.textPrimary}
            titleSize={typography.cardTitle}
            borderColor={colors.cardBorder}
            backgroundColor={colors.cardBg}
            style={styles.alertsCard}
          >
            {manualAlerts.map((alert) => (
              <View key={alert} style={styles.alertRow}>
                <Ionicons name="alert-circle-outline" size={17} color="#f3a73a" />
                <Text style={styles.alertText}>{alert}</Text>
              </View>
            ))}
          </ScreenSection>
        </FadeInView>
      </ScrollView>
      {notificationsSheet}
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AppTheme["colors"]) {
  const typography = getAppTypography(width);
  const layout = getLayoutProfile(width);
  const { compact, regular } = typography;
  const mapHeight = layout.isSmall ? 186 : layout.isLarge ? 276 : regular ? 224 : 246;
  const horizontalInset = layout.isSmall ? APP_SPACING.md : layout.isLarge ? APP_SPACING.xxl : APP_SPACING.xl;
  const widgetPadding = layout.isSmall ? APP_SPACING.sm : APP_SPACING.md;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.screenBg,
    },
    header: {
      height: 64,
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
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
    },
    modeChip: {
      borderWidth: 1,
      borderColor: colors.summaryBorder,
      backgroundColor: colors.actionModeBg,
      borderRadius: APP_RADII.md,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.xs,
    },
    modeChipText: {
      color: colors.onAccent,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
    content: {
      width: "100%",
      maxWidth: layout.isLarge ? 980 : undefined,
      alignSelf: "center",
      paddingBottom: compact ? APP_SPACING.xl : APP_SPACING.xxl,
    },
    mapFrame: {
      height: mapHeight,
      backgroundColor: colors.mapFrameBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      position: "relative",
      overflow: "hidden",
    },
    map: {
      flex: 1,
    },
    mapHudRow: {
      position: "absolute",
      top: APP_SPACING.sm,
      right: APP_SPACING.sm,
      gap: APP_SPACING.xs,
      alignItems: "flex-end",
    },
    emptyMapOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyMapText: {
      color: colors.textPrimary,
      fontSize: typography.cardTitle,
      fontWeight: "700",
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
    marker: {
      width: compact ? 22 : 24,
      height: compact ? 22 : 24,
      borderRadius: APP_RADII.xl,
      borderWidth: 3,
      borderColor: "#1d76ce",
      backgroundColor: "#d7ecff",
      alignItems: "center",
      justifyContent: "center",
    },
    markerCore: {
      width: compact ? 7 : 8,
      height: compact ? 7 : 8,
      borderRadius: 4,
      backgroundColor: "#1d76ce",
    },
    selectedMarker: {
      backgroundColor: "#2f8eff",
      borderColor: "#ffffff",
    },
    tableContainer: {
      marginTop: APP_SPACING.md,
      width: "100%",
    },
    tableHeader: {
      minHeight: 44,
      width: "100%",
      backgroundColor: colors.tableHeaderBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.tableHeaderBorder,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: compact ? APP_SPACING.xl : APP_SPACING.xxl,
    },
    tableRow: {
      minHeight: compact ? 40 : 44,
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: compact ? 6 : 7,
      paddingHorizontal: compact ? APP_SPACING.xl : APP_SPACING.xxl,
      borderBottomWidth: 1,
      borderBottomColor: colors.tableRowBorder,
    },
    altTableRow: {
      backgroundColor: `${colors.cardBg}cc`,
    },
    selectedTableRow: {
      backgroundColor: colors.selectedRowBg,
    },
    headerCell: {
      fontSize: typography.tableHeader,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    bodyCell: {
      fontSize: typography.body,
      color: colors.textSecondary,
    },
    tempText: {
      width: "100%",
      textAlign: "right",
    },
    plotCell: {
      flex: 0.3,
      minWidth: 0,
      justifyContent: "center",
      paddingRight: APP_SPACING.xs,
      overflow: "hidden",
    },
    moistureCell: {
      flex: 0.45,
      minWidth: 0,
      justifyContent: "center",
      paddingRight: APP_SPACING.xs,
      overflow: "hidden",
    },
    tempCell: {
      flex: 0.25,
      minWidth: 0,
      justifyContent: "center",
      overflow: "hidden",
    },
    widgetsRow: {
      marginTop: APP_SPACING.md,
      paddingHorizontal: horizontalInset,
      flexDirection: "row",
      gap: compact ? APP_SPACING.sm : APP_SPACING.md,
    },
    widgetCard: {
      flex: 1,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: widgetPadding,
      paddingVertical: widgetPadding,
    },
    widgetLabel: {
      color: colors.textMuted,
      fontSize: typography.cardTitle,
      fontWeight: "600",
      marginBottom: APP_SPACING.xs,
    },
    widgetValue: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    alertsCard: {
      marginTop: APP_SPACING.md,
      marginHorizontal: horizontalInset,
      borderRadius: APP_RADII.lg,
      borderWidth: 0,
      borderColor: "transparent",
      backgroundColor: "transparent",
      paddingHorizontal: 0,
      paddingVertical: 0,
      gap: compact ? APP_SPACING.xs : APP_SPACING.sm,
    },
    emptyStateCard: {
      marginTop: APP_SPACING.md,
      marginHorizontal: horizontalInset,
      borderWidth: 0,
      borderColor: "transparent",
      backgroundColor: "transparent",
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    emptyStateText: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.compact ? 18 : 21,
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
    blockedWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 26,
      gap: 12,
    },
    blockedTitle: {
      fontSize: compact ? 20 : 22,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },
    blockedText: {
      fontSize: compact ? 14 : 15,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: compact ? 20 : 22,
    },
    blockedButton: {
      marginTop: 4,
      backgroundColor: "#2f8eff",
      borderRadius: 10,
      height: 44,
      minWidth: 150,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    blockedButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
    },
  });
}
