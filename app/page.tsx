"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import Snowfall from "../components/Snowfall";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";

export default function Home() {
  const [showPassword, setShowPassword] = useState(false);
  const { theme, setTheme } = useTheme();
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
          <div className="mx-auto mb-1 h-12 w-12 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xl font-bold">R</span>
          </div>
          <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
          <CardDescription>Sign in to continue to Rekrooot.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="pr-10"
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
            <Button type="submit" className="w-full mt-2">
              Log in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
