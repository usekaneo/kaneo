import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import useCreateApiKey from "@/hooks/mutations/api-key/use-create-api-key";
import type { CreateApiKeyResponse } from "@/types/api-key";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const EXPIRATION_OPTIONS = [
  {
    label: "1 day",
    value: "86400",
  },
  {
    label: "7 days",
    value: "604800",
  },
  {
    label: "30 days",
    value: "2592000",
  },
  {
    label: "90 days",
    value: "7776000",
  },
  {
    label: "Never",
    value: "never",
  },
];

const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .min(3, "Name must be at least 3 characters"),
  expiresIn: z.string().min(1, "Expiration is required"),
});

type FormValues = z.infer<typeof createApiKeySchema>;

type CreateApiKeyDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: CreateApiKeyResponse) => void;
};

export function CreateApiKeyDialog({
  open,
  onClose,
  onSuccess,
}: CreateApiKeyDialogProps) {
  const { mutateAsync: createApiKey } = useCreateApiKey();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(createApiKeySchema),
    defaultValues: {
      name: "",
      expiresIn: "2592000",
    },
  });

  const onSubmit = async (data: FormValues) => {
    const expiresInValue =
      data.expiresIn === "never" ? null : Number.parseInt(data.expiresIn, 10);

    setIsSubmitting(true);
    try {
      const result = await createApiKey({
        name: data.name,
        expiresIn: Number.isNaN(expiresInValue) ? null : expiresInValue,
      });

      form.reset();
      onSuccess(result);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create API key",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Create a new API key to access the Kaneo API programmatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 px-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My API Key"
                      {...field}
                      disabled={isSubmitting}
                      className="h-8 text-sm"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    A descriptive name for this API key
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiresIn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Expiration</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select expiration" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPIRATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription className="text-xs">
                    Choose how long this API key should remain valid. Never will
                    create a key without an automatic expiry.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-8 text-xs"
              >
                {isSubmitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
