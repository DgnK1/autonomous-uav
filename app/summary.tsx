import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polygon } from "../components/map-adapter";
import { FadeInView } from "@/components/ui/fade-in-view";
import { PulsePlaceholder } from "@/components/ui/pulse-placeholder";
import { ScreenSection } from "@/components/ui/screen-section";
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

type SummaryAlert = {
  id: string;
  level: "High" | "Medium" | "Info";
  message: string;
};

function getRecommendation(plots: ReturnType<typeof usePlotsStore>["plots"], isDark: boolean) {
  if (plots.length === 0) {
    return {
      title: "Next Action",
      text: "Waiting for mapping data...",
      color: isDark ? "#93b8ec" : "#5b7aa5",
      background: isDark ? "#1c2a3b" : "#eaf1fb",
      border: isDark ? "#3f5d83" : "#9fb7d9",
    };
  }

  const avgMoisture =
    plots.reduce((sum, plot) => sum + plot.moistureValue, 0) / plots.length;
  const avgPh = plots.reduce((sum, plot) => sum + plot.phValue, 0) / plots.length;
  const avgTemp = plots.reduce((sum, plot) => sum + plot.temperatureValue, 0) / plots.length;

  let text = "";
  let color = isDark ? "#77d396" : "#2f8f50";
  let background = isDark ? "#1d2e24" : "#ecf8f0";
  let border = isDark ? "#3e6e4d" : "#9fd4ac";

  if (avgMoisture < 30) {
    text = `Soil is generally dry (avg moisture ${avgMoisture.toFixed(0)}%). It is a good time to irrigate the field.`;
    color = isDark ? "#ff7d7f" : "#ff5f60";
    background = isDark ? "#362123" : "#f7ecec";
    border = isDark ? "#8f5456" : "#f28f90";
  } else if (avgMoisture > 70) {
    text = `Soil moisture is high (avg ${avgMoisture.toFixed(0)}%). Avoid irrigating to prevent overwatering.`;
    color = isDark ? "#e7ab4a" : "#e1921f";
    background = isDark ? "#332a1a" : "#fbf3e6";
    border = isDark ? "#86693b" : "#efce8e";
  } else {
    text = `Soil moisture is optimal (avg ${avgMoisture.toFixed(0)}%). You can wait before irrigating.`;
  }

  if (avgPh < 5.5 || avgPh > 7.5) {
    text += ` Note: average pH ${avgPh.toFixed(1)} is outside the ideal 5.5–7.5 range.`;
  }

  if (avgTemp < 15 || avgTemp > 35) {
    text += ` Temperature (${avgTemp.toFixed(1)}°C) is not ideal.`;
  }

  return {
    title: "Next Action",
    text,
    color,
    background,
    border,
  };
}

function getOperationalAlerts(plots: ReturnType<typeof usePlotsStore>["plots"]): SummaryAlert[] {
  if (plots.length === 0) {
    return [
      {
        id: "waiting-data",
        level: "Info",
        message: "No mapped plots yet. Run mapping to generate soil risk alerts.",
      },
    ];
  }

  const avgMoisture = plots.reduce((sum, plot) => sum + plot.moistureValue, 0) / plots.length;
  const avgPh = plots.reduce((sum, plot) => sum + plot.phValue, 0) / plots.length;
  const avgTemp = plots.reduce((sum, plot) => sum + plot.temperatureValue, 0) / plots.length;
  const driestPlot = plots.reduce((lowest, current) =>
    current.moistureValue < lowest.moistureValue ? current : lowest
  );
  const hottestPlot = plots.reduce((highest, current) =>
    current.temperatureValue > highest.temperatureValue ? current : highest
  );

  const alerts: SummaryAlert[] = [];

  if (avgMoisture < 30) {
    alerts.push({
      id: "dry-soil",
      level: "High",
      message: `Critical moisture risk. ${driestPlot.title} is at ${driestPlot.moistureValue.toFixed(0)}%.`,
    });
  } else if (avgMoisture > 70) {
    alerts.push({
      id: "overwater-risk",
      level: "Medium",
      message: `High moisture detected (${avgMoisture.toFixed(0)}% avg). Delay irrigation cycle.`,
    });
  } else {
    alerts.push({
      id: "moisture-ok",
      level: "Info",
      message: `Moisture within safe band (${avgMoisture.toFixed(0)}% avg).`,
    });
  }

  if (avgPh < 5.5 || avgPh > 7.5) {
    alerts.push({
      id: "ph-out-of-range",
      level: "Medium",
      message: `Soil pH drift detected (${avgPh.toFixed(1)}). Schedule corrective treatment.`,
    });
  }

  if (avgTemp > 35) {
    alerts.push({
      id: "heat-risk",
      level: "High",
      message: `Heat stress warning. ${hottestPlot.title} reached ${hottestPlot.temperatureValue.toFixed(1)}°C.`,
    });
  } else if (avgTemp < 15) {
    alerts.push({
      id: "cold-risk",
      level: "Medium",
      message: `Low temperature trend (${avgTemp.toFixed(1)}°C avg). Growth may slow down.`,
    });
  }

  if (alerts.length < 2) {
    alerts.push({
      id: "system-ok",
      level: "Info",
      message: "No additional critical alerts. Continue periodic monitoring.",
    });
  }

  return alerts;
}

function getAlertColors(level: SummaryAlert["level"], isDark: boolean) {
  if (level === "High") {
    return {
      chipBg: isDark ? "#3d2427" : "#fdeaea",
      chipText: isDark ? "#ff9295" : "#cf3e43",
      rowBorder: isDark ? "#5f3338" : "#f1b5b8",
      icon: isDark ? "#ff7d80" : "#e94f50",
    };
  }
  if (level === "Medium") {
    return {
      chipBg: isDark ? "#3b2f1e" : "#fff3e4",
      chipText: isDark ? "#efbe6a" : "#bc7d1a",
      rowBorder: isDark ? "#5a462b" : "#f1d1a1",
      icon: isDark ? "#efbe6a" : "#de9a2b",
    };
  }
  return {
    chipBg: isDark ? "#213042" : "#eaf2fd",
    chipText: isDark ? "#97bef4" : "#356bb4",
    rowBorder: isDark ? "#344e70" : "#bdd2f1",
    icon: isDark ? "#8ab8f6" : "#4b83cf",
  };
}

export default function SummaryScreen() {
  const { width } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const typography = getAppTypography(width);
  const styles = createStyles(width, colors);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { plots, selectedPlotId } = usePlotsStore();
  const coordinates = useMemo(
    () => plots.map((plot) => ({ latitude: plot.latitude, longitude: plot.longitude })),
    [plots]
  );
  const region = useMemo(() => buildRegionFromCoordinates(coordinates), [coordinates]);
  const recommendation = getRecommendation(plots, isDark);
  const alerts = useMemo(() => getOperationalAlerts(plots), [plots]);
  const hasPlots = plots.length > 0;
  const avgMoisture = useMemo(
    () => (plots.length ? plots.reduce((sum, plot) => sum + plot.moistureValue, 0) / plots.length : 0),
    [plots]
  );

  useEffect(() => {
    const timer = setTimeout(() => setIsMapLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </Pressable>
        <Text style={styles.headerTitle}>Soil Monitoring</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.icon} />}
      >
        <FadeInView delay={30}>
        <View style={styles.mapFrame}>
          <MapView
            key={`${region.latitude}-${region.longitude}-${region.latitudeDelta}-${region.longitudeDelta}`}
            style={styles.map}
            initialRegion={region}
          >
            {coordinates.length >= 3 && (
              <Polygon
                coordinates={coordinates}
                fillColor="rgba(233, 77, 68, 0.22)"
                strokeColor="#e94842"
                strokeWidth={2}
              />
            )}
            {plots.map((plot) => (
              <Marker
                key={plot.id}
                coordinate={{ latitude: plot.latitude, longitude: plot.longitude }}
                onPress={() => plotsStore.setSelectedPlot(plot.id)}
                pinColor={selectedPlotId === plot.id ? "#2f8eff" : "#e94842"}
              />
            ))}
          </MapView>
          {isMapLoading ? <PulsePlaceholder color={isDark ? "#ffffff14" : "#00000010"} /> : null}
          {!isMapLoading && !hasPlots ? (
            <View style={styles.emptyMapOverlay}>
              <Text style={styles.emptyMapText}>No mapped area yet</Text>
            </View>
          ) : null}
          <View style={styles.mapHudRow}>
            <View style={styles.hudChip}>
              <Text style={styles.hudChipText}>{`PLOTS ${plots.length}`}</Text>
            </View>
            <View style={styles.hudChip}>
              <Text style={styles.hudChipText}>{`AVG ${avgMoisture.toFixed(0)}%`}</Text>
            </View>
          </View>
        </View>
        </FadeInView>

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
        ) : (
          <FadeInView delay={80}>
            <ScreenSection
              title="No Summary Data"
              titleColor={colors.textPrimary}
              titleSize={typography.cardTitle}
              borderColor={colors.cardBorder}
              backgroundColor={colors.cardBg}
              style={styles.emptyStateCard}
            >
              <Text style={styles.emptyStateText}>
                No mapped plots available yet. Complete a mapping run to populate summary analytics.
              </Text>
            </ScreenSection>
          </FadeInView>
        )}

        <FadeInView delay={120}>
          <ScreenSection
            title={recommendation.title}
            titleColor={recommendation.color}
            titleSize={typography.cardTitle}
            borderColor={recommendation.border}
            backgroundColor={recommendation.background}
            style={styles.nextActionCard}
          >
            <Text style={styles.nextActionBody}>{recommendation.text}</Text>
          </ScreenSection>
        </FadeInView>

        <FadeInView delay={150}>
          <ScreenSection
            title="Operational Alerts"
            titleColor={colors.textPrimary}
            titleSize={typography.cardTitle}
            borderColor={colors.cardBorder}
            backgroundColor={colors.cardBg}
            style={styles.alertsCard}
          >
            {alerts.map((alert) => {
              const alertColors = getAlertColors(alert.level, isDark);
              return (
                <View
                  key={alert.id}
                  style={[styles.alertRow, { borderColor: alertColors.rowBorder }]}
                >
                  <Ionicons name="alert-circle-outline" size={18} color={alertColors.icon} />
                  <View style={styles.alertTextWrap}>
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                  </View>
                  <View style={[styles.alertChip, { backgroundColor: alertColors.chipBg }]}>
                    <Text style={[styles.alertChipText, { color: alertColors.chipText }]}>{alert.level}</Text>
                  </View>
                </View>
              );
            })}
          </ScreenSection>
        </FadeInView>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AppTheme["colors"]) {
  const typography = getAppTypography(width);
  const layout = getLayoutProfile(width);
  const { compact } = typography;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.screenBg,
    },
    header: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.headerBg,
      paddingHorizontal: APP_SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.headerBorder,
    },
    backButton: {
      width: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontSize: compact ? 16 : 17,
      fontWeight: "600",
      color: colors.textPrimary,
      marginRight: 32,
    },
    headerRightSpacer: {
      width: 32,
    },
    scroll: {
      flex: 1,
    },
    content: {
      width: "100%",
      maxWidth: layout.isLarge ? 980 : undefined,
      alignSelf: "center",
      paddingBottom: APP_SPACING.xxxl,
    },
    mapFrame: {
      height: layout.isSmall ? 208 : layout.isLarge ? 272 : 232,
      backgroundColor: colors.mapFrameBg,
      position: "relative",
      overflow: "hidden",
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    map: {
      flex: 1,
    },
    mapHudRow: {
      position: "absolute",
      top: APP_SPACING.sm,
      right: APP_SPACING.sm,
      flexDirection: "row",
      gap: APP_SPACING.xs,
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
    tableContainer: {
      width: "100%",
    },
    tableHeader: {
      height: 52,
      backgroundColor: colors.tableHeaderBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.tableHeaderBorder,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: layout.isLarge ? APP_SPACING.xxxl : APP_SPACING.xxl,
    },
    tableRow: {
      minHeight: 44,
      borderBottomWidth: 1,
      borderBottomColor: colors.tableRowBorder,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: layout.isLarge ? APP_SPACING.xxxl : APP_SPACING.xxl,
      paddingVertical: 8,
    },
    altTableRow: {
      backgroundColor: `${colors.cardBg}cc`,
    },
    selectedTableRow: {
      backgroundColor: colors.selectedRowBg,
    },
    headerCell: {
      fontSize: typography.tableHeader,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    bodyCell: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    tempText: {
      width: "100%",
      textAlign: "right",
    },
    plotCell: {
      flex: 0.3,
      minWidth: 0,
      paddingRight: APP_SPACING.xs,
    },
    moistureCell: {
      flex: 0.45,
      minWidth: 0,
      paddingRight: APP_SPACING.xs,
    },
    tempCell: {
      flex: 0.25,
      minWidth: 0,
    },
    nextActionCard: {
      marginTop: APP_SPACING.xl,
      marginHorizontal: layout.isLarge ? APP_SPACING.xxxl : APP_SPACING.xxl,
      borderWidth: 0,
      borderColor: "transparent",
      borderRadius: APP_RADII.md,
      backgroundColor: "transparent",
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    nextActionBody: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    alertsCard: {
      marginTop: APP_SPACING.xl,
      marginHorizontal: layout.isLarge ? APP_SPACING.xxxl : APP_SPACING.xxl,
      borderRadius: APP_RADII.lg,
      borderWidth: 0,
      borderColor: "transparent",
      backgroundColor: "transparent",
      paddingHorizontal: 0,
      paddingVertical: 0,
      gap: APP_SPACING.sm,
    },
    emptyStateCard: {
      marginTop: APP_SPACING.md,
      marginHorizontal: layout.isLarge ? APP_SPACING.xxxl : APP_SPACING.xxl,
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
      minHeight: 44,
      borderWidth: 1,
      borderRadius: APP_RADII.md,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
    },
    alertTextWrap: {
      flex: 1,
    },
    alertMessage: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    alertChip: {
      minWidth: 58,
      borderRadius: APP_RADII.md,
      paddingHorizontal: APP_SPACING.sm,
      paddingVertical: APP_SPACING.xs,
      alignItems: "center",
      justifyContent: "center",
    },
    alertChipText: {
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: typography.chipTracking,
    },
  });
}
