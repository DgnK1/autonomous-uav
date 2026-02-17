import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polygon, type MapPressEvent } from "../components/map-adapter";
import { AppActionButton } from "@/components/ui/app-action-button";
import { PulsePlaceholder } from "@/components/ui/pulse-placeholder";
import { DEFAULT_REGION } from "@/lib/map-region";
import { setMappingSelection, type MappingPoint } from "@/lib/mapping-selection";
import { plotsStore } from "@/lib/plots-store";
import { APP_RADII, APP_SPACING, getAppTypography, type AppTheme, useAppTheme } from "@/lib/ui/app-theme";

export default function MappingAreaScreen() {
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const styles = createStyles(width, colors);
  const [points, setPoints] = useState<MappingPoint[]>([]);
  const [isMapLoading, setIsMapLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsMapLoading(false), 950);
    return () => clearTimeout(timer);
  }, []);

  function onMapTap(event: MapPressEvent) {
    if (points.length >= 4) {
      return;
    }

    const { latitude, longitude } = event.nativeEvent.coordinate;
    setPoints((prev) => [...prev, { latitude, longitude }]);
  }

  function completeSelection() {
    if (points.length !== 4) {
      Alert.alert("Need 4 points", "Tap exactly 4 points to define the mapping area.");
      return;
    }

    setMappingSelection(points);
    plotsStore.setPlotsFromCoordinates(points);
    router.back();
  }

  function confirmCancel() {
    Alert.alert("Cancel Mapping?", "Are you sure you want to cancel the mapping process?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: () => {
          setPoints([]);
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={confirmCancel} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </Pressable>
        <Text style={styles.headerTitle}>Define Mapping Area</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <View style={styles.mapFrame}>
        <MapView style={styles.map} initialRegion={DEFAULT_REGION} onPress={onMapTap}>
          {points.length >= 3 && (
            <Polygon
              coordinates={points}
              fillColor="rgba(47, 142, 255, 0.25)"
              strokeColor="#2f8eff"
              strokeWidth={2}
            />
          )}
          {points.map((point, index) => (
            <Marker key={`${point.latitude}-${point.longitude}-${index}`} coordinate={point}>
              <View style={styles.pointMarker}>
                <Text style={styles.pointLabel}>{index + 1}</Text>
              </View>
            </Marker>
          ))}
        </MapView>
        {isMapLoading ? <PulsePlaceholder color="#ffffff14" /> : null}
        <View style={styles.mapGuide}>
          <Text style={styles.mapGuideText}>Tap 4 points to outline the target mapping area.</Text>
        </View>
        <View style={styles.mapHudRow}>
          <View style={styles.hudChip}>
            <Text style={styles.hudChipText}>{`PLOT POINTS ${points.length}/4`}</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomArea}>
        <Text style={styles.helperText}>{`Points selected: ${points.length}/4`}</Text>
        <View style={styles.buttonRow}>
          <View style={styles.buttonWrap}>
            <AppActionButton
              label="Reset"
              onPress={() => setPoints([])}
              backgroundColor={colors.actionModeBg}
              borderColor={colors.summaryBorder}
              textColor={colors.onAccent}
              compact={width < 360}
            />
          </View>
          <View style={styles.buttonWrap}>
            <AppActionButton
              label="Complete Area"
              onPress={completeSelection}
              disabled={points.length !== 4}
              backgroundColor={colors.actionStartBg}
              borderColor={colors.summaryBorder}
              textColor={colors.onAccent}
              compact={width < 360}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AppTheme["colors"]) {
  const typography = getAppTypography(width);

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.screenBg,
    },
    header: {
      height: 58,
      backgroundColor: colors.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.headerBorder,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: APP_SPACING.md,
    },
    backButton: {
      width: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: typography.sectionTitle,
      fontWeight: "700",
    },
    headerRightPlaceholder: {
      width: 34,
    },
    mapFrame: {
      flex: 1,
      margin: APP_SPACING.xl,
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    map: {
      flex: 1,
    },
    mapGuide: {
      position: "absolute",
      left: APP_SPACING.md,
      right: APP_SPACING.md,
      top: APP_SPACING.md,
      backgroundColor: colors.noticeBg,
      borderRadius: APP_RADII.md,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.sm,
    },
    mapGuideText: {
      color: colors.onAccent,
      textAlign: "center",
      fontSize: typography.cardTitle,
      fontWeight: "600",
    },
    mapHudRow: {
      position: "absolute",
      right: APP_SPACING.sm,
      bottom: APP_SPACING.sm,
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
    pointMarker: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "#2f8eff",
      borderWidth: 2,
      borderColor: "#d9ecff",
      alignItems: "center",
      justifyContent: "center",
    },
    pointLabel: {
      color: "#ffffff",
      fontSize: 11,
      fontWeight: "700",
    },
    bottomArea: {
      paddingHorizontal: APP_SPACING.xl,
      paddingBottom: APP_SPACING.xxl,
    },
    helperText: {
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: APP_SPACING.lg,
      fontSize: typography.bodyStrong,
    },
    buttonRow: {
      flexDirection: "row",
      gap: APP_SPACING.md,
    },
    buttonWrap: {
      flex: 1,
    },
  });
}
