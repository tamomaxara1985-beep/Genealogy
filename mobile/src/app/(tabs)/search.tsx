import { useState } from "react";
import useSWR from "swr";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import type { ISearchResult } from "@/types";
import { Screen } from "@/components/Screen";

interface SearchResponse {
  results: ISearchResult[];
  truncated: boolean;
}

export default function SearchScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");

  const params = new URLSearchParams();
  if (firstName.trim()) params.set("firstName", firstName.trim());
  if (lastName.trim()) params.set("lastName", lastName.trim());
  if (location.trim()) params.set("location", location.trim());
  const query = params.toString();

  // Only search once at least one field is filled.
  const { data, error, isLoading } = useSWR<SearchResponse>(
    query ? `/api/search?${query}` : null
  );

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
      <TextInput style={styles.input} placeholder="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
      <TextInput style={styles.input} placeholder="Place" value={location} onChangeText={setLocation} />

      <View style={styles.results}>
        <Screen
          loading={query ? isLoading : false}
          error={error}
          empty={!!query && !isLoading && !error && (data?.results.length ?? 0) === 0}
          emptyText="No matches"
        >
          {!query ? (
            <Text style={styles.hint}>Enter a name or place to search.</Text>
          ) : (
            <FlatList
              data={data?.results ?? []}
              keyExtractor={(r) => r.personId}
              ListFooterComponent={
                data?.truncated ? <Text style={styles.hint}>Showing first 50 results. Refine your search.</Text> : null
              }
              renderItem={({ item }) => {
                const openable = item.access === "owner" || item.access === "viewer";
                return (
                  <Pressable
                    style={styles.row}
                    onPress={() => openable && router.push(`/person/${item.personId}`)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.personName}</Text>
                      <Text style={styles.sub}>
                        {[item.place, item.treeName, item.ownerName].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Text style={styles.badge}>{item.access}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </Screen>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 16 },
  results: { flex: 1, marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: "600" },
  sub: { color: "#6b7280", marginTop: 2 },
  badge: { fontSize: 12, color: "#059669", fontWeight: "600", textTransform: "capitalize" },
  hint: { color: "#6b7280", padding: 8 },
});
