import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export function CopyUrlButton() {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("URL copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy URL:", error);
      toast.error("Failed to copy URL");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopyUrl}
      className="h-8 gap-2"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          <span className="text-xs">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span className="text-xs">Share</span>
        </>
      )}
    </Button>
  );
}
