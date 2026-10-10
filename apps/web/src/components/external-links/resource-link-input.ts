export type ResourceLinkInput = {
  url: string;
  title?: string;
};

export type DraftResourceLink = ResourceLinkInput & { id: string };
