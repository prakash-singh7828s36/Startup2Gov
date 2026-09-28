/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import {
  signup as apiSignup,
  login as apiLogin,
  logout as apiLogout,
  getMe as apiGetMe,
} from "../api/authApi.js";
import {
  signup as demoSignup,
  login as demoLogin,
  logout as demoLogout,
  getSessionUser as getDemoSessionUser,
} from "../services/authService.js";
import { DEMO_MODE } from "../services/demoMode.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "s2g_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authenticated session on page reload using verified server JWT
  useEffect(() => {
    async function restoreSession() {
      if (DEMO_MODE) {
        try {
          localStorage.removeItem(TOKEN_KEY);
          setUser(await getDemoSessionUser());
        } catch {
          setUser(null);
        } finally {
          setLoading(false);
        }
        return;
      }

      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const response = await apiGetMe();
        if (response?.user) {
          setUser(response.user);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        }
      } catch (err) {
        // If 401 or token invalid, clear token
        if (err.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  const signup = async (payload) => {
    try {
      if (DEMO_MODE) {
        localStorage.removeItem(TOKEN_KEY);
        const demoUser = await demoSignup(payload);
        setUser(demoUser);
        return demoUser;
      }

      const response = await apiSignup(payload);
      if (response?.token) {
        localStorage.setItem(TOKEN_KEY, response.token);
      }
      setUser(response.user);
      return response.user;
    } catch (err) {
      const message =
        err.response?.data?.message ||
        (Array.isArray(err.response?.data?.errors)
          ? err.response.data.errors[0]
          : null) ||
        err.message ||
        "Signup failed. Please try again.";
      throw new Error(message, { cause: err });
    }
  };

  const login = async (payload) => {
    try {
      if (DEMO_MODE) {
        localStorage.removeItem(TOKEN_KEY);
        const demoUser = await demoLogin(payload);
        setUser(demoUser);
        return demoUser;
      }

      const response = await apiLogin(payload);
      if (response?.token) {
        localStorage.setItem(TOKEN_KEY, response.token);
      }
      setUser(response.user);
      return response.user;
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Login failed. Please check your credentials.";
      throw new Error(message, { cause: err });
    }
  };

  const logout = async () => {
    try {
      if (DEMO_MODE) await demoLogout();
      else await apiLogout();
    } catch {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
