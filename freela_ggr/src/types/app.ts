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

export type BudgetStatus = "solicitado" | "pendente" | "realizado" | "recusado";

export type Service = {
  id: string;
  title: string;
  category: string;
  provider: string;
  price: string;
  rating: string;
  description: string;
  uf: string;
  city: string;
  neighborhood: string;
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
};

export type CompletedJob = {
  id: string;
  title: string;
  provider: string;
  date: string;
  rating: number | null;
};
