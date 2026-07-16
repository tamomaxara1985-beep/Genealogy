import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/lib/auth";

export default function Profile() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name ?? "—"}</Text>
        <Text style={styles.email}>{user?.email ?? ""}</Text>
        {user?.role === "admin" ? <Text style={styles.role}>Admin</Text> : null}
      </View>
      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 24 },
  card: { gap: 4 },
  name: { fontSize: 24, fontWeight: "700" },
  email: { fontSize: 16, color: "#6b7280" },
  role: { marginTop: 4, color: "#059669", fontWeight: "600" },
  signOut: { borderWidth: 1, borderColor: "#dc2626", padding: 14, borderRadius: 8, alignItems: "center" },
  signOutText: { color: "#dc2626", fontWeight: "600" },
});
