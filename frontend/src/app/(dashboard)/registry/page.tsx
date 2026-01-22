"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useHeader } from "@/lib/HeaderContext";
import { Button } from "@/components/ui/button";
import { StringTile, StringTileData } from "@/components/StringTile";
import { StyleGuideModal } from "@/components/StyleGuideModal";
import { BookOpen, FileText } from "lucide-react";
import { toast } from "sonner";

interface RegistryString extends StringTileData {
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
  const [isStyleGuideOpen, setIsStyleGuideOpen] = useState(false);

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
              <Button
                variant="outline"
                onClick={() => setIsStyleGuideOpen(true)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Style Guide
              </Button>
            </div>

            <div className="grid gap-4">
              {registryStrings.map((registryString) => (
                <StringTile
                  key={registryString.id}
                  string={registryString}
                  showDisplayName={true}
                  showVariableHash={true}
                  showProjectSource={true}
                  showCopyButton={true}
                  onCopy={() => {
                    const ref = `{{${registryString.effective_variable_name}}}`;
                    navigator.clipboard.writeText(ref);
                    toast.success(`Copied ${ref} to clipboard`);
                  }}
                  showActionsMenu={true}
                  onFocus={() => router.push(`/registry/focus/${registryString.id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Style Guide Modal */}
      <StyleGuideModal
        isOpen={isStyleGuideOpen}
        onClose={() => setIsStyleGuideOpen(false)}
      />
    </main>
  );
}
