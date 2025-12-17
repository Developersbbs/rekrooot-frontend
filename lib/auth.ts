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
  created_at?: string;
  updated_at?: string;
};

export async function loginWithEmailPasswordStrict(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  const token = await cred.user.getIdToken();

  // strict provisioning: backend decides if user exists in Mongo
  const me = await apiFetch<{ user: AppUser }>("/auth/me", { token });

  return { token, user: me.user };
}

export function isNotProvisionedError(err: unknown) {
  return err instanceof ApiError && err.status === 403;
}