import { Dialog, DialogPopup } from "@/components/ui/dialog";

export type AgentPreviewImage = { src: string; name: string };

type AgentImagePreviewProps = {
  image: AgentPreviewImage | null;
  onClose: () => void;
};

// Same presentation as image previews in task descriptions and comments.
export function AgentImagePreview({ image, onClose }: AgentImagePreviewProps) {
  return (
    <Dialog
      open={Boolean(image)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup
        className="max-w-6xl border-0 bg-transparent p-0 shadow-none before:hidden"
        showCloseButton={false}
        bottomStickOnMobile={false}
      >
        {image && (
          <div className="flex max-h-[90vh] items-center justify-center p-4">
            <img
              src={image.src}
              alt={image.name}
              className="max-h-[85vh] max-w-[92vw] rounded-xl border border-white/12 bg-black/30 object-contain shadow-2xl"
            />
          </div>
        )}
      </DialogPopup>
    </Dialog>
  );
}
