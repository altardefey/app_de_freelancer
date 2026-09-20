export type BrazilState = {
  uf: string;
  nome: string;
  id: number;
};

export const BRAZIL_STATES: BrazilState[] = [
  { uf: "AC", nome: "Acre", id: 12 },
  { uf: "AL", nome: "Alagoas", id: 27 },
  { uf: "AP", nome: "Amapá", id: 16 },
  { uf: "AM", nome: "Amazonas", id: 13 },
  { uf: "BA", nome: "Bahia", id: 29 },
  { uf: "CE", nome: "Ceará", id: 23 },
  { uf: "DF", nome: "Distrito Federal", id: 53 },
  { uf: "ES", nome: "Espírito Santo", id: 32 },
  { uf: "GO", nome: "Goiás", id: 52 },
  { uf: "MA", nome: "Maranhão", id: 21 },
  { uf: "MT", nome: "Mato Grosso", id: 51 },
  { uf: "MS", nome: "Mato Grosso do Sul", id: 50 },
  { uf: "MG", nome: "Minas Gerais", id: 31 },
  { uf: "PA", nome: "Pará", id: 15 },
  { uf: "PB", nome: "Paraíba", id: 25 },
  { uf: "PR", nome: "Paraná", id: 41 },
  { uf: "PE", nome: "Pernambuco", id: 26 },
  { uf: "PI", nome: "Piauí", id: 22 },
  { uf: "RJ", nome: "Rio de Janeiro", id: 33 },
  { uf: "RN", nome: "Rio Grande do Norte", id: 24 },
  { uf: "RS", nome: "Rio Grande do Sul", id: 43 },
  { uf: "RO", nome: "Rondônia", id: 11 },
  { uf: "RR", nome: "Roraima", id: 14 },
  { uf: "SC", nome: "Santa Catarina", id: 42 },
  { uf: "SP", nome: "São Paulo", id: 35 },
  { uf: "SE", nome: "Sergipe", id: 28 },
  { uf: "TO", nome: "Tocantins", id: 17 },
];

const FALLBACK_CITIES: Record<string, string[]> = {
  AC: ["Rio Branco", "Cruzeiro do Sul", "Sena Madureira"],
  AL: ["Maceió", "Arapiraca", "Palmeira dos Índios"],
  AP: ["Macapá", "Santana", "Laranjal do Jari"],
  AM: ["Manaus", "Parintins", "Itacoatiara"],
  BA: ["Salvador", "Feira de Santana", "Vitória da Conquista", "Camaçari"],
  CE: ["Fortaleza", "Caucaia", "Juazeiro do Norte", "Sobral"],
  DF: ["Brasília"],
  ES: ["Vitória", "Vila Velha", "Serra", "Cariacica"],
  GO: ["Goiânia", "Aparecida de Goiânia", "Anápolis", "Rio Verde"],
  MA: ["São Luís", "Imperatriz", "Caxias"],
  MT: ["Cuiabá", "Várzea Grande", "Rondonópolis", "Sinop"],
  MS: ["Campo Grande", "Dourados", "Três Lagoas"],
  MG: ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim"],
  PA: ["Belém", "Ananindeua", "Marabá", "Santarém"],
  PB: ["João Pessoa", "Campina Grande", "Santa Rita"],
  PR: ["Curitiba", "Londrina", "Maringá", "Ponta Grossa"],
  PE: ["Recife", "Jaboatão dos Guararapes", "Olinda", "Caruaru"],
  PI: ["Teresina", "Parnaíba", "Picos"],
  RJ: ["Rio de Janeiro", "São Gonçalo", "Duque de Caxias", "Niterói", "Nova Iguaçu"],
  RN: ["Natal", "Mossoró", "Parnamirim"],
  RS: ["Porto Alegre", "Caxias do Sul", "Canoas", "Pelotas"],
  RO: ["Porto Velho", "Ji-Paraná", "Ariquemes"],
  RR: ["Boa Vista", "Rorainópolis"],
  SC: ["Florianópolis", "Joinville", "Blumenau", "Chapecó"],
  SP: [
    "São Paulo",
    "Guarulhos",
    "Campinas",
    "São Bernardo do Campo",
    "Santo André",
    "Osasco",
    "Ribeirão Preto",
    "Sorocaba",
  ],
  SE: ["Aracaju", "Nossa Senhora do Socorro", "Lagarto"],
  TO: ["Palmas", "Araguaína", "Gurupi"],
};

const cityCache = new Map<string, string[]>();

export async function fetchCitiesByUf(uf: string): Promise<string[]> {
  const cached = cityCache.get(uf);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
    );
    if (!response.ok) throw new Error("IBGE indisponível");
    const data = (await response.json()) as { nome: string }[];
    const names = data.map((item) => item.nome).filter(Boolean);
    if (names.length) {
      cityCache.set(uf, names);
      return names;
    }
  } catch {
    // usa lista local se a API do IBGE falhar
  }

  const fallback = FALLBACK_CITIES[uf] ?? [];
  cityCache.set(uf, fallback);
  return fallback;
}
