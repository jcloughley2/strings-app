"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, ImageIcon, AlertCircle, CheckCircle, X } from "lucide-react";

interface ImageToTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (text: string) => void;
}

export function ImageToTextModal({ isOpen, onClose, onAccept }: ImageToTextModalProps) {
  const [isOpenAIConfigured, setIsOpenAIConfigured] = useState<boolean | null>(null);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if OpenAI is configured when modal opens
  useEffect(() => {
    if (isOpen) {
      checkOpenAIConfig();
    }
  }, [isOpen]);

  const checkOpenAIConfig = async () => {
    setIsCheckingConfig(true);
    try {
      const data = await apiFetch("/api/settings/openai/check/");
      setIsOpenAIConfigured(data.configured);
    } catch (error) {
      console.error("Failed to check OpenAI config:", error);
      setIsOpenAIConfigured(false);
    } finally {
      setIsCheckingConfig(false);
    }
  };

  const resetState = useCallback(() => {
    setSelectedImage(null);
    setSelectedFileName(null);
    setExtractedText(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError(null);
    setExtractedText(null);
    setSelectedFileName(file.name);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleExtract = async () => {
    if (!selectedImage) return;

    setIsExtracting(true);
    setError(null);

    try {
      const data = await apiFetch("/api/ai/extract-text/", {
        method: "POST",
        body: JSON.stringify({ image: selectedImage }),
      });

      if (data.success) {
        setExtractedText(data.text);
      } else {
        setError(data.error || "Failed to extract text");
      }
    } catch (error: any) {
      setError(error.message || "Failed to extract text from image");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAccept = useCallback(() => {
    if (extractedText) {
      onAccept(extractedText);
      handleClose();
    }
  }, [extractedText, onAccept, handleClose]);

  const handleTryAnother = useCallback(() => {
    resetState();
    fileInputRef.current?.click();
  }, [resetState]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Extract Text from Image
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Loading state while checking config */}
          {isCheckingConfig && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* OpenAI not configured */}
          {!isCheckingConfig && !isOpenAIConfigured && (
            <div className="text-center py-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-medium mb-2">AI Features Not Configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                To use image text extraction, you need to connect your OpenAI account.
              </p>
              <Button variant="outline" asChild>
                <a href="/settings?tab=ai-features">Go to AI Settings</a>
              </Button>
            </div>
          )}

          {/* OpenAI configured - show upload UI */}
          {!isCheckingConfig && isOpenAIConfigured && (
            <>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* No image selected - show upload area */}
              {!selectedImage && !extractedText && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                >
                  <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Click to upload an image</p>
                  <p className="text-sm text-muted-foreground">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              )}

              {/* Image selected - show preview and extract button */}
              {selectedImage && !extractedText && (
                <div className="space-y-4">
                  <div className="relative border rounded-lg overflow-hidden">
                    <img
                      src={selectedImage}
                      alt="Selected"
                      className="w-full max-h-64 object-contain bg-muted"
                    />
                    <button
                      onClick={resetState}
                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground text-center truncate">
                    {selectedFileName}
                  </p>
                  <Button
                    onClick={handleExtract}
                    disabled={isExtracting}
                    className="w-full"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Extracting text...
                      </>
                    ) : (
                      "Extract Text"
                    )}
                  </Button>
                </div>
              )}

              {/* Text extracted - show preview */}
              {extractedText && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Text extracted successfully</span>
                  </div>
                  <div className="border rounded-lg p-4 bg-muted/30 max-h-64 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{extractedText}</p>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with actions */}
        {!isCheckingConfig && isOpenAIConfigured && (
          <DialogFooter className="flex gap-2 sm:gap-0">
            {extractedText ? (
              <>
                <Button variant="outline" onClick={handleTryAnother}>
                  Try Another Image
                </Button>
                <Button onClick={handleAccept}>
                  Use This Text
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        )}

        {/* Footer for not configured state */}
        {!isCheckingConfig && !isOpenAIConfigured && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
