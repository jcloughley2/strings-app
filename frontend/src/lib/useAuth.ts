"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/auth/me/")
      .then(data => {
        setIsLoggedIn(true);
        setUsername(data.username);
        setEmail(data.email || "");
      })
      .catch(() => {
        setIsLoggedIn(false);
        setUsername("");
        setEmail("");
      })
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    apiFetch("/api/auth/logout/", { method: "POST" }).finally(() => {
      setIsLoggedIn(false);
      setUsername("");
      setEmail("");
      window.location.href = "/login";
    });
  }

  return { isLoggedIn, username, email, logout, loading };
} 