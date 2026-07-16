import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SWRConfig } from "swr";
import { AuthProvider, useAuth } from "@/lib/auth";
import { swrFetcher } from "@/lib/api";

function AuthGate() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === "login";
    if (!user && !inAuthGroup) router.replace("/login");
    else if (user && inAuthGroup) router.replace("/");
  }, [user, ready, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tree/[treeId]" options={{ headerShown: true, title: "Tree" }} />
      <Stack.Screen name="person/[id]" options={{ headerShown: true, title: "Person" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SWRConfig value={{ fetcher: swrFetcher }}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SWRConfig>
  );
}
