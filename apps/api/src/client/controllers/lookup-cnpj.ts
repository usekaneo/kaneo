import { HTTPException } from "hono/http-exception";

export type CnpjLookupResult = {
  cnpj: string;
  name: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string;
};

type BrasilApiCnpjResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  email?: string | null;
  ddd_telefone_1?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  message?: string;
};

type ReceitaWsResponse = {
  status?: string;
  message?: string;
  nome?: string;
  fantasia?: string;
  email?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  cnpj?: string;
};

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function normalizeZip(cep?: string | null) {
  if (!cep) return null;
  const digits = cep.replace(/\D/g, "");
  return digits || null;
}

async function lookupFromBrasilApi(
  cnpj: string,
): Promise<CnpjLookupResult | null> {
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`BrasilAPI returned ${response.status}`);
  }

  const data = (await response.json()) as BrasilApiCnpjResponse;
  if (!data.razao_social) return null;

  const ddd = data.ddd_telefone_1?.replace(/\D/g, "") ?? "";
  return {
    cnpj,
    name: data.razao_social,
    tradeName: data.nome_fantasia?.trim() || null,
    email: data.email?.trim() || null,
    phone: ddd || null,
    street: data.logradouro?.trim() || null,
    number: data.numero?.trim() || null,
    complement: data.complemento?.trim() || null,
    neighborhood: data.bairro?.trim() || null,
    city: data.municipio?.trim() || null,
    state: data.uf?.trim().toUpperCase() || null,
    zipCode: normalizeZip(data.cep),
    country: "BR",
  };
}

async function lookupFromReceitaWs(
  cnpj: string,
): Promise<CnpjLookupResult | null> {
  const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`ReceitaWS returned ${response.status}`);
  }

  const data = (await response.json()) as ReceitaWsResponse;
  if (data.status === "ERROR" || !data.nome) {
    return null;
  }

  return {
    cnpj,
    name: data.nome,
    tradeName: data.fantasia?.trim() || null,
    email: data.email?.trim() || null,
    phone: data.telefone?.replace(/\D/g, "") || null,
    street: data.logradouro?.trim() || null,
    number: data.numero?.trim() || null,
    complement: data.complemento?.trim() || null,
    neighborhood: data.bairro?.trim() || null,
    city: data.municipio?.trim() || null,
    state: data.uf?.trim().toUpperCase() || null,
    zipCode: normalizeZip(data.cep),
    country: "BR",
  };
}

async function lookupCnpj(cnpjInput: string): Promise<CnpjLookupResult> {
  const cnpj = normalizeCnpj(cnpjInput);
  if (cnpj.length !== 14) {
    throw new HTTPException(400, { message: "CNPJ must have 14 digits" });
  }

  try {
    const fromBrasilApi = await lookupFromBrasilApi(cnpj);
    if (fromBrasilApi) return fromBrasilApi;
  } catch {
    // Fall through to ReceitaWS
  }

  try {
    const fromReceita = await lookupFromReceitaWs(cnpj);
    if (fromReceita) return fromReceita;
  } catch {
    // Both providers failed
  }

  throw new HTTPException(404, {
    message: "CNPJ not found in public registries",
  });
}

export default lookupCnpj;
