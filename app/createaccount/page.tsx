"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import Snowfall from "react-snowfall";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, deleteUser, signOut, updateProfile } from "firebase/auth";

type InvitationDto = {
  email: string;
  role: number;
  company_id: string;
  company_name: string | null;
  team_id: string | null;
  expires_at: string;
};

export default function CreateAccount() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [invitation, setInvitation] = useState<InvitationDto | null>(null);
  const [isLoadingInvite, setIsLoadingInvite] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoadingInvite(true);
      setError(null);

      if (!token) {
        setIsLoadingInvite(false);
        setInvitation(null);
        setError("Missing invitation token");
        return;
      }

      try {
        const res = await apiFetch<{ invitation: InvitationDto }>(
          `/invitations/validate?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;

        setInvitation(res.invitation);
        setEmail(res.invitation.email);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to validate invitation");
        setInvitation(null);
      } finally {
        if (!cancelled) setIsLoadingInvite(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const canSubmit = Boolean(
    !isLoadingInvite &&
      invitation &&
      name.trim() &&
      email.trim() &&
      password &&
      confirmPassword &&
      !isSubmitting,
  );

  return (
    <div
      style={{
        backgroundImage:
          "url('https://firebasestorage.googleapis.com/v0/b/x-talento-new.appspot.com/o/assets%2Fsnowbg.webp?alt=media&token=1b3474b8-c42e-4792-a803-594d6d3ad954')",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
      className="w-full min-h-screen relative"
    >
      <Button>
        
      </Button>
      <div className="w-full min-h-screen bg-background/90 relative flex items-center justify-center p-6">
        <Snowfall />

        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-center">
              <Image
                src="https://firebasestorage.googleapis.com/v0/b/x-talento-new.appspot.com/o/assets%2Flogo.png?alt=media&token=0e681b04-04b6-4ebc-855e-dfcc3f9acabe"
                alt="Rekrooot"
                width={170}
                height={36}
                priority
              />
            </div>
            <div className="text-center space-y-1">
              <CardTitle className="text-2xl">Create account</CardTitle>
              <CardDescription>Fill in your details to get started.</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (isSubmitting) return;
                setError(null);

                if (!token) {
                  setError("Missing invitation token");
                  return;
                }

                if (!invitation) {
                  setError("Invalid invitation");
                  return;
                }

                if (password !== confirmPassword) {
                  setError("Passwords do not match");
                  return;
                }

                setIsSubmitting(true);
                try {
                  let createdFirebaseUser: typeof auth.currentUser | null = null;

                  try {
                    // Ensure we are not still signed in as another user (e.g. SUPER_ADMIN)
                    // which can cause /invitations/accept to be called with the wrong uid.
                    try {
                      await signOut(auth);
                    } catch {
                      // ignore
                    }

                    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
                    createdFirebaseUser = cred.user;

                    if (name.trim()) {
                      await updateProfile(cred.user, { displayName: name.trim() });
                    }

                    const idToken = await cred.user.getIdToken();
                    await apiFetch<{ user: unknown }>("/invitations/accept", {
                      method: "POST",
                      token: idToken,
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        token,
                        name: name.trim(),
                        contact: contact.trim() || undefined,
                      }),
                    });
                  } catch (innerErr) {
                    // Rollback: if Firebase user was created but backend provisioning failed,
                    // delete the Firebase auth user so retrying works cleanly.
                    if (createdFirebaseUser) {
                      try {
                        await deleteUser(createdFirebaseUser);
                      } catch {
                        // Ignore rollback errors; surface original error.
                      }
                    }
                    throw innerErr;
                  }

                  router.replace("/");
                } catch (err) {
                  if (err instanceof ApiError) {
                    setError(err.message);
                    return;
                  }

                  if (err instanceof Error) {
                    // Firebase auth errors come through as regular Errors with a message.
                    // Provide a friendlier message for the most common case.
                    if (err.message.toLowerCase().includes("email-already-in-use")) {
                      setError("An account with this email already exists. Please login instead.");
                    } else {
                      setError(err.message);
                    }
                    return;
                  }

                  setError("Failed to create account");
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  disabled={isLoadingInvite || !invitation || isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  placeholder="you@example.com"
                  disabled={true}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contact number</Label>
                <Input
                  id="contact"
                  inputMode="tel"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Enter contact number"
                  disabled={isLoadingInvite || !invitation || isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="pr-10"
                    disabled={isLoadingInvite || !invitation || isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="pr-10"
                    disabled={isLoadingInvite || !invitation || isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit}
              >
                {isSubmitting ? "Creating..." : "Create account"}
              </Button>

              {error ? (
                <div className="text-sm text-red-600">{error}</div>
              ) : invitation ? (
                <div className="text-xs text-muted-foreground">
                  Invited to {invitation.company_name || "your company"}
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}