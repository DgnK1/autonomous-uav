import { router } from "expo-router";
import { onAuthStateChanged, sendEmailVerification, signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, firebaseConfigError, getAuthErrorMessage } from "@/lib/firebase";
import {
  AUTH_RADII,
  AUTH_SIZES,
  AUTH_SPACING,
  getAuthLayoutProfile,
  getAuthTypography,
  type AuthColors,
  useAuthTheme,
} from "@/lib/ui/auth-ui";

export default function VerifyEmailScreen() {
  const { width } = useWindowDimensions();
  const { colors } = useAuthTheme();
  const styles = createStyles(width, colors);
  const [email, setEmail] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isBusy = isChecking || isResending || isLeaving;

  useEffect(() => {
    if (!auth) {
      setErrorMessage(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (user.isAnonymous || user.emailVerified) {
        router.replace("/pair-device");
        return;
      }

      setEmail(user.email ?? "");
    });

    return unsubscribe;
  }, []);

  async function handleCheckVerification() {
    if (!auth || !auth.currentUser) {
      setErrorMessage("Session expired. Please sign in again.");
      router.replace("/login");
      return;
    }

    setIsChecking(true);
    setErrorMessage(null);
    try {
      await auth.currentUser.reload();
      const refreshedUser = auth.currentUser;
      if (refreshedUser?.emailVerified) {
        router.replace("/pair-device");
      } else {
        setErrorMessage("Email not verified yet. Check your inbox and try again.");
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsChecking(false);
    }
  }

  async function handleResendEmail() {
    if (!auth || !auth.currentUser) {
      setErrorMessage("Session expired. Please sign in again.");
      router.replace("/login");
      return;
    }

    setIsResending(true);
    setErrorMessage(null);
    try {
      await sendEmailVerification(auth.currentUser);
      Alert.alert("Verification sent", "We sent another verification link to your email.");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  }

  async function handleBackToLogin() {
    setIsLeaving(true);
    try {
      if (auth?.currentUser) {
        await signOut(auth);
      }
      router.replace("/login");
    } finally {
      setIsLeaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to:
          {"\n"}
          <Text style={styles.emailText}>{email || "your email"}</Text>
        </Text>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable
          style={styles.primaryButton}
          onPress={() => void handleCheckVerification()}
          disabled={isBusy}
        >
          <Text style={styles.primaryButtonText}>I verified my email</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => void handleResendEmail()}
          disabled={isBusy}
        >
          <Text style={styles.secondaryButtonText}>Resend verification email</Text>
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={() => void handleBackToLogin()}
          disabled={isBusy}
        >
          <Text style={styles.linkText}>Back to login</Text>
        </Pressable>
      </View>
      {isBusy && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AuthColors) {
  const typography = getAuthTypography(width);
  const layout = getAuthLayoutProfile(width);
  const screenMaxWidth = layout.isLarge ? 560 : 420;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      width: "100%",
      maxWidth: screenMaxWidth,
      alignSelf: "center",
      paddingHorizontal: layout.isSmall ? AUTH_SPACING.xxl : AUTH_SPACING.screenHorizontal,
      justifyContent: "center",
    },
    title: {
      fontSize: typography.heroTitle,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: AUTH_SPACING.lg,
    },
    subtitle: {
      fontSize: typography.subtitle,
      lineHeight: typography.compact ? 22 : 24,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: AUTH_SPACING.xxxl,
    },
    emailText: {
      fontWeight: "700",
      color: colors.textPrimary,
    },
    errorText: {
      marginBottom: AUTH_SPACING.md,
      color: colors.danger,
      fontSize: typography.error,
      textAlign: "center",
    },
    primaryButton: {
      height: AUTH_SIZES.primaryButtonHeight,
      backgroundColor: colors.brand,
      borderRadius: AUTH_RADII.md,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: AUTH_SPACING.md,
    },
    primaryButtonText: {
      color: colors.onBrand,
      fontSize: typography.compact ? 17 : typography.button,
      fontWeight: "700",
    },
    secondaryButton: {
      height: AUTH_SIZES.secondaryButtonHeight,
      borderRadius: AUTH_RADII.md,
      borderWidth: 1,
      borderColor: colors.brand,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: AUTH_SPACING.lg,
    },
    secondaryButtonText: {
      color: colors.brand,
      fontSize: typography.buttonSecondary,
      fontWeight: "700",
    },
    linkButton: {
      alignSelf: "center",
    },
    linkText: {
      color: colors.brandLink,
      fontSize: typography.link,
      textDecorationLine: "underline",
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
