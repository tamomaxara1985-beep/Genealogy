import useSWR from "swr";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { ITree } from "@/types";
import { Screen } from "@/components/Screen";

interface TreesResponse {
  owned: ITree[];
  shared: ITree[];
}

export default function Trees() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<TreesResponse>("/api/trees");

  const rows = data
    ? [
        ...data.owned.map((t) => ({ tree: t, role: "Owner" as const })),
        ...data.shared.map((t) => ({ tree: t, role: "Shared" as const })),
      ]
    : [];

  return (
    <Screen
      loading={isLoading}
      error={error}
      onRetry={() => mutate()}
      empty={!isLoading && !error && rows.length === 0}
      emptyText="No trees yet"
    >
      <FlatList
        data={rows}
        keyExtractor={(r) => r.tree._id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => mutate()} />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/tree/${item.tree._id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.tree.name}</Text>
              {item.tree.description ? (
                <Text style={styles.desc} numberOfLines={1}>
                  {item.tree.description}
                </Text>
              ) : null}
            </View>
            <Text style={styles.badge}>{item.role}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: "600" },
  desc: { color: "#6b7280", marginTop: 2 },
  badge: { fontSize: 12, color: "#059669", fontWeight: "600" },
});
