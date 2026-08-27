import { createFileRoute } from "@tanstack/react-router";
import { Building2, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFrame,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClientPartnerInput } from "@/fetchers/client/client-api";
import {
  useClients,
  useCreateClient,
  useLookupCnpj,
} from "@/hooks/queries/client/use-clients";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/clients",
)({
  component: RouteComponent,
});

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

type PartnerDraft = ClientPartnerInput & { key: string };

function emptyForm() {
  return {
    name: "",
    tradeName: "",
    cnpj: "",
    email: "",
    phone: "",
    notes: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
    country: "BR",
  };
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace } = useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";
  const { data: clients = [], isLoading } = useClients(workspaceId);
  const createClient = useCreateClient();
  const lookupCnpj = useLookupCnpj();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [partners, setPartners] = useState<PartnerDraft[]>([]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm());
    setPartners([]);
  };

  const handleLookupCnpj = async () => {
    const digits = form.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      toast.error(t("settings:workspaceClients.cnpjInvalid"));
      return;
    }

    try {
      const data = await lookupCnpj.mutateAsync({
        workspaceId,
        cnpj: digits,
      });
      setForm((current) => ({
        ...current,
        name: data.name || current.name,
        tradeName: data.tradeName || current.tradeName,
        email: data.email || current.email,
        phone: data.phone || current.phone,
        street: data.street || current.street,
        number: data.number || current.number,
        complement: data.complement || current.complement,
        neighborhood: data.neighborhood || current.neighborhood,
        city: data.city || current.city,
        state: data.state || current.state,
        zipCode: data.zipCode ? formatCep(data.zipCode) : current.zipCode,
        country: data.country || current.country,
        cnpj: formatCnpj(data.cnpj),
      }));
      toast.success(t("settings:workspaceClients.lookupSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceClients.lookupError"),
      );
    }
  };

  const handleCreate = async () => {
    try {
      await createClient.mutateAsync({
        workspaceId,
        name: form.name.trim(),
        tradeName: form.tradeName.trim() || null,
        cnpj: form.cnpj.replace(/\D/g, ""),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        street: form.street.trim() || null,
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zipCode: form.zipCode.replace(/\D/g, "") || null,
        country: form.country.trim() || "BR",
        partners: partners
          .filter((partner) => partner.name.trim())
          .map((partner, index) => ({
            name: partner.name.trim(),
            cpf: partner.cpf?.replace(/\D/g, "") || null,
            role: partner.role?.trim() || null,
            email: partner.email?.trim() || null,
            phone: partner.phone?.trim() || null,
            ownershipPercent: partner.ownershipPercent ?? null,
            sortOrder: index,
          })),
      });
      setOpen(false);
      resetForm();
      toast.success(t("settings:workspaceClients.createSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceClients.createError"),
      );
    }
  };

  return (
    <div className="space-y-6 p-1">
      <PageTitle title={t("settings:workspaceClients.title")} />
      <CardFrame>
        <Card>
          <CardHeader>
            <CardTitle>{t("settings:workspaceClients.title")}</CardTitle>
            <CardDescription>
              {t("settings:workspaceClients.description")}
            </CardDescription>
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setOpen(true);
              }}
            >
              <Plus className="size-4 mr-1" />
              {t("settings:workspaceClients.add")}
            </Button>
          </CardHeader>
          <CardPanel className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("settings:workspaceClients.loading")}
              </p>
            ) : clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("settings:workspaceClients.empty")}
              </p>
            ) : (
              clients.map((clientRecord) => (
                <div
                  key={clientRecord.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{clientRecord.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCnpj(clientRecord.cnpj)}
                        {clientRecord.city
                          ? ` · ${clientRecord.city}${clientRecord.state ? `/${clientRecord.state}` : ""}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {clientRecord.email ? (
                    <span className="text-xs text-muted-foreground">
                      {clientRecord.email}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </CardPanel>
        </Card>
      </CardFrame>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("settings:workspaceClients.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="client-cnpj">
                {t("settings:workspaceClients.cnpj")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="client-cnpj"
                  value={form.cnpj}
                  onChange={(event) =>
                    updateField("cnpj", formatCnpj(event.target.value))
                  }
                  onBlur={() => {
                    if (form.cnpj.replace(/\D/g, "").length === 14) {
                      void handleLookupCnpj();
                    }
                  }}
                  placeholder="00.000.000/0000-00"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    form.cnpj.replace(/\D/g, "").length !== 14 ||
                    lookupCnpj.isPending
                  }
                  onClick={() => void handleLookupCnpj()}
                >
                  {lookupCnpj.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  <span className="ml-1">
                    {t("settings:workspaceClients.lookupCnpj")}
                  </span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings:workspaceClients.lookupHint")}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="client-name">
                  {t("settings:workspaceClients.name")}
                </Label>
                <Input
                  id="client-name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-trade-name">
                  {t("settings:workspaceClients.tradeName")}
                </Label>
                <Input
                  id="client-trade-name"
                  value={form.tradeName}
                  onChange={(event) =>
                    updateField("tradeName", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">
                  {t("settings:workspaceClients.email")}
                </Label>
                <Input
                  id="client-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone">
                  {t("settings:workspaceClients.phone")}
                </Label>
                <Input
                  id="client-phone"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">
                {t("settings:workspaceClients.addressSection")}
              </p>
              <div className="grid gap-4 sm:grid-cols-6">
                <div className="space-y-2 sm:col-span-4">
                  <Label htmlFor="client-street">
                    {t("settings:workspaceClients.street")}
                  </Label>
                  <Input
                    id="client-street"
                    value={form.street}
                    onChange={(event) =>
                      updateField("street", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="client-number">
                    {t("settings:workspaceClients.number")}
                  </Label>
                  <Input
                    id="client-number"
                    value={form.number}
                    onChange={(event) =>
                      updateField("number", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <Label htmlFor="client-complement">
                    {t("settings:workspaceClients.complement")}
                  </Label>
                  <Input
                    id="client-complement"
                    value={form.complement}
                    onChange={(event) =>
                      updateField("complement", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <Label htmlFor="client-neighborhood">
                    {t("settings:workspaceClients.neighborhood")}
                  </Label>
                  <Input
                    id="client-neighborhood"
                    value={form.neighborhood}
                    onChange={(event) =>
                      updateField("neighborhood", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-3">
                  <Label htmlFor="client-city">
                    {t("settings:workspaceClients.city")}
                  </Label>
                  <Input
                    id="client-city"
                    value={form.city}
                    onChange={(event) =>
                      updateField("city", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="client-state">
                    {t("settings:workspaceClients.state")}
                  </Label>
                  <Input
                    id="client-state"
                    value={form.state}
                    maxLength={2}
                    onChange={(event) =>
                      updateField("state", event.target.value.toUpperCase())
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="client-zip">
                    {t("settings:workspaceClients.zipCode")}
                  </Label>
                  <Input
                    id="client-zip"
                    value={form.zipCode}
                    onChange={(event) =>
                      updateField("zipCode", formatCep(event.target.value))
                    }
                    placeholder="00000-000"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-notes">
                {t("settings:workspaceClients.notes")}
              </Label>
              <Textarea
                id="client-notes"
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {t("settings:workspaceClients.partnersSection")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPartners((current) => [
                      ...current,
                      {
                        key: crypto.randomUUID(),
                        name: "",
                        cpf: "",
                        role: "",
                        email: "",
                      },
                    ])
                  }
                >
                  <Plus className="size-4 mr-1" />
                  {t("settings:workspaceClients.addPartner")}
                </Button>
              </div>
              {partners.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("settings:workspaceClients.partnersEmpty")}
                </p>
              ) : (
                partners.map((partner, index) => (
                  <div
                    key={partner.key}
                    className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-6"
                  >
                    <div className="space-y-1 sm:col-span-3">
                      <Label>
                        {t("settings:workspaceClients.partnerName")}
                      </Label>
                      <Input
                        value={partner.name}
                        onChange={(event) =>
                          setPartners((current) =>
                            current.map((item, i) =>
                              i === index
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>{t("settings:workspaceClients.partnerCpf")}</Label>
                      <Input
                        value={partner.cpf ?? ""}
                        onChange={(event) =>
                          setPartners((current) =>
                            current.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    cpf: formatCpf(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div className="flex items-end sm:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setPartners((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <Label>
                        {t("settings:workspaceClients.partnerRole")}
                      </Label>
                      <Input
                        value={partner.role ?? ""}
                        onChange={(event) =>
                          setPartners((current) =>
                            current.map((item, i) =>
                              i === index
                                ? { ...item, role: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-3">
                      <Label>
                        {t("settings:workspaceClients.partnerEmail")}
                      </Label>
                      <Input
                        type="email"
                        value={partner.email ?? ""}
                        onChange={(event) =>
                          setPartners((current) =>
                            current.map((item, i) =>
                              i === index
                                ? { ...item, email: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={
                !form.name.trim() ||
                form.cnpj.replace(/\D/g, "").length !== 14 ||
                createClient.isPending
              }
              onClick={() => void handleCreate()}
            >
              {createClient.isPending
                ? t("settings:workspaceClients.saving")
                : t("settings:workspaceClients.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
