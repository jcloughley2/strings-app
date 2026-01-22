"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, BookOpen, AlertCircle } from "lucide-react";

interface StyleGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StyleGuideModal({ isOpen, onClose }: StyleGuideModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [styleGuide, setStyleGuide] = useState<string | null>(null);
  const [generatedDate, setGeneratedDate] = useState<string | null>(null);
  const [stringsAnalyzed, setStringsAnalyzed] = useState<number>(0);
  const [isOpenAIConfigured, setIsOpenAIConfigured] = useState<boolean | null>(null);

  // Check if OpenAI is configured when modal opens
  useEffect(() => {
    if (isOpen) {
      checkOpenAIConfig();
    }
  }, [isOpen]);

  const checkOpenAIConfig = async () => {
    try {
      const data = await apiFetch("/api/settings/openai/check/");
      setIsOpenAIConfigured(data.configured);
    } catch (err) {
      setIsOpenAIConfigured(false);
    }
  };

  const handleGenerateStyleGuide = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await apiFetch("/api/ai/style-guide/", {
        method: "POST",
      });

      if (data.success) {
        setStyleGuide(data.style_guide);
        setGeneratedDate(data.generated_date);
        setStringsAnalyzed(data.strings_analyzed);
      } else {
        setError(data.error || "Failed to generate style guide");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate style guide");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Don't reset the style guide so it persists if user reopens
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Style Guide
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Not configured state */}
          {isOpenAIConfigured === false && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">OpenAI Not Connected</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Connect your OpenAI API key in Settings to generate a style guide
                based on your registered strings.
              </p>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          )}

          {/* Initial state - no guide generated yet */}
          {isOpenAIConfigured === true && !styleGuide && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Generate Your Style Guide</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Analyze your published registry strings to create a comprehensive
                style guide covering tone, vocabulary, brevity, and language patterns.
              </p>
              <Button onClick={handleGenerateStyleGuide} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Style Guide"
                )}
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">
                Analyzing your strings and generating style guide...
              </p>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-red-500/50 mb-4" />
              <h3 className="text-lg font-medium text-red-600 mb-2">
                Generation Failed
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
              <Button onClick={handleGenerateStyleGuide} variant="outline">
                Try Again
              </Button>
            </div>
          )}

          {/* Style guide content */}
          {styleGuide && !isLoading && (
            <div className="space-y-4">
              {/* Header with date and regenerate */}
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="text-sm text-muted-foreground">
                  Generated on {generatedDate} • Based on {stringsAnalyzed} strings
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateStyleGuide}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                  Regenerate
                </Button>
              </div>

              {/* Style guide content - render markdown-like content */}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {styleGuide.split("\n").map((line, index) => {
                  // Handle headers
                  if (line.startsWith("# ")) {
                    return (
                      <h1 key={index} className="text-xl font-bold mt-6 mb-3">
                        {line.replace("# ", "")}
                      </h1>
                    );
                  }
                  if (line.startsWith("## ")) {
                    return (
                      <h2 key={index} className="text-lg font-semibold mt-5 mb-2">
                        {line.replace("## ", "")}
                      </h2>
                    );
                  }
                  if (line.startsWith("### ")) {
                    return (
                      <h3 key={index} className="text-base font-semibold mt-4 mb-2">
                        {line.replace("### ", "")}
                      </h3>
                    );
                  }
                  // Handle bold text with **
                  if (line.includes("**")) {
                    const parts = line.split(/(\*\*[^*]+\*\*)/g);
                    return (
                      <p key={index} className="mb-2">
                        {parts.map((part, i) => {
                          if (part.startsWith("**") && part.endsWith("**")) {
                            return (
                              <strong key={i}>
                                {part.slice(2, -2)}
                              </strong>
                            );
                          }
                          return part;
                        })}
                      </p>
                    );
                  }
                  // Handle bullet points
                  if (line.startsWith("- ") || line.startsWith("• ")) {
                    return (
                      <li key={index} className="ml-4 mb-1">
                        {line.replace(/^[-•] /, "")}
                      </li>
                    );
                  }
                  // Handle numbered lists
                  if (/^\d+\. /.test(line)) {
                    return (
                      <li key={index} className="ml-4 mb-1 list-decimal">
                        {line.replace(/^\d+\. /, "")}
                      </li>
                    );
                  }
                  // Empty lines
                  if (line.trim() === "") {
                    return <br key={index} />;
                  }
                  // Regular paragraphs
                  return (
                    <p key={index} className="mb-2">
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
