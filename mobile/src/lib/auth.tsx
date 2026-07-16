import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, onUnauthorized } from "./api";
import { tokenStore } from "./tokenStore";

export interface MobileUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: MobileUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "genealogy_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Restore session on launch: a stored token implies a stored user.
    (async () => {
      const token = await tokenStore.get();
      const raw = token ? await import("expo-secure-store").then((m) => m.getItemAsync(USER_KEY)) : null;
      if (token && raw) setUser(JSON.parse(raw));
      setReady(true);
    })();
    const off = onUnauthorized(() => {
      void signOut();
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(email: string, password: string) {
    const res = await api.request<{ token: string; user: MobileUser }>("/api/mobile/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await tokenStore.set(res.token);
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }

  function signOut() {
    void tokenStore.clear();
    void import("expo-secure-store").then((m) => m.deleteItemAsync(USER_KEY));
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
