import { useState } from "react";
import useSWR from "swr";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { IAccessRequestView } from "@/types";
import { Screen } from "@/components/Screen";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";

type Tab = "incoming" | "outgoing";

interface RequestsResponse {
  requests: IAccessRequestView[];
}

export default function Requests() {
  const [tab, setTab] = useState<Tab>("incoming");
  const { data, error, isLoading, mutate } = useSWR<RequestsResponse>(
    `/api/access-requests?role=${tab}`
  );

  async function act(id: string, action: "approve" | "deny" | "revoke") {
    try {
      await api.request(`/api/access-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      mutate();
    } catch (e) {
      Alert.alert(e instanceof ApiError ? e.message : "Action failed.");
    }
  }

  async function cancel(id: string) {
    try {
      await api.request(`/api/access-requests/${id}`, { method: "DELETE" });
      mutate();
    } catch (e) {
      Alert.alert(e instanceof ApiError ? e.message : "Could not cancel.");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(["incoming", "outgoing"] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Screen
        loading={isLoading}
        error={error}
        onRetry={() => mutate()}
        empty={!isLoading && !error && (data?.requests.length ?? 0) === 0}
        emptyText={tab === "incoming" ? "No incoming requests" : "No outgoing requests"}
      >
        <FlatList
          data={data?.requests ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.treeName}</Text>
                <Text style={styles.sub}>
                  {item.counterpartyName} · {item.status}
                </Text>
                {item.message ? <Text style={styles.msg}>{item.message}</Text> : null}
              </View>
              <View style={styles.actions}>
                {tab === "incoming" && item.status === "pending" ? (
                  <>
                    <Pressable style={[styles.btn, styles.approve]} onPress={() => act(item.id, "approve")}>
                      <Text style={styles.btnText}>Approve</Text>
                    </Pressable>
                    <Pressable style={[styles.btn, styles.deny]} onPress={() => act(item.id, "deny")}>
                      <Text style={styles.btnText}>Deny</Text>
                    </Pressable>
                  </>
                ) : null}
                {tab === "incoming" && item.status === "approved" ? (
                  <Pressable style={[styles.btn, styles.deny]} onPress={() => act(item.id, "revoke")}>
                    <Text style={styles.btnText}>Revoke</Text>
                  </Pressable>
                ) : null}
                {tab === "outgoing" && item.status === "pending" ? (
                  <Pressable style={[styles.btn, styles.deny]} onPress={() => cancel(item.id)}>
                    <Text style={styles.btnText}>Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: "row", padding: 12, gap: 8 },
  tab: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: "#f3f4f6", alignItems: "center" },
  tabActive: { backgroundColor: "#059669" },
  tabText: { textTransform: "capitalize", color: "#374151", fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  row: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  name: { fontSize: 16, fontWeight: "600" },
  sub: { color: "#6b7280", marginTop: 2, textTransform: "capitalize" },
  msg: { marginTop: 4 },
  actions: { justifyContent: "center", gap: 6 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  approve: { backgroundColor: "#059669" },
  deny: { backgroundColor: "#dc2626" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
