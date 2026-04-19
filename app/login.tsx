import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firebaseConfigError, getAuthErrorMessage } from "@/lib/firebase";
import {
  AUTH_RADII,
  AUTH_SIZES,
  AUTH_SPACING,
  getAccessibleAuthTypography,
  getAuthLayoutProfile,
  type AuthColors,
  useAuthTheme,
} from "@/lib/ui/auth-ui";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { width, fontScale } = useWindowDimensions();
  const { mode, colors } = useAuthTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(width, colors, fontScale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isAuthLoading = isSubmitting;

  const trimmedEmail = email.trim();
  const showInlineValidation = attemptedSubmit || emailTouched || passwordTouched;

  const emailValidationError = useMemo(() => {
    if (!showInlineValidation) {
      return null;
    }
    if (!trimmedEmail) {
      return "Email is required.";
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return "Enter a valid email address.";
    }
    return null;
  }, [showInlineValidation, trimmedEmail]);

  const passwordValidationError = useMemo(() => {
    if (!showInlineValidation) {
      return null;
    }
    if (!password.trim()) {
      return "Password is required.";
    }
    return null;
  }, [showInlineValidation, password]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        return;
      }

      if (user.emailVerified) {
        router.replace("/(tabs)");
        return;
      }

      router.replace("/verify-email");
    });

    return unsubscribe;
  }, []);

  async function handleLogin() {
    if (!auth) {
      setErrorMessage(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    setAttemptedSubmit(true);
    if (emailValidationError || passwordValidationError) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      if (credential.user.emailVerified) {
        router.replace("/(tabs)");
      } else {
        router.replace("/verify-email");
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!auth) {
      setErrorMessage(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    if (!trimmedEmail) {
      setEmailTouched(true);
      setAttemptedSubmit(true);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert("Password reset", "A reset link was sent to your email.");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : insets.top}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: AUTH_SPACING.xxxl + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Image
              source={
                mode === "dark"
                  ? require("../assets/icons/SOARISV3NOBGW.png")
                  : require("../assets/icons/SOARISV3NOBGB.png")
              }
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>Login to your account</Text>

            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Email"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, emailValidationError && styles.inputError]}
                value={email}
                onChangeText={setEmail}
                onBlur={() => setEmailTouched(true)}
                editable={!isAuthLoading}
              />
            </View>
            {emailValidationError ? <Text style={styles.inlineErrorText}>{emailValidationError}</Text> : null}

            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!passwordVisible}
                style={[styles.input, passwordValidationError && styles.inputError]}
                value={password}
                onChangeText={setPassword}
                onBlur={() => setPasswordTouched(true)}
                editable={!isAuthLoading}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setPasswordVisible((prev) => !prev)}
                disabled={isAuthLoading}
              >
                <Ionicons
                  name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.iconMuted}
                />
              </Pressable>
            </View>
            {passwordValidationError ? (
              <Text style={styles.inlineErrorText}>{passwordValidationError}</Text>
            ) : null}

            <Pressable
              onPress={() => void handleForgotPassword()}
              style={styles.forgotPasswordButton}
              disabled={isAuthLoading}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </Pressable>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={isAuthLoading}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Do not have an account? </Text>
              <Link href="/signup" style={styles.footerLink}>
                Sign Up
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {isAuthLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(width: number, colors: AuthColors, fontScale: number) {
  const typography = getAccessibleAuthTypography(width, fontScale);
  const layout = getAuthLayoutProfile(width);
  const largeText = fontScale >= 1.15;
  const screenMaxWidth = layout.isLarge ? 560 : 420;

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardWrap: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
      justifyContent: "center",
      paddingVertical: layout.isSmall ? AUTH_SPACING.xxl : largeText ? AUTH_SPACING.xxxl + 4 : AUTH_SPACING.xxxl,
    },
    container: {
      width: "100%",
      maxWidth: screenMaxWidth,
      alignSelf: "center",
      paddingHorizontal: layout.isSmall ? AUTH_SPACING.xxl : AUTH_SPACING.screenHorizontal,
    },
    logo: {
      width: typography.compact ? AUTH_SIZES.logoCompact : AUTH_SIZES.logoRegular,
      height: typography.compact ? AUTH_SIZES.logoCompact : AUTH_SIZES.logoRegular,
      alignSelf: "center",
      marginBottom: AUTH_SPACING.xxl,
    },
    title: {
      fontSize: typography.pageTitle,
      lineHeight: typography.pageTitleLineHeight,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: AUTH_SPACING.xxxl,
    },
    inputWrap: {
      position: "relative",
    },
    input: {
      minHeight: largeText ? AUTH_SIZES.inputHeight + 8 : AUTH_SIZES.inputHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: AUTH_RADII.sm,
      paddingHorizontal: AUTH_SPACING.xl,
      paddingVertical: 10,
      color: colors.socialText,
      fontSize: typography.input,
      marginBottom: AUTH_SPACING.sm,
      paddingRight: 44,
      backgroundColor: colors.surface,
    },
    inputError: {
      borderColor: colors.dangerBorder,
    },
    eyeButton: {
      position: "absolute",
      right: AUTH_SIZES.eyeButtonOffsetRight,
      top: AUTH_SIZES.eyeButtonOffsetTop,
      width: AUTH_SIZES.eyeButtonSize,
      height: AUTH_SIZES.eyeButtonSize,
      alignItems: "center",
      justifyContent: "center",
    },
    inlineErrorText: {
      color: colors.danger,
      fontSize: typography.inlineError,
      marginBottom: 6,
      marginLeft: 2,
    },
    forgotPasswordButton: {
      alignSelf: "flex-end",
      marginTop: -2,
      marginBottom: AUTH_SPACING.sm,
      opacity: 0.95,
    },
    forgotPasswordText: {
      color: colors.brandLink,
      fontSize: typography.body,
      fontWeight: "600",
    },
    primaryButton: {
      minHeight: largeText ? AUTH_SIZES.primaryButtonHeight + 6 : AUTH_SIZES.primaryButtonHeight,
      backgroundColor: colors.brand,
      borderRadius: AUTH_RADII.md,
      alignItems: "center",
      justifyContent: "center",
      marginTop: AUTH_SPACING.sm,
      marginBottom: AUTH_SPACING.sectionGap,
    },
    errorText: {
      marginTop: -3,
      marginBottom: AUTH_SPACING.sm,
      color: colors.danger,
      fontSize: typography.error,
      textAlign: "center",
    },
    primaryButtonText: {
      color: colors.onBrand,
      fontSize: typography.button,
      fontWeight: "700",
    },
    footerRow: {
      marginTop: AUTH_SPACING.xl,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
    },
    footerText: {
      fontSize: typography.body,
      color: colors.textBody,
    },
    footerLink: {
      fontSize: typography.body,
      color: colors.brandLink,
      textDecorationLine: "underline",
      fontWeight: "700",
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
