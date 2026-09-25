import { normalize } from "../utils/searchTools";

export const SERVICE_OPTIONS = [
  "Pintura residencial",
  "Pintura comercial",
  "Elétrica",
  "Hidráulica",
  "Encanamento",
  "Limpeza residencial",
  "Limpeza pós-obra",
  "Limpeza de estofados",
  "Marcenaria",
  "Montagem de móveis",
  "Móveis planejados",
  "Refrigeração",
  "Manutenção de ar-condicionado",
  "Jardinagem",
  "Paisagismo",
  "Pedreiro",
  "Gesso e drywall",
  "Telhados e calhas",
  "Impermeabilização",
  "Vidraçaria",
  "Serralheria",
  "Chaveiro",
  "Dedetização",
  "Mudanças e fretes",
  "Motorista particular",
  "Aulas particulares",
  "Informática e suporte técnico",
  "Design gráfico",
  "Fotografia",
  "Filmagem de eventos",
  "Cabeleireiro",
  "Manicure e pedicure",
  "Maquiagem",
  "Costura e ajustes",
  "Confeitaria",
  "Chef em casa",
  "Pet sitter",
  "Passeio com cães",
  "Cuidador de idosos",
  "Babá",
  "Personal trainer",
  "Fisioterapia domiciliar",
  "Massagem terapêutica",
  "Tradução",
  "Contabilidade",
  "Advocacia",
  "Consultoria empresarial",
] as const;

export const OTHER_SERVICE_LABEL = "Outro";

const FORBIDDEN_PHRASES = [
  "arma de fogo",
  "conteudo adulto",
  "conteudo erotico",
  "documento falso",
  "documentos falsos",
  "diploma falso",
  "identidade falsa",
  "rg falso",
  "cpf falso",
  "cartao clonado",
  "clonagem de cartao",
  "lavagem de dinheiro",
  "piramide financeira",
  "jogo ilegal",
  "produto roubado",
  "orgaos humanos",
  "trafico humano",
  "menor de idade",
  "massagem tantrica",
  "programa sexual",
  "servico sexual",
  "conteúdo pornografico",
];

const FORBIDDEN_WORDS = [
  "droga",
  "drogas",
  "maconha",
  "marijuana",
  "cocaina",
  "heroina",
  "crack",
  "ecstasy",
  "metanfetamina",
  "lsd",
  "pistola",
  "revolver",
  "rifle",
  "municao",
  "explosivo",
  "bomba",
  "granada",
  "assassinato",
  "homicidio",
  "sequestro",
  "sicario",
  "trafico",
  "prostituta",
  "prostituição",
  "acompanhante",
  "pornografia",
  "porno",
  "pornô",
  "nudes",
  "nudez",
  "onlyfans",
  "stripper",
  "striptease",
  "erotico",
  "sexo",
  "sexual",
  "fetiche",
  "pedofilia",
  "hacker",
  "hackear",
  "furto",
  "roubo",
  "receptacao",
  "golpe",
];

export function findForbiddenService(value: string) {
  const text = normalize(value);
  if (!text) return null;

  const phraseHit = FORBIDDEN_PHRASES.find((phrase) => text.includes(normalize(phrase)));
  if (phraseHit) return phraseHit;

  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  const wordHit = FORBIDDEN_WORDS.find((word) => tokens.includes(normalize(word)));
  return wordHit ?? null;
}

export function isAllowedCustomService(value: string) {
  const text = value.trim();
  if (text.length < 3) return false;
  return !findForbiddenService(text);
}
