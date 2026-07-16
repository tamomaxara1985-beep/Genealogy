import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

interface ScreenProps {
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: boolean;
  emptyText?: string;
  children?: ReactNode;
}

export function Screen({ loading, error, onRetry, empty, emptyText, children }: ScreenProps) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{message}</Text>
        {onRetry ? (
          <Pressable style={styles.retry} onPress={onRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>{emptyText ?? "Nothing here yet"}</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  error: { color: "#dc2626", textAlign: "center" },
  empty: { color: "#6b7280", textAlign: "center" },
  retry: { backgroundColor: "#059669", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "600" },
});
