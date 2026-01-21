"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useHeader } from "@/lib/HeaderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

interface RegistryString {
  id: number;
  content: string;
  display_name: string | null;
  variable_name: string | null;
  variable_hash: string;
  effective_variable_name: string;
  project_id: number;
  project_name: string;
  created_at: string;
  updated_at: string;
}

export default function RegistryPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const router = useRouter();
  const { setPageInfo } = useHeader();
  const [registryStrings, setRegistryStrings] = useState<RegistryString[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set page info in header for breadcrumb
  useEffect(() => {
    setPageInfo({ name: "Registry" });
    
    // Clear page info when leaving the page
    return () => {
      setPageInfo(null);
    };
  }, [setPageInfo]);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    fetchRegistryStrings();
  }, [isLoggedIn, authLoading, router]);

  async function fetchRegistryStrings() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/registry/");
      setRegistryStrings(data);
    } catch (err: any) {
      setError(err.message || "Failed to load registry");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-background">
      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-muted-foreground">Loading registry...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-red-500">{error}</div>
          </div>
        ) : registryStrings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">
              No published strings yet
            </h2>
            <p className="text-muted-foreground max-w-md">
              Publish strings from your projects to see them here. Published strings
              help maintain consistency across your organization.
            </p>
            <Link href="/" className="mt-6">
              <Button>Go to Projects</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                {registryStrings.length} published string{registryStrings.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="grid gap-4">
              {registryStrings.map((registryString) => (
                <Card key={registryString.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Display name or variable name */}
                      <div className="flex items-center gap-2 mb-2">
                        {registryString.display_name && (
                          <span className="font-medium text-foreground">
                            {registryString.display_name}
                          </span>
                        )}
                        <code className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          {`{{${registryString.effective_variable_name}}}`}
                        </code>
                      </div>

                      {/* Content with variable placeholders */}
                      <p className="text-foreground whitespace-pre-wrap break-words">
                        {registryString.content || (
                          <span className="text-muted-foreground italic">No content</span>
                        )}
                      </p>

                      {/* Project source */}
                      <div className="mt-3 text-xs text-muted-foreground">
                        From project:{" "}
                        <Link
                          href={`/projects/${registryString.project_id}`}
                          className="hover:underline text-primary"
                        >
                          {registryString.project_name}
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
