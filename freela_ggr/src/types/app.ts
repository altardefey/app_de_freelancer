export type LocationValue = {
  cep: string;
  street: string;
  neighborhood: string;
  uf: string;
  stateName: string;
  city: string;
};

export const emptyLocation: LocationValue = {
  cep: "",
  street: "",
  neighborhood: "",
  uf: "",
  stateName: "",
  city: "",
};

export type Role = "cliente" | "profissional";

export type BudgetStatus =
  | "solicitado"
  | "cotado"
  | "aceito"
  | "em_andamento"
  | "realizado"
  | "recusado"
  | "cancelado";

export type Service = {
  id: string;
  providerId: string | null;
  title: string;
  category: string;
  provider: string;
  price: string;
  fixedPriceCents?: number | null;
  priceNegotiable?: boolean;
  rating: string;
  description: string;
  uf: string;
  city: string;
  neighborhood: string;
  remote?: boolean;
  portfolioPaths?: string[];
  providerPremium?: boolean;
  unavailable?: boolean;
  trending?: boolean;
  recent?: boolean;
};

export type Budget = {
  id: string;
  client: string;
  service: string;
  value: string;
  date: string;
  status: BudgetStatus;
  details?: string | null;
  agreedPriceCents?: number | null;
  delivery?: string | null;
  quoteAmount?: number | null;
  quoteMessage?: string | null;
  createdAt?: string;
  remote?: boolean;
};

export type CompletedJob = {
  id: string;
  title: string;
  provider: string;
  date: string;
  rating: number | null;
};
