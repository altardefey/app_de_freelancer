import type { Service } from "../types/app";

export const serviceCategories = [
  "Todos",
  "Pintura",
  "Elétrica",
  "Hidráulica",
  "Limpeza",
  "Marcenaria",
  "Refrigeração",
];

export function buildCatalogDictionary(services: Service[]) {
  return services.flatMap((service) => [
    service.title.toLowerCase(),
    service.category.toLowerCase(),
  ]);
}
