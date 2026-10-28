import type { Editor } from "@tiptap/react";
import { Check, Link2, Unlink } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { normalizeLinkHref } from "./normalize-link-href";

type BubbleLinkEditorProps = {
  editor: Editor;
  buttonClassName: string;
  onClose: () => void;
};

export function BubbleLinkEditor({
  editor,
  buttonClassName,
  onClose,
}: BubbleLinkEditorProps) {
  const { t } = useTranslation();
  const currentHref = (editor.getAttributes("link").href as string) ?? "";
  const [value, setValue] = useState(currentHref);

  const finish = (href: string) => {
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    onClose();
  };

  return (
    <div className="flex items-center gap-1 ps-2">
      <Link2
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <input
        autoFocus
        type="text"
        inputMode="url"
        value={value}
        aria-label={t("common:editor.link.label")}
        placeholder={t("common:editor.link.placeholder")}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finish(normalizeLinkHref(value));
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            editor.commands.focus();
            onClose();
          }
        }}
        className="h-7 w-56 min-w-0 bg-transparent px-1 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Button
        type="button"
        variant="ghost"
        size="xs"
        aria-label={t("common:editor.link.apply")}
        className={buttonClassName}
        onClick={() => finish(normalizeLinkHref(value))}
      >
        <Check className="size-3.5" />
      </Button>
      {currentHref && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={t("common:editor.link.remove")}
          className={buttonClassName}
          onClick={() => finish("")}
        >
          <Unlink className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
