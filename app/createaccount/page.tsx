"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Snowfall from "../../components/Snowfall";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, deleteUser, signOut, updateProfile } from "firebase/auth";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";

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
  const { theme, setTheme } = useTheme();
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
      className="w-full min-h-screen relative flex items-center justify-center px-4"
    >
      <Snowfall />

      <div className="absolute top-4 right-4">
        <Button
          className="bg-background dark:bg-background/80"
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <SunIcon className="rotate-90 scale-0 transition-transform ease-in-out duration-500 dark:rotate-0 dark:scale-100" />
          <MoonIcon className="absolute w-3 h-3 rotate-0 scale-100 transition-transform ease-in-out duration-500 dark:-rotate-90 dark:scale-0" />
        </Button>
      </div>

      <Card className="relative z-10 w-full max-w-md bg-background/95 backdrop-blur-md border border-border shadow-2xl overflow-hidden">
        <CardHeader className="space-y-4 text-center pt-8">
          <div className="mx-auto relative w-24 h-12 flex items-center justify-center">
            <Image
              src="/assets/logo/logo.png"
              alt="Rekrooot Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Create account</CardTitle>
            <CardDescription className="text-muted-foreground">Fill in your details to join the recruitment team.</CardDescription>
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
                  try {
                    await signOut(auth);
                  } catch {
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
            <div className="space-y-2 text-left">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                disabled={isLoadingInvite || !invitation || isSubmitting}
              />
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} placeholder="you@example.com" disabled={true} />
            </div>

            <div className="space-y-2 text-left">
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

            <div className="space-y-2 text-left">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  disabled={isLoadingInvite || !invitation || isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  disabled={isLoadingInvite || !invitation || isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <Button
                type="submit"
                className="w-full text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-11 disabled:opacity-50 disabled:bg-primary"
                disabled={!canSubmit}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating account...</span>
                  </div>
                ) : (
                  "Create account"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </div>

            {error ? (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive text-center">
                {error}
              </div>
            ) : isLoadingInvite ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Validating invitation...
              </div>
            ) : invitation ? (
              <div className="text-xs text-muted-foreground text-center bg-muted/50 py-2 rounded-md">
                You are invited to join <span className="font-semibold text-foreground">{invitation.company_name || "the company"}</span>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* Footer Branding */}
      <div className="absolute bottom-8 left-0 right-0 text-center z-10">
        <p className="text-xs text-white/50 font-medium tracking-widest uppercase">
          Powered by Rekrooot Recruitment Platform
        </p>
      </div>
    </div>
  );
}