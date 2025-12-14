import { AlertTriangle, Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

type ApiKeyCreatedModalProps = {
  apiKey: string;
  keyName: string;
  open: boolean;
  onClose: () => void;
};

export function ApiKeyCreatedModal({
  apiKey,
  keyName,
  open,
  onClose,
}: ApiKeyCreatedModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success("API key copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[446px]">
        <DialogHeader>
          <DialogTitle>API Key Created</DialogTitle>
          <DialogDescription>
            Your API key{" "}
            <span className="font-medium text-foreground">"{keyName}"</span> has
            been created successfully.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Copy this key now. You won't be able to see it again.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Your API Key</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 gap-1.5 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="bg-sidebar border border-border rounded-sm p-2.5 max-h-24 overflow-y-auto">
              <code className="text-xs font-mono text-foreground break-all leading-relaxed">
                {apiKey}
              </code>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            onClick={onClose}
            disabled={!copied}
            className="h-8 text-xs w-full sm:w-auto"
          >
            {copied ? "Done" : "Copy key to continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
