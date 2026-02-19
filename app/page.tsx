"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Snowfall from "../components/Snowfall";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { isNotProvisionedError, loginWithEmailPasswordStrict, forgotPassword } from "@/lib/auth";
import Image from "next/image";


export default function Home() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { theme, setTheme } = useTheme();

  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");


  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      router.push("/admin");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResetMessage("");

    try {
      const { user } = await loginWithEmailPasswordStrict(email, password);
      console.log("Logged in provisioned user:", user);

      // Map numeric role to string
      const roleMap: Record<number, string> = {
        0: 'SuperAdmin',
        1: 'Recruiter Admin',
        2: 'Lead Recruiter',
        3: 'Recruiter'
      };

      const mappedRole = typeof user.role === 'number' ? roleMap[user.role] : user.role;

      // Prepare company data
      let company = null;
      if (user.company_id && typeof user.company_id === 'object') {
        company = {
          id: user.company_id._id,
          name: user.company_id.name
        };
      } else if (user.company_id) {
        company = { id: user.company_id, name: 'My Company' };
      }

      // Set userData cookie
      const userData = {
        name: user.username || user.display_name || user.email?.split('@')[0],
        email: user.email,
        role: mappedRole,
        company: company
      };

      const cookieValue = JSON.stringify(userData);
      document.cookie = `userData=${encodeURIComponent(cookieValue)}; path=/; max-age=86400`; // 1 day

      router.push("/admin");
    } catch (err: any) {
      if (isNotProvisionedError(err)) {
        setError("Your account is not provisioned. Please contact the administrator.");
      } else {
        setError(err?.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError("");
    setResetMessage("");

    try {
      await forgotPassword(email);
      setResetMessage("Password reset email sent! Please check your inbox.");
    } catch (err: any) {
      setError(err?.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div
      style={{
        backgroundImage:
          "url('https://firebasestorage.googleapis.com/v0/b/x-talento-new.appspot.com/o/assets%2Fsnowbg.webp?alt=media&token=1b3474b8-c42e-4792-a803-594d6d3ad954')",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
      className="w-full h-screen relative flex items-center justify-center px-4"
    >
      {/* Snowfall overlay */}
      <Snowfall />

      <div className="absolute top-4 right-4">
        <Button className="bg-background dark:bg-background/80" variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <SunIcon className="rotate-90 scale-0 transition-transform ease-in-out duration-500 dark:rotate-0 dark:scale-100" />
          <MoonIcon className="absolute w-3 h-3 rotate-0 scale-100 transition-transform ease-in-out duration-500 dark:-rotate-90 dark:scale-0" />
        </Button>
      </div>



      {/* Centered login card */}
      <Card className="relative z-10 w-full max-w-md bg-background/90 backdrop-blur border border-border shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <Image
            src="/assets/logo/logo-small.png"
            alt="Rekrooot Logo"
            width={100}
            height={100}
            className="mx-auto"
          />
          <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
          <CardDescription>Sign in to continue to Rekrooot.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : null}
            {resetMessage ? (
              <div className="text-sm text-green-500">{resetMessage}</div>
            ) : null}
            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
