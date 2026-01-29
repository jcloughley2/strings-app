"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { useHeader } from "@/lib/HeaderContext";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { User, Sparkles, Key, CheckCircle, XCircle, Loader2 } from "lucide-react";

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

  // OpenAI settings state
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [saveKeyError, setSaveKeyError] = useState<string | null>(null);
  const [saveKeySuccess, setSaveKeySuccess] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string; joke?: string} | null>(null);

  // Set page info in header for breadcrumb
  useEffect(() => {
    setPageInfo({ name: "User Settings" });
    
    return () => {
      setPageInfo(null);
    };
  }, [setPageInfo]);

  // Fetch OpenAI settings on mount
  const fetchOpenAISettings = useCallback(async () => {
    try {
      const data = await apiFetch("/api/settings/openai/");
      setHasApiKey(data.has_api_key);
      setMaskedKey(data.masked_key);
    } catch (error) {
      console.error("Failed to fetch OpenAI settings:", error);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchOpenAISettings();
    }
  }, [isLoggedIn, fetchOpenAISettings]);

  // Save API key
  const handleSaveApiKey = async () => {
    setIsSavingKey(true);
    setSaveKeyError(null);
    setSaveKeySuccess(false);
    setTestResult(null);

    try {
      const data = await apiFetch("/api/settings/openai/", {
        method: "POST",
        body: JSON.stringify({ api_key: apiKey }),
      });
      
      setHasApiKey(data.has_api_key);
      setMaskedKey(data.masked_key);
      setApiKey(""); // Clear the input
      setSaveKeySuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveKeySuccess(false), 3000);
    } catch (error: any) {
      setSaveKeyError(error.message || "Failed to save API key");
    } finally {
      setIsSavingKey(false);
    }
  };

  // Test OpenAI connection
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const data = await apiFetch("/api/settings/openai/test/", {
        method: "POST",
      });
      
      setTestResult({
        success: true,
        message: data.message,
        joke: data.joke,
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || "Connection test failed",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Clear API key
  const handleClearApiKey = async () => {
    setIsSavingKey(true);
    setSaveKeyError(null);
    setTestResult(null);

    try {
      await apiFetch("/api/settings/openai/", {
        method: "POST",
        body: JSON.stringify({ api_key: "" }),
      });
      
      setHasApiKey(false);
      setMaskedKey(null);
      setApiKey("");
    } catch (error: any) {
      setSaveKeyError(error.message || "Failed to clear API key");
    } finally {
      setIsSavingKey(false);
    }
  };

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
                  <p className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
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
              <p className="text-sm text-muted-foreground mt-2">
                Password change coming soon.
              </p>
            </Card>
          </div>
        )}

        {activeTab === "ai-features" && (
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold mb-6">AI Features</h1>
            
            {/* OpenAI Connection Card */}
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Key className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-2">Connect OpenAI</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your OpenAI account to enable AI-powered features like string suggestions, 
                    tone analysis, and more.
                  </p>

                  {/* Current status */}
                  {hasApiKey && maskedKey && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">API Key Connected</span>
                      </div>
                      <p className="text-xs text-green-600 mt-1 font-mono">{maskedKey}</p>
                    </div>
                  )}

                  {/* API Key Input */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="api-key">
                        {hasApiKey ? "Update API Key" : "OpenAI API Key"}
                      </Label>
                      <Input
                        id="api-key"
                        type="password"
                        placeholder="sk-..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                      <p className="text-sm text-muted-foreground">
                        Get your API key from{" "}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          platform.openai.com/api-keys
                        </a>
                      </p>
                    </div>

                    {/* Error message */}
                    {saveKeyError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 text-red-700">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">{saveKeyError}</span>
                        </div>
                      </div>
                    )}

                    {/* Success message */}
                    {saveKeySuccess && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">API key saved successfully!</span>
                        </div>
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveApiKey}
                        disabled={!apiKey.trim() || isSavingKey}
                      >
                        {isSavingKey && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {hasApiKey ? "Update Key" : "Save Key"}
                      </Button>
                      {hasApiKey && (
                        <Button
                          variant="outline"
                          onClick={handleClearApiKey}
                          disabled={isSavingKey}
                        >
                          Remove Key
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Test Connection Card */}
            <Card className="p-6 mt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-2">Test Connection</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Verify your OpenAI connection is working by requesting a joke.
                  </p>

                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={!hasApiKey || isTestingConnection}
                  >
                    {isTestingConnection && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Tell me a joke
                  </Button>

                  {/* Test result */}
                  {testResult && (
                    <div className={`mt-4 p-4 rounded-md ${
                      testResult.success 
                        ? "bg-green-50 border border-green-200" 
                        : "bg-red-50 border border-red-200"
                    }`}>
                      {testResult.success ? (
                        <>
                          <div className="flex items-center gap-2 text-green-700 mb-2">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Connection successful!</span>
                          </div>
                          <p className="text-sm text-green-800 italic">
                            &ldquo;{testResult.joke}&rdquo;
                          </p>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-red-700">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">{testResult.message}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {!hasApiKey && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Add your API key above to test the connection.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Coming Soon Features */}
            <Card className="p-6 mt-6 border-dashed">
              <h3 className="text-sm font-medium mb-3">Coming Soon</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• AI-generated string suggestions</li>
                <li>• Tone and style analysis</li>
                <li>• Automatic translation assistance</li>
                <li>• Content quality scoring</li>
              </ul>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
