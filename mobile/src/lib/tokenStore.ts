import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "genealogy_token";
const USER_KEY = "genealogy_user";

// expo-secure-store has no web implementation. On web fall back to
// localStorage; on native use the encrypted keychain/keystore.
const isWeb = Platform.OS === "web";

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStore = {
  get: () => getItem(TOKEN_KEY),
  set: (token: string) => setItem(TOKEN_KEY, token),
  clear: () => removeItem(TOKEN_KEY),
  getUser: () => getItem(USER_KEY),
  setUser: (user: string) => setItem(USER_KEY, user),
  clearUser: () => removeItem(USER_KEY),
};
