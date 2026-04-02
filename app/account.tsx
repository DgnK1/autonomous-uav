import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, firebaseConfigError, getAuthErrorMessage } from "@/lib/firebase";
import {
  APP_RADII,
  APP_SPACING,
  getAccessibleAppTypography,
  type AppTheme,
  useAppTheme,
} from "@/lib/ui/app-theme";

export default function AccountScreen() {
  const { width, fontScale } = useWindowDimensions();
  const { colors } = useAppTheme();
  const styles = createStyles(width, colors, fontScale);
  const [sendingReset, setSendingReset] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  const currentUser = auth?.currentUser ?? null;
  const email = currentUser?.email ?? "No email available";
  const isVerified = Boolean(currentUser?.emailVerified);
  const statusText = useMemo(
    () => (isVerified ? "Verified email account" : "Email verification pending"),
    [isVerified],
  );

  async function handlePasswordReset() {
    if (!auth || !currentUser?.email) {
      Alert.alert("Account unavailable", firebaseConfigError ?? "No signed-in email account found.");
      return;
    }

    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      Alert.alert("Password reset sent", `A password reset link was sent to ${currentUser.email}.`);
    } catch (error) {
      Alert.alert("Unable to send reset", getAuthErrorMessage(error));
    } finally {
      setSendingReset(false);
    }
  }

  async function handleResendVerification() {
    if (!auth || !currentUser) {
      Alert.alert("Account unavailable", firebaseConfigError ?? "No signed-in email account found.");
      return;
    }

    setSendingVerification(true);
    try {
      await sendEmailVerification(currentUser);
      Alert.alert("Verification sent", "Another verification email was sent to your inbox.");
    } catch (error) {
      Alert.alert("Unable to resend", getAuthErrorMessage(error));
    } finally {
      setSendingVerification(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to settings"
        >
          <Ionicons name="chevron-back" size={22} color={colors.icon} />
        </Pressable>
        <Text style={styles.headerTitle}>Account Management</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signed-in account</Text>
          <Text style={styles.emailText}>{email}</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isVerified ? "#22c55e" : "#f3b234" },
              ]}
            />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>

        <Pressable
          style={[styles.actionButton, sendingReset && styles.actionButtonDisabled]}
          disabled={sendingReset}
          onPress={() => void handlePasswordReset()}
        >
          <Ionicons name="key-outline" size={18} color="#ffffff" />
          <Text style={styles.actionButtonText}>
            {sendingReset ? "Sending reset..." : "Send Password Reset Email"}
          </Text>
        </Pressable>

        {!isVerified ? (
          <Pressable
            style={[styles.secondaryButton, sendingVerification && styles.actionButtonDisabled]}
            disabled={sendingVerification}
            onPress={() => void handleResendVerification()}
          >
          <Ionicons name="mail-unread-outline" size={18} color={colors.actionStartBg} />
            <Text style={styles.secondaryButtonText}>
              {sendingVerification ? "Resending..." : "Resend Verification Email"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AppTheme["colors"], fontScale = 1) {
  const typography = getAccessibleAppTypography(width, fontScale);

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.screenBg,
    },
    header: {
      height: 64,
      paddingHorizontal: APP_SPACING.xl,
      backgroundColor: colors.headerBg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.headerBorder,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: APP_RADII.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      color: colors.textPrimary,
      fontSize: typography.headerTitle,
      fontWeight: "700",
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    content: {
      padding: APP_SPACING.xl,
      gap: APP_SPACING.lg,
    },
    card: {
      borderRadius: APP_RADII.xl,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: APP_SPACING.lg,
      gap: APP_SPACING.sm,
    },
    cardTitle: {
      color: colors.textMuted,
      fontSize: typography.chipLabel,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    emailText: {
      color: colors.textPrimary,
      fontSize: typography.sectionTitle,
      fontWeight: "700",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: APP_SPACING.sm,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    actionButton: {
      minHeight: 50,
      borderRadius: APP_RADII.lg,
      backgroundColor: colors.actionStartBg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: APP_SPACING.sm,
    },
    actionButtonDisabled: {
      opacity: 0.65,
    },
    actionButtonText: {
      color: colors.onAccent,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
    secondaryButton: {
      minHeight: 50,
      borderRadius: APP_RADII.lg,
      borderWidth: 1,
      borderColor: colors.actionStartBg,
      backgroundColor: colors.cardBg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: APP_SPACING.sm,
    },
    secondaryButtonText: {
      color: colors.actionStartBg,
      fontSize: typography.bodyStrong,
      fontWeight: "700",
    },
  });
}
