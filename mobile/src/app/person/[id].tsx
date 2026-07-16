import { useState } from "react";
import useSWR from "swr";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { IPerson, IEvent } from "@/types";
import { Screen } from "@/components/Screen";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const person = useSWR<IPerson>(id ? `/api/persons/${id}` : null);
  const events = useSWR<IEvent[]>(id ? `/api/persons/${id}/events` : null);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const p = person.data;

  async function contactOwner() {
    if (!p) return;
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Both subject and message are required.");
      return;
    }
    setSending(true);
    try {
      await api.request(`/api/trees/${p.treeId}/contact-owner`, {
        method: "POST",
        body: JSON.stringify({ subject, message }),
      });
      setSubject("");
      setMessage("");
      Alert.alert("Message sent to the tree owner.");
    } catch (e) {
      Alert.alert(e instanceof ApiError ? e.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen loading={person.isLoading} error={person.error} onRetry={() => person.mutate()}>
      {p ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>
            {[p.firstName, p.lastName].filter(Boolean).join(" ") || "Unnamed"}
          </Text>
          <Field label="Born" value={[p.birthDate, p.birthPlace].filter(Boolean).join(" · ")} />
          <Field label="Died" value={[p.deathDate, p.deathPlace].filter(Boolean).join(" · ")} />
          <Field label="Maiden name" value={p.maidenName} />
          <Field label="Notes" value={p.notes} />
          <Field label="Bio" value={p.bio} />

          <Text style={styles.section}>Events</Text>
          {events.isLoading ? (
            <Text style={styles.muted}>Loading events…</Text>
          ) : (events.data?.length ?? 0) === 0 ? (
            <Text style={styles.muted}>No events</Text>
          ) : (
            events.data!.map((e) => (
              <View key={e._id} style={styles.event}>
                <Text style={styles.eventType}>{e.type}</Text>
                <Text style={styles.muted}>
                  {[e.date, e.place].filter(Boolean).join(" · ")}
                </Text>
                {e.description ? <Text>{e.description}</Text> : null}
              </View>
            ))
          )}

          <Text style={styles.section}>Contact tree owner</Text>
          <TextInput
            style={styles.input}
            placeholder="Subject"
            value={subject}
            onChangeText={setSubject}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Message"
            multiline
            value={message}
            onChangeText={setMessage}
          />
          <Pressable
            style={[styles.button, sending && { opacity: 0.6 }]}
            onPress={contactOwner}
            disabled={sending}
          >
            <Text style={styles.buttonText}>{sending ? "Sending…" : "Send message"}</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 8 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  field: { marginBottom: 4 },
  fieldLabel: { fontSize: 12, color: "#6b7280", textTransform: "uppercase" },
  fieldValue: { fontSize: 16 },
  section: { fontSize: 18, fontWeight: "600", marginTop: 20, marginBottom: 8 },
  event: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e5e7eb" },
  eventType: { fontWeight: "600", textTransform: "capitalize" },
  muted: { color: "#6b7280" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 16 },
  multiline: { height: 100, textAlignVertical: "top" },
  button: { backgroundColor: "#059669", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
