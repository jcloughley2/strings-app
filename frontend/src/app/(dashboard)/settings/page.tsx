"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useHeader } from "@/lib/HeaderContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { User, Sparkles } from "lucide-react";

type SettingsTab = "account" | "ai-features";

export default function SettingsPage() {
  const { isLoggedIn, loading: authLoading, username, email } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setPageInfo } = useHeader();
  
  // Get initial tab from URL or default to "account"
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabParam === "ai-features" ? "ai-features" : "account"
  );

  // Set page info in header for breadcrumb
  useEffect(() => {
    setPageInfo({ name: "User Settings" });
    
    return () => {
      setPageInfo(null);
    };
  }, [setPageInfo]);

  // Redirect if not logged in
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, authLoading, router]);

  // Update URL when tab changes
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    router.push(`/settings?tab=${tab}`, { scroll: false });
  };

  if (authLoading || !isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Left Sidebar */}
      <aside className="w-64 border-r bg-muted/20 p-4">
        <nav className="space-y-1">
          <button
            onClick={() => handleTabChange("account")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "account"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <User className="h-4 w-4" />
            Account
          </button>
          <button
            onClick={() => handleTabChange("ai-features")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "ai-features"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            AI Features
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {activeTab === "account" && (
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold mb-6">Account Settings</h1>
            
            <Card className="p-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your username cannot be changed.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Contact support to change your email address.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 mt-6">
              <h2 className="text-lg font-semibold mb-4">Password</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Change your password to keep your account secure.
              </p>
              <Button variant="outline" disabled>
                Change Password
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Password change coming soon.
              </p>
            </Card>
          </div>
        )}

        {activeTab === "ai-features" && (
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold mb-6">AI Features</h1>
            
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">AI-Powered Features</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    AI features are coming soon to help you create better strings, 
                    suggest variations, and maintain consistency across your organization.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• AI-generated string suggestions</li>
                    <li>• Tone and style analysis</li>
                    <li>• Automatic translation assistance</li>
                    <li>• Content quality scoring</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card className="p-6 mt-6 border-dashed">
              <p className="text-sm text-muted-foreground text-center">
                Stay tuned for AI features in a future update.
              </p>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
