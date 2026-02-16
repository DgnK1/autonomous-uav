import { router } from "expo-router";
import { onAuthStateChanged, sendEmailVerification, signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, firebaseConfigError, getAuthErrorMessage } from "@/lib/firebase";

export default function VerifyEmailScreen() {
  const [email, setEmail] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    if (auth?.currentUser) {
      await signOut(auth);
    }
    router.replace("/login");
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

        <Pressable style={styles.primaryButton} onPress={() => void handleCheckVerification()}>
          <Text style={styles.primaryButtonText}>{isChecking ? "Checking..." : "I verified my email"}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => void handleResendEmail()}>
          <Text style={styles.secondaryButtonText}>
            {isResending ? "Sending..." : "Resend verification email"}
          </Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={() => void handleBackToLogin()}>
          <Text style={styles.linkText}>Back to login</Text>
        </Pressable>
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
    fontSize: 34,
    fontWeight: "700",
    color: "#1d222a",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: "#3f444b",
    textAlign: "center",
    marginBottom: 20,
  },
  emailText: {
    fontWeight: "700",
    color: "#1d222a",
  },
  errorText: {
    marginBottom: 10,
    color: "#b42318",
    fontSize: 14,
    textAlign: "center",
  },
  primaryButton: {
    height: 52,
    backgroundColor: "#3c6798",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#f2f5f8",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3c6798",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: "#3c6798",
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    alignSelf: "center",
  },
  linkText: {
    color: "#2f5e90",
    fontSize: 16,
    textDecorationLine: "underline",
  },
});
