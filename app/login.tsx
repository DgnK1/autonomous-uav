import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Link, router } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
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
import { SafeAreaView } from "react-native-safe-area-context";
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

WebBrowser.maybeCompleteAuthSession();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { width, fontScale } = useWindowDimensions();
  const { mode, colors } = useAuthTheme();
  const styles = createStyles(width, colors, fontScale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isAuthLoading = isSubmitting || isGoogleSubmitting || isGuestSubmitting;
  const isExpoGo = Constants.appOwnership === "expo";
  const googleConfigured = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  );

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

  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        return;
      }

      if (user.isAnonymous || user.emailVerified) {
        router.replace("/pair-device");
        return;
      }

      router.replace("/verify-email");
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (response?.type !== "success") {
      return;
    }

    if (!auth) {
      setErrorMessage(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    const idToken = response.params.id_token;
    if (!idToken) {
      setErrorMessage("Google sign-in failed. Missing token.");
      return;
    }

    const credential = GoogleAuthProvider.credential(idToken);
    setIsGoogleSubmitting(true);
    setErrorMessage(null);

    void signInWithCredential(auth, credential)
      .then(() => {
        router.replace("/pair-device");
      })
      .catch((error) => {
        setErrorMessage(getAuthErrorMessage(error));
      })
      .finally(() => {
        setIsGoogleSubmitting(false);
      });
  }, [response]);

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
      if (credential.user.isAnonymous || credential.user.emailVerified) {
        router.replace("/pair-device");
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

  async function handleGoogleLogin() {
    if (isExpoGo) {
      Alert.alert(
        "Google sign-in in Dev Build",
        "Google OAuth is disabled in Expo Go. Use Email/Password or Guest for now."
      );
      return;
    }

    if (!googleConfigured) {
      Alert.alert(
        "Google sign-in not configured",
        "Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (and optionally Android/iOS client IDs) in .env.local."
      );
      return;
    }

    setErrorMessage(null);
    await promptAsync();
  }

  async function handleGuestLogin() {
    if (!auth) {
      setErrorMessage(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    setIsGuestSubmitting(true);
    setErrorMessage(null);

    try {
      await signInAnonymously(auth);
      router.replace("/pair-device");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsGuestSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Image
              source={
                mode === "dark"
                  ? require("../assets/icons/SOARISV2NOBGW.png")
                  : require("../assets/icons/SOARISV2NOBGB.png")
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

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={styles.socialButton}
              onPress={() => void handleGoogleLogin()}
              disabled={isAuthLoading}
            >
              <Ionicons name="logo-google" size={15} color={colors.socialText} />
              <Text style={styles.socialButtonText}>
                {isExpoGo ? "Google (Dev Build only)" : "Continue with Google"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.socialButton}
              onPress={() => void handleGuestLogin()}
              disabled={isAuthLoading}
            >
              <Ionicons name="person-circle-outline" size={16} color={colors.socialText} />
              <Text style={styles.socialButtonText}>Continue as Guest</Text>
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
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: AUTH_SPACING.md,
      marginBottom: AUTH_SPACING.xxl,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.borderMuted,
    },
    dividerText: {
      color: colors.textBody,
      fontSize: typography.divider,
    },
    socialButton: {
      minHeight: largeText ? AUTH_SIZES.socialButtonHeight + 6 : AUTH_SIZES.socialButtonHeight,
      borderRadius: AUTH_RADII.md,
      backgroundColor: colors.socialSurface,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: AUTH_SPACING.sm,
      marginBottom: AUTH_SPACING.md,
      paddingHorizontal: AUTH_SPACING.xl,
      alignSelf: "center",
      minWidth: typography.compact ? AUTH_SIZES.socialButtonMinCompact : AUTH_SIZES.socialButtonMinRegular,
    },
    socialButtonText: {
      fontSize: typography.buttonSecondary,
      color: colors.socialText,
      fontWeight: "600",
      flexShrink: 1,
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
