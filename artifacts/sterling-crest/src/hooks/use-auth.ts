import { useState, useEffect } from "react";
import { getUser, isLoggedIn, saveAuth, clearAuth, type User } from "@/lib/auth";
import { connectWS, disconnectWS } from "@/lib/websocket";
import { api } from "@/lib/api";

export function useAuth() {
  const [user, setUser] = useState<User | null>(getUser);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);

  const login = (token: string, user: User) => {
    saveAuth(token, user);
    setUser(user);
    setLoggedIn(true);
    connectWS(token);
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setLoggedIn(false);
    disconnectWS();
  };

  const refresh = async () => {
    try {
      const data = await api.get<{ user: User }>("/users/me");
      const updated = data.user;
      localStorage.setItem("scb_user", JSON.stringify(updated));
      setUser(updated);
    } catch {}
  };

  useEffect(() => {
    const token = localStorage.getItem("scb_token");
    if (token) connectWS(token);
    return () => {};
  }, []);

  return { user, loggedIn, login, logout, refresh };
}
