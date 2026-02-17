import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInAnonymously,
  signInWithCredential,
} from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  getAuthLayoutProfile,
  getAuthTypography,
  type AuthColors,
  useAuthTheme,
} from "@/lib/ui/auth-ui";

WebBrowser.maybeCompleteAuthSession();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  const { width } = useWindowDimensions();
  const { colors } = useAuthTheme();
  const styles = createStyles(width, colors);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [repeatPasswordTouched, setRepeatPasswordTouched] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [repeatPasswordVisible, setRepeatPasswordVisible] = useState(false);

  const isAuthLoading = isSubmitting || isGoogleSubmitting || isGuestSubmitting;
  const googleConfigured = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  );
  const trimmedEmail = email.trim();
  const showInlineValidation =
    attemptedSubmit || emailTouched || passwordTouched || repeatPasswordTouched;

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
    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }
    return null;
  }, [showInlineValidation, password]);

  const repeatPasswordValidationError = useMemo(() => {
    if (!showInlineValidation) {
      return null;
    }
    if (!repeatPassword.trim()) {
      return "Please repeat your password.";
    }
    if (password !== repeatPassword) {
      return "Passwords do not match.";
    }
    return null;
  }, [showInlineValidation, password, repeatPassword]);

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
      setErrorMessage("Google sign-up failed. Missing token.");
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

  async function handleSignUp() {
    if (!auth) {
      setErrorMessage(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    setAttemptedSubmit(true);
    if (emailValidationError || passwordValidationError || repeatPasswordValidationError) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await sendEmailVerification(credential.user);
      Alert.alert("Verify your email", "A verification link was sent. Verify first, then sign in.");
      router.replace("/verify-email");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignUp() {
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

  async function handleGuestSignUp() {
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
            <Text style={styles.title}>Create an account</Text>
            <Text style={styles.subtitle}>Enter your details to register for this app</Text>

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

            <View style={styles.inputWrap}>
              <TextInput
                placeholder="Repeat Password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!repeatPasswordVisible}
                style={[styles.input, repeatPasswordValidationError && styles.inputError]}
                value={repeatPassword}
                onChangeText={setRepeatPassword}
                onBlur={() => setRepeatPasswordTouched(true)}
                editable={!isAuthLoading}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setRepeatPasswordVisible((prev) => !prev)}
                disabled={isAuthLoading}
              >
                <Ionicons
                  name={repeatPasswordVisible ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.iconMuted}
                />
              </Pressable>
            </View>
            {repeatPasswordValidationError ? (
              <Text style={styles.inlineErrorText}>{repeatPasswordValidationError}</Text>
            ) : null}

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable style={styles.primaryButton} onPress={handleSignUp} disabled={isAuthLoading}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={styles.socialButton}
              onPress={() => void handleGoogleSignUp()}
              disabled={isAuthLoading}
            >
              <Ionicons name="logo-google" size={15} color={colors.socialText} />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </Pressable>

            <Pressable
              style={styles.socialButton}
              onPress={() => void handleGuestSignUp()}
              disabled={isAuthLoading}
            >
              <Ionicons name="person-circle-outline" size={16} color={colors.socialText} />
              <Text style={styles.socialButtonText}>Continue as Guest</Text>
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/login" style={styles.footerLink}>
                Sign In
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

function createStyles(width: number, colors: AuthColors) {
  const typography = getAuthTypography(width);
  const layout = getAuthLayoutProfile(width);
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
      paddingVertical: layout.isSmall ? AUTH_SPACING.xxl : AUTH_SPACING.xxxl,
    },
    container: {
      width: "100%",
      maxWidth: screenMaxWidth,
      alignSelf: "center",
      paddingHorizontal: layout.isSmall ? AUTH_SPACING.xxl : AUTH_SPACING.screenHorizontal,
    },
    title: {
      fontSize: typography.heroTitle,
      lineHeight: typography.heroTitleLineHeight,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: AUTH_SPACING.sm,
    },
    subtitle: {
      fontSize: typography.subtitle,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: AUTH_SPACING.sectionGap,
    },
    inputWrap: {
      position: "relative",
    },
    input: {
      height: AUTH_SIZES.inputHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: AUTH_RADII.sm,
      paddingHorizontal: AUTH_SPACING.xl,
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
    primaryButton: {
      height: AUTH_SIZES.primaryButtonHeight,
      backgroundColor: colors.brand,
      borderRadius: AUTH_RADII.md,
      alignItems: "center",
      justifyContent: "center",
      marginTop: AUTH_SPACING.md,
      marginBottom: AUTH_SPACING.sectionGap,
    },
    errorText: {
      marginTop: -2,
      marginBottom: AUTH_SPACING.md,
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
      height: AUTH_SIZES.socialButtonHeight,
      borderRadius: AUTH_RADII.lg,
      backgroundColor: colors.socialSurfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: AUTH_SPACING.sm,
      marginBottom: 11,
      paddingHorizontal: AUTH_SPACING.lg,
    },
    socialButtonText: {
      fontSize: typography.buttonSecondary,
      color: colors.socialText,
      fontWeight: "600",
    },
    footerRow: {
      marginTop: 13,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    footerText: {
      fontSize: typography.body,
      color: colors.textMuted,
    },
    footerLink: {
      fontSize: typography.body,
      color: colors.brandLink,
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
