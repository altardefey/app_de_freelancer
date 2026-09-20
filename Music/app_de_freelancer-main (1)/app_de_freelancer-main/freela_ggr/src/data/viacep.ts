import { BRAZIL_STATES } from "./brazil";

export type EnderecoViaCep = {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
};

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function sanitizeCep(value: string) {
  return value.replace(/\D/g, "");
}

export function stateNameFromUf(uf: string) {
  return BRAZIL_STATES.find((state) => state.uf === uf)?.nome ?? "";
}

export async function buscarCep(cepDigitado: string): Promise<EnderecoViaCep | null> {
  const cepLimpo = sanitizeCep(cepDigitado);
  if (cepLimpo.length !== 8) return null;

  const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
  const dados = (await resposta.json()) as ViaCepResponse;
  if (dados.erro) {
    throw new Error("CEP_NOT_FOUND");
  }

  return {
    rua: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
    estado: dados.uf ?? "",
  };
}

export async function searchNeighborhoods(
  uf: string,
  city: string,
  query: string,
): Promise<string[]> {
  const term = query.trim();
  if (!uf || !city || term.length < 2) return [];

  const url = `https://viacep.com.br/ws/${uf}/${encodeURIComponent(city)}/${encodeURIComponent(term)}/json/`;
  const resposta = await fetch(url);
  const dados = await resposta.json();
  if (!Array.isArray(dados)) return [];

  const unique = new Set<string>();
  for (const item of dados as ViaCepResponse[]) {
    if (item.bairro) unique.add(item.bairro);
  }
  return [...unique].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
