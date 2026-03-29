import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useEffect } from "react";
import {
  Pressable,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { auth, firebaseConfigError, getAuthErrorMessage } from "@/lib/firebase";

WebBrowser.maybeCompleteAuthSession();

type GoogleAuthButtonProps = {
  label: string;
  disabled?: boolean;
  buttonStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  iconColor: string;
  webClientId: string;
  androidClientId?: string;
  iosClientId?: string;
  onError: (message: string | null) => void;
  onSubmittingChange: (submitting: boolean) => void;
};

export function GoogleAuthButton({
  label,
  disabled = false,
  buttonStyle,
  textStyle,
  iconColor,
  webClientId,
  androidClientId,
  iosClientId,
  onError,
  onSubmittingChange,
}: GoogleAuthButtonProps) {
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: webClientId,
    webClientId,
    androidClientId,
    iosClientId,
  });

  useEffect(() => {
    if (response?.type !== "success") {
      return;
    }

    if (!auth) {
      onError(firebaseConfigError ?? "Firebase is not configured.");
      return;
    }

    const idToken = response.params.id_token;
    if (!idToken) {
      onError("Google authentication failed. Missing token.");
      return;
    }

    const credential = GoogleAuthProvider.credential(idToken);
    onSubmittingChange(true);
    onError(null);

    void signInWithCredential(auth, credential)
      .then(() => {
        router.replace("/(tabs)");
      })
      .catch((error) => {
        onError(getAuthErrorMessage(error));
      })
      .finally(() => {
        onSubmittingChange(false);
      });
  }, [onError, onSubmittingChange, response]);

  return (
    <Pressable
      style={buttonStyle}
      onPress={() => void promptAsync()}
      disabled={disabled}
    >
      <Ionicons name="logo-google" size={15} color={iconColor} />
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}
