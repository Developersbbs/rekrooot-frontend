import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary" />
            <span className="font-semibold">Rekrooot Admin</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Login</Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border bg-card p-3">
          <div className="text-sm font-medium mb-3">Menu</div>
          <div className="space-y-1">
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/admin">Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start">
              <Link href="/admin/users">Users</Link>
            </Button>
          </div>
        </aside>

        <main className="rounded-xl border bg-card p-6">{children}</main>
      </div>
    </div>
  );
}
