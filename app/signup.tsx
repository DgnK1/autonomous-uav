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
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, firebaseConfigError, getAuthErrorMessage } from "@/lib/firebase";

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const googleConfigured = Boolean(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  );

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

    if (!email.trim() || !password.trim() || !repeatPassword.trim()) {
      setErrorMessage("All fields are required.");
      return;
    }

    if (password !== repeatPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
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
      <View style={styles.container}>
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>Enter your details to register for this app</Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor="#5f646c"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor="#5f646c"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          placeholder="Repeat Password"
          placeholderTextColor="#5f646c"
          secureTextEntry
          style={styles.input}
          value={repeatPassword}
          onChangeText={setRepeatPassword}
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={handleSignUp} disabled={isSubmitting}>
          <Text style={styles.primaryButtonText}>{isSubmitting ? "Creating..." : "Continue"}</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable style={styles.socialButton} onPress={() => void handleGoogleSignUp()}>
          <Ionicons name="logo-google" size={15} color="#22262d" />
          <Text style={styles.socialButtonText}>
            {isGoogleSubmitting ? "Connecting..." : "Continue with Google"}
          </Text>
        </Pressable>

        <Pressable style={styles.socialButton} onPress={() => void handleGuestSignUp()}>
          <Ionicons name="person-circle-outline" size={16} color="#22262d" />
          <Text style={styles.socialButtonText}>
            {isGuestSubmitting ? "Entering..." : "Continue as Guest"}
          </Text>
        </Pressable>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/login" style={styles.footerLink}>
            Sign In
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#e8e9ee",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "700",
    color: "#1d222a",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#3f444b",
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#969ca5",
    borderRadius: 4,
    paddingHorizontal: 14,
    color: "#1f232a",
    fontSize: 17,
    marginBottom: 12,
  },
  primaryButton: {
    height: 52,
    backgroundColor: "#3c6798",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 24,
  },
  errorText: {
    marginTop: -2,
    marginBottom: 10,
    color: "#b42318",
    fontSize: 14,
    textAlign: "center",
  },
  primaryButtonText: {
    color: "#f2f5f8",
    fontSize: 24,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#939aa3",
  },
  dividerText: {
    color: "#2a2f36",
    fontSize: 20,
  },
  socialButton: {
    height: 44,
    borderRadius: 11,
    backgroundColor: "#d0d5df",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  socialButtonText: {
    fontSize: 19,
    color: "#1f242b",
    fontWeight: "600",
  },
  footerRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 16,
    color: "#545b65",
  },
  footerLink: {
    fontSize: 16,
    color: "#2f5e90",
    fontWeight: "700",
  },
});
