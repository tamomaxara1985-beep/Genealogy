import useSWR from "swr";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { IPerson } from "@/types";
import { Screen } from "@/components/Screen";

export default function TreeDetail() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<IPerson[]>(
    treeId ? `/api/trees/${treeId}/persons` : null
  );

  return (
    <Screen
      loading={isLoading}
      error={error}
      onRetry={() => mutate()}
      empty={!isLoading && !error && (data?.length ?? 0) === 0}
      emptyText="No people in this tree"
    >
      <FlatList
        data={data ?? []}
        keyExtractor={(p) => p._id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => mutate()} />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/person/${item._id}`)}>
            <Text style={styles.name}>
              {[item.firstName, item.lastName].filter(Boolean).join(" ") || "Unnamed"}
            </Text>
            <Text style={styles.sub}>
              {[item.birthDate, item.birthPlace].filter(Boolean).join(" · ")}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  name: { fontSize: 16, fontWeight: "600" },
  sub: { color: "#6b7280", marginTop: 2 },
});
