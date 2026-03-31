import { AppActionButton } from "@/components/ui/app-action-button";
import { zonesStore, useZonesStore, type Zone } from "@/lib/plots-store";
import {
  fetchLatestSupabaseSensorLocation,
  isSupabaseSensorLocationConfigured,
} from "@/lib/supabase-sensor-location";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  getLayoutProfile,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function getValidationError(latitudeText: string, longitudeText: string) {
  const latitude = Number(latitudeText.trim());
  const longitude = Number(longitudeText.trim());

  if (!latitudeText.trim() || !longitudeText.trim()) {
    return "Enter both latitude and longitude.";
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return "Latitude and longitude must be valid numbers.";
  }

  if (latitude < -90 || latitude > 90) {
    return "Latitude must be between -90 and 90.";
  }

  if (longitude < -180 || longitude > 180) {
    return "Longitude must be between -180 and 180.";
  }

  return null;
}

export default function ManageZonesScreen() {
  const { width, fontScale } = useWindowDimensions();
  const { colors } = useAppTheme();
  const layout = getLayoutProfile(width);
  const shouldStackCardActions = width < 380;
  const styles = createStyles(width, colors, fontScale);
  const { zones, selectedZoneId } = useZonesStore();
  const [latitudeText, setLatitudeText] = useState("");
  const [longitudeText, setLongitudeText] = useState("");
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorStatus, setSensorStatus] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const formHighlight = useRef(new Animated.Value(0)).current;

  const editingZone = useMemo(
    () => zones.find((zone) => zone.id === editingZoneId) ?? null,
    [editingZoneId, zones],
  );

  function resetForm() {
    setLatitudeText("");
    setLongitudeText("");
    setEditingZoneId(null);
  }

  function startEditing(zone: Zone) {
    setEditingZoneId(zone.id);
    setLatitudeText(String(zone.latitude));
    setLongitudeText(String(zone.longitude));
  }

  function handleEditPress(event: GestureResponderEvent, zone: Zone) {
    event.stopPropagation();
    startEditing(zone);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
    Animated.sequence([
      Animated.delay(220),
      Animated.timing(formHighlight, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(formHighlight, {
        toValue: 0,
        duration: 320,
        useNativeDriver: false,
      }),
    ]).start();
  }

  function handleDeletePress(event: GestureResponderEvent, zone: Zone) {
    event.stopPropagation();
    confirmDelete(zone);
  }

  function handleSelectZone(zoneId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    zonesStore.setSelectedZone(zoneId);
  }

  async function fetchSensorLocation() {
    if (!isSupabaseSensorLocationConfigured()) {
      Alert.alert(
        "Supabase not configured",
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to fetch the latest transmitted sensor location.",
      );
      return;
    }

    setSensorLoading(true);
    setSensorStatus(null);

    try {
      const location = await fetchLatestSupabaseSensorLocation();

      setLatitudeText(formatCoordinate(location.latitude));
      setLongitudeText(formatCoordinate(location.longitude));
      setSensorStatus(
        "Latest sensor location loaded from Supabase. Review it, then tap Set Location.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to fetch sensor location.";
      setSensorStatus(message);
      Alert.alert("Unable to fetch location", message);
    } finally {
      setSensorLoading(false);
    }
  }

  function submitZone() {
    const validationError = getValidationError(latitudeText, longitudeText);
    if (validationError) {
      Alert.alert("Invalid coordinates", validationError);
      return;
    }

    const latitude = Number(latitudeText.trim());
    const longitude = Number(longitudeText.trim());

    try {
      if (editingZoneId) {
        zonesStore.updateZone(editingZoneId, latitude, longitude);
      } else {
        zonesStore.addZone(latitude, longitude);
      }
      resetForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save this zone.";
      Alert.alert("Unable to save zone", message);
    }
  }

  function confirmDelete(zone: Zone) {
    Alert.alert(
      "Delete zone?",
      `Remove ${zone.title} from the saved zone list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (editingZoneId === zone.id) {
              resetForm();
            }
            zonesStore.removeZone(zone.id);
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage Saved Zones</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: APP_SPACING.xxl + APP_SPACING.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.formCard,
            {
              borderColor: formHighlight.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.cardBorder, "#5ea1ff"],
              }),
              shadowOpacity: formHighlight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.28],
              }),
              shadowRadius: formHighlight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 14],
              }),
              shadowOffset: {
                width: 0,
                height: 0,
              },
              elevation: formHighlight.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 6],
              }),
            },
          ]}
        >
          <View style={styles.formHeroRow}>
            <View style={styles.formHeroIconWrap}>
              <Ionicons name="navigate-circle" size={24} color="#8bc2ff" />
            </View>
            <View style={styles.formHeroTextWrap}>
              <Text style={styles.formEyebrow}>SET LOCATION</Text>
              <Text style={styles.sectionTitle}>
                {editingZone ? `Edit ${editingZone.title}` : "Set Sensor Location"}
              </Text>
              <Text style={styles.helperText}>
                Fetch the latest coordinates transmitted by the sensor to
                Supabase, review the latitude and longitude below, then save
                that position as a zone.
              </Text>
            </View>
          </View>

          <View style={styles.sensorHintCard}>
            <Ionicons name="hardware-chip-outline" size={18} color="#8bc2ff" />
            <Text style={styles.sensorHintText}>
              The app reads the newest transmitted location, then you confirm it
              by tapping Set Location.
            </Text>
          </View>

          <View style={[styles.inputRow, layout.isSmall && styles.inputRowStacked]}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Latitude</Text>
              <View style={styles.inputShell}>
                <Ionicons name="compass-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="10.542400"
                  placeholderTextColor="#7c8390"
                  value={latitudeText}
                  onChangeText={setLatitudeText}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Longitude</Text>
              <View style={styles.inputShell}>
                <Ionicons name="pin-outline" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="123.944800"
                  placeholderTextColor="#7c8390"
                  value={longitudeText}
                  onChangeText={setLongitudeText}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>

          <View style={styles.primaryFetchWrap}>
            <AppActionButton
              label={sensorLoading ? "Loading..." : "Get Sensor Location"}
              icon="navigate-circle-outline"
              onPress={() => void fetchSensorLocation()}
              loading={sensorLoading}
              backgroundColor={colors.actionStartBg}
              borderColor={colors.summaryBorder}
              textColor={colors.onAccent}
              compact={layout.isSmall}
            />
          </View>

          {sensorStatus ? (
            <View style={styles.sensorStatusCard}>
              <Ionicons
                name={sensorStatus.toLowerCase().includes("loaded") ? "checkmark-circle" : "information-circle"}
                size={16}
                color={sensorStatus.toLowerCase().includes("loaded") ? "#7dd99c" : "#8bc2ff"}
              />
              <Text style={styles.sensorStatusText}>{sensorStatus}</Text>
            </View>
          ) : null}

          <View style={styles.primarySaveWrap}>
            <View style={styles.buttonRow}>
              <View style={styles.buttonWrap}>
                <AppActionButton
                  label={editingZone ? "Update Location" : "Set Location"}
                  icon={editingZone ? "create-outline" : "checkmark-circle-outline"}
                  onPress={submitZone}
                  backgroundColor={colors.actionStartBg}
                  borderColor={colors.summaryBorder}
                  textColor={colors.onAccent}
                  compact={layout.isSmall}
                />
              </View>
              <View style={styles.buttonWrap}>
                <AppActionButton
                  label={editingZone ? "Cancel Edit" : "Clear"}
                  icon="refresh-outline"
                  onPress={resetForm}
                  backgroundColor={colors.actionModeBg}
                  borderColor={colors.summaryBorder}
                  textColor={colors.onAccent}
                  compact={layout.isSmall}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>Saved Zones</Text>
            <Text style={styles.sectionCaption}>Tap a card to make it active.</Text>
          </View>
          <Text style={styles.countText}>{`${zones.length} total`}</Text>
        </View>

        {zones.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="location-outline" size={36} color={colors.rowIcon} />
            <Text style={styles.emptyTitle}>No saved zones yet</Text>
            <Text style={styles.emptyBody}>
              Add your first zone above to start monitoring and selecting active
              locations in the app.
            </Text>
          </View>
        ) : (
          zones.map((zone) => {
            const isSelected = zone.id === selectedZoneId;
            return (
              <Pressable
                key={zone.id}
                style={[styles.zoneCard, isSelected && styles.zoneCardSelected]}
                onPress={() => handleSelectZone(zone.id)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${zone.title}`}
              >
                <View style={styles.zoneCardTopRow}>
                  <View style={styles.zoneInfoWrap}>
                    <Text style={styles.zoneTitle}>{zone.title}</Text>
                    <Text style={styles.zoneSubtitle}>
                      {`${formatCoordinate(zone.latitude)}, ${formatCoordinate(zone.longitude)}`}
                    </Text>
                  </View>
                  <View style={[styles.selectedChip, isSelected && styles.selectedChipActive]}>
                    <Text
                      style={[
                        styles.selectedChipText,
                        isSelected && styles.selectedChipTextActive,
                      ]}
                    >
                      {isSelected ? "Active" : "Tap to Select"}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsFooter}>
                  <View
                    style={[
                      styles.actionsRow,
                      shouldStackCardActions && styles.actionsRowStacked,
                    ]}
                  >
                    <Pressable
                      onPress={(event) => handleEditPress(event, zone)}
                      style={[
                        styles.secondaryAction,
                        styles.editAction,
                        shouldStackCardActions && styles.secondaryActionStacked,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${zone.title}`}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                      <Text style={styles.secondaryActionText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      onPress={(event) => handleDeletePress(event, zone)}
                      style={[
                        styles.secondaryAction,
                        styles.deleteAction,
                        shouldStackCardActions && styles.secondaryActionStacked,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${zone.title}`}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef5350" />
                      <Text style={[styles.secondaryActionText, styles.deleteText]}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(
  width: number,
  colors: AppTheme["colors"],
  fontScale: number,
) {
  const typography = getAccessibleAppTypography(width, fontScale);
  const layout = getLayoutProfile(width);

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.screenBg,
    },
    header: {
      height: 64,
      paddingHorizontal: APP_SPACING.xxxl,
      backgroundColor: colors.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.headerBorder,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: APP_RADII.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: typography.sectionTitle,
      fontWeight: "700",
      textAlign: "center",
    },
    headerRightPlaceholder: {
      width: 44,
      height: 44,
    },
    content: {
      width: "100%",
      maxWidth: layout.isLarge ? 980 : 640,
      alignSelf: "center",
      paddingHorizontal: layout.isSmall ? APP_SPACING.md : APP_SPACING.xl,
      paddingTop: APP_SPACING.md,
      gap: APP_SPACING.md,
    },
    formCard: {
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.xl,
      padding: APP_SPACING.xl,
      gap: APP_SPACING.md,
    },
    formHeroRow: {
      flexDirection: "row",
      gap: APP_SPACING.md,
      alignItems: "flex-start",
    },
    formHeroIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: "#19314f",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#315b8f",
    },
    formHeroTextWrap: {
      flex: 1,
      gap: APP_SPACING.xs,
    },
    formEyebrow: {
      color: "#8bc2ff",
      fontSize: typography.chipLabel,
      fontWeight: "800",
      letterSpacing: 0.8,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: typography.sectionTitle,
      fontWeight: "700",
    },
    helperText: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.compact ? 18 : 20,
    },
    sensorHintCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: APP_SPACING.sm,
      borderRadius: APP_RADII.lg,
      backgroundColor: "#16212f",
      borderWidth: 1,
      borderColor: "#27425f",
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.md,
    },
    sensorHintText: {
      flex: 1,
      color: "#c1d8ef",
      fontSize: typography.small,
      lineHeight: typography.compact ? 16 : 18,
    },
    inputRow: {
      flexDirection: "row",
      gap: APP_SPACING.md,
    },
    inputRowStacked: {
      flexDirection: "column",
    },
    inputGroup: {
      flex: 1,
      gap: APP_SPACING.sm,
    },
    inputLabel: {
      color: colors.textMuted,
      fontSize: typography.cardTitle,
      fontWeight: "700",
    },
    inputShell: {
      minHeight: 50,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.searchInputBorder,
      backgroundColor: colors.searchInputBg,
      paddingHorizontal: APP_SPACING.md,
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
    },
    input: {
      flex: 1,
      minHeight: 48,
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
    },
    buttonRow: {
      flexDirection: "row",
      gap: APP_SPACING.md,
    },
    primaryFetchWrap: {
      marginTop: APP_SPACING.xs,
    },
    buttonWrap: {
      flex: 1,
    },
    sensorStatusText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: typography.compact ? 16 : 18,
    },
    sensorStatusCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: APP_SPACING.sm,
      borderRadius: APP_RADII.lg,
      backgroundColor: colors.headerBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.sm,
    },
    primarySaveWrap: {
      marginTop: APP_SPACING.xs,
    },
    listHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    countText: {
      color: colors.textMuted,
      fontSize: typography.body,
      fontWeight: "600",
    },
    sectionCaption: {
      color: colors.textMuted,
      fontSize: typography.small,
      marginTop: 2,
    },
    emptyCard: {
      alignItems: "center",
      gap: APP_SPACING.sm,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: APP_RADII.xl,
      paddingHorizontal: APP_SPACING.xl,
      paddingVertical: APP_SPACING.xxl,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    emptyBody: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.compact ? 18 : 20,
      textAlign: "center",
      maxWidth: 340,
    },
    zoneCard: {
      backgroundColor: "#1c2330",
      borderWidth: 1,
      borderColor: "#263348",
      borderRadius: 18,
      minHeight: 156,
      paddingTop: APP_SPACING.xl + APP_SPACING.xs,
      paddingHorizontal: APP_SPACING.xl + APP_SPACING.xs,
      paddingBottom: APP_SPACING.xl + APP_SPACING.sm,
      gap: APP_SPACING.lg,
    },
    zoneCardSelected: {
      borderColor: "#4a86df",
      backgroundColor: "#1f2940",
    },
    zoneCardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: APP_SPACING.md,
      alignItems: "center",
    },
    zoneInfoWrap: {
      flex: 1,
      minWidth: 0,
    },
    zoneTitle: {
      color: "#ffffff",
      fontSize: typography.sectionTitle - 1,
      fontWeight: "800",
    },
    zoneSubtitle: {
      marginTop: 6,
      color: "#c0cbda",
      fontSize: typography.body,
      fontWeight: "700",
    },
    selectedChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "#2e71d6",
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.xs + 1,
      backgroundColor: "#327ef0",
    },
    selectedChipActive: {
      borderColor: "#5ea1ff",
      backgroundColor: "#327ef0",
    },
    selectedChipText: {
      color: "#d4def0",
      fontSize: typography.chipLabel,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    selectedChipTextActive: {
      color: "#ffffff",
    },
    actionsFooter: {
      paddingTop: APP_SPACING.md,
      borderTopWidth: 1,
      borderTopColor: "#2a3447",
    },
    actionsRow: {
      flexDirection: "row",
      gap: APP_SPACING.sm,
      alignItems: "stretch",
    },
    actionsRowStacked: {
      flexDirection: "column",
      alignItems: "stretch",
    },
    secondaryAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 38,
      paddingHorizontal: APP_SPACING.md,
      paddingVertical: APP_SPACING.xs + 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#1e2a3b",
      backgroundColor: "#182233",
      flex: 1,
      overflow: "hidden",
      justifyContent: "center",
    },
    editAction: {
      backgroundColor: "#182233",
      borderColor: "#1f2b3b",
    },
    deleteAction: {
      backgroundColor: "#3a2330",
      borderColor: "#4c2b39",
    },
    secondaryActionStacked: {
      width: "100%",
      justifyContent: "center",
      alignSelf: "stretch",
    },
    secondaryActionText: {
      color: "#ffffff",
      fontSize: typography.small,
      fontWeight: "800",
      lineHeight: typography.small + 1,
      flexShrink: 1,
    },
    deleteText: {
      color: "#ef5350",
    },
  });
}
