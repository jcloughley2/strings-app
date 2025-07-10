"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";

export function Header() {
  const { isLoggedIn, username, logout, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link href="/" className="text-2xl font-bold tracking-tight">Strings</Link>
      <div className="flex items-center gap-4">
        {loading ? (
          // Show nothing while loading to prevent hydration mismatch
          <div className="w-20 h-9" /> // Placeholder to maintain layout
        ) : isLoggedIn ? (
          <>
            <span className="text-base font-medium text-muted-foreground mr-2">{username}</span>
            <Button variant="secondary" onClick={logout}>Logout</Button>
          </>
        ) : (
          <Button asChild variant="default">
            <Link href="/login">Login</Link>
          </Button>
        )}
      </div>
    </header>
  );
} 