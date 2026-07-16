import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [ready, setReady] = useState(false);
  const { mutate } = useSWRConfig();
  const userRef = useRef<MobileUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    // Restore session on launch: a stored token implies a stored user.
    (async () => {
      const token = await tokenStore.get();
      const raw = token ? await tokenStore.getUser() : null;
      if (token && raw) setUser(JSON.parse(raw));
      setReady(true);
    })();
    const off = onUnauthorized(() => {
      if (userRef.current) void signOut();
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
    await tokenStore.setUser(JSON.stringify(res.user));
    setUser(res.user);
  }

  function signOut() {
    void tokenStore.clear();
    void tokenStore.clearUser();
    void mutate(() => true, undefined, { revalidate: false });
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
