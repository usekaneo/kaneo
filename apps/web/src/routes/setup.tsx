import { resolveApiBaseUrl } from "@kaneo/libs";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useInstanceStatus from "@/hooks/queries/instance/use-instance-status";
import { useBranding } from "@/hooks/use-branding";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/setup")({
  component: SetupWizard,
});

type Step = "checks" | "brand" | "license" | "done";

function SetupWizard() {
  const navigate = useNavigate();
  const { branding, setBrandingLocal, refresh } = useBranding();
  const { data: status, isLoading, isError, refetch } = useInstanceStatus();
  const [step, setStep] = useState<Step>("checks");
  const [displayName, setDisplayName] = useState(branding.displayName);
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor);
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl || "");
  const [licenseKey, setLicenseKey] = useState("");
  const [saving, setSaving] = useState(false);
  const baseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_URL);

  const saveBranding = async (markComplete = false) => {
    setSaving(true);
    try {
      const response = await fetch(`${baseUrl}/branding`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          primaryColor,
          logoUrl: logoUrl || null,
          setupCompleted: markComplete,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setBrandingLocal(data);
      await refresh();
      toast.success("Marca salva");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao salvar marca",
      );
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const activateLicense = async () => {
    if (!licenseKey.trim()) {
      setStep("done");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${baseUrl}/license/activate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: licenseKey.trim() }),
      });
      if (!response.ok) throw new Error(await response.text());
      toast.success("Licença ativada");
      setStep("done");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao ativar licença",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageTitle title="Setup" suffix="ElseTasks" />
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-12">
        <div>
          <p className="text-sm text-muted-foreground">ElseTasks</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Configuração inicial
          </h1>
          <p className="mt-2 text-muted-foreground">
            Configure saúde da instância, marca do cliente e licença.
          </p>
        </div>

        {step === "checks" && (
          <div className="space-y-4 rounded-xl border border-border p-6">
            <h2 className="font-medium">1. Checks</h2>
            {isLoading && <p>Verificando API…</p>}
            {isError && (
              <p className="text-destructive">
                API indisponível. Suba o compose e tente de novo.
              </p>
            )}
            {status && (
              <ul className="space-y-1 text-sm">
                <li>API: ok</li>
                <li>
                  Usuários: {status.hasUsers ? "já existem" : "nenhum ainda"}
                </li>
                <li>
                  Setup: {status.setupCompleted ? "já concluído" : "pendente"}
                </li>
              </ul>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => refetch()}>
                Reverificar
              </Button>
              <Button
                type="button"
                disabled={isLoading || isError}
                onClick={() => setStep("brand")}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === "brand" && (
          <div className="space-y-4 rounded-xl border border-border p-6">
            <h2 className="font-medium">2. Marca do cliente</h2>
            <div className="space-y-2">
              <Label htmlFor="displayName">Nome exibido</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setBrandingLocal({ displayName: e.target.value });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Cor primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  className="h-10 w-14 p-1"
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    setBrandingLocal({ primaryColor: e.target.value });
                  }}
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => {
                    setPrimaryColor(e.target.value);
                    setBrandingLocal({ primaryColor: e.target.value });
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">URL do logo (opcional)</Label>
              <Input
                id="logoUrl"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
            <div
              className="rounded-lg border border-border p-4"
              style={{ borderColor: primaryColor }}
            >
              <p className="text-xs text-muted-foreground">Preview</p>
              <p
                className="text-xl font-semibold"
                style={{ color: primaryColor }}
              >
                {displayName || "Sua marca"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("checks")}
              >
                Voltar
              </Button>
              <Button
                type="button"
                disabled={saving || !displayName.trim()}
                onClick={async () => {
                  await saveBranding(false);
                  setStep("license");
                }}
              >
                Salvar e continuar
              </Button>
            </div>
          </div>
        )}

        {step === "license" && (
          <div className="space-y-4 rounded-xl border border-border p-6">
            <h2 className="font-medium">3. Licença</h2>
            <p className="text-sm text-muted-foreground">
              Cole a chave ElseTasks Local (ex.: ET-LOCAL-…). Você pode pular e
              ativar depois.
            </p>
            <Input
              placeholder="ET-LOCAL-XXXXXXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("brand")}
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={async () => {
                  await saveBranding(true);
                  setStep("done");
                }}
              >
                Pular
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={async () => {
                  await saveBranding(true);
                  await activateLicense();
                }}
              >
                Ativar
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 rounded-xl border border-border p-6">
            <h2 className="font-medium">Pronto</h2>
            <p className="text-sm text-muted-foreground">
              {status?.hasUsers
                ? "Entre na conta admin e comece a usar o board."
                : "Crie a primeira conta admin para finalizar."}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() =>
                  navigate({
                    to: status?.hasUsers ? "/auth/sign-in" : "/auth/sign-up",
                  })
                }
              >
                {status?.hasUsers ? "Ir para login" : "Criar conta admin"}
              </Button>
              <Link
                to="/dashboard"
                className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm"
              >
                Abrir dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
