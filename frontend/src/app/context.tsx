import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post, ApiError } from "../lib/api";
import { cachedUser, cacheUser } from "../lib/offline";
import type { Config, User } from "../types";
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  reload: () => Promise<unknown>;
}>({
  user: null,
  loading: true,
  login: async () => {
    throw Error();
  },
  register: async () => {
    throw Error();
  },
  logout: async () => {},
  reload: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const {
    data: user,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["auth"],
    networkMode: "always",
    queryFn: async () => {
      if (!navigator.onLine) return cachedUser();
      try {
        const u = await api<User>("/auth/me");
        await cacheUser(u);
        return u;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await cacheUser(null);
          return null;
        }
        // Cached identity opens local drafts when the Wi-Fi server is unreachable.
        // The server still authorizes every write.
        if (e instanceof TypeError) return cachedUser();
        throw e;
      }
    },
    retry: false,
    staleTime: 60000,
  });
  const accept = async (u: User) => {
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
    client.setQueryData(["auth"], u);
    await cacheUser(u);
    return u;
  };
  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        loading: isPending,
        login: async (email, password) =>
          accept(await post<User>("/auth/login", { email, password })),
        register: async (name, email, password) =>
          accept(await post<User>("/auth/register", { name, email, password })),
        logout: async () => {
          await post("/auth/logout");
          await cacheUser(null);
          client.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
          client.setQueryData(["auth"], null);
        },
        reload: refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export const useConfig = () =>
  useQuery({
    queryKey: ["config"],
    queryFn: () => api<Config>("/config"),
    staleTime: 60000,
  });
export const useOnline = () => {
  const [online, set] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => set(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
};
export function useLiveUpdates() {
  const client = useQueryClient();
  useEffect(() => {
    const source = new EventSource(
      (import.meta.env.VITE_API_BASE_URL || "") + "/api/v1/hazards/stream",
      { withCredentials: true },
    );
    const update = () => {
      void client.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] !== "auth" && q.queryKey[0] !== "config",
      });
    };
    source.addEventListener("reports", update);
    const poll = setInterval(update, 60000);
    return () => {
      source.close();
      clearInterval(poll);
    };
  }, [client]);
}
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, set] = useState<
    { id: number; text: string; error: boolean }[]
  >([]);
  const toast = (text: string, error = false) => {
    const id = Date.now() + Math.random();
    set((t) => [...t.slice(-3), { id, text, error }]);
    setTimeout(() => set((t) => t.filter((x) => x.id !== id)), 6000);
  };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={"toast " + (t.error ? "error" : "")}>
            {t.text}
            <button
              aria-label="Dismiss notification"
              onClick={() => set((a) => a.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
