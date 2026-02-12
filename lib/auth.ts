import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";
import { apiFetch, ApiError } from "./api";

export type RoleType = 0 | 1 | 2 | 3;

export type AppUser = {
  _id: string;
  username: string;
  email: string;
  firebase_uid: string;
  role: RoleType;
  is_active: boolean;
  company_id?: string | { _id: string; name: string };
  display_name?: string;
  created_at?: string;
  updated_at?: string;
};

export async function loginWithEmailPasswordStrict(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  const token = await cred.user.getIdToken();

  // optional convenience for client-side redirects
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token);
  }

  // strict provisioning: backend decides if user exists in Mongo
  const me = await apiFetch<{ user: AppUser }>("/auth/me", { token });

  return { token, user: me.user };
}

export async function logout() {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      await apiFetch<{ message: string }>("/auth/logout", {
        method: "POST",
        token,
      });
    }
  } catch {
    // Best-effort: even if backend revoke fails, we still sign out locally.
  } finally {
    try {
      await auth.signOut();
    } catch {
      // ignore
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("theme");
      sessionStorage.clear();

      // Clear cookies (simple sweep)
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    }
  }
}

export function isNotProvisionedError(err: unknown) {
  return err instanceof ApiError && err.status === 403;
}