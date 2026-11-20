export class InputError extends Error {}
export function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Dados inválidos.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !allowed.includes(key))) throw new InputError("Campo não permitido.");
  return record;
}
export function text(value: unknown, max: number, min = 1): string {
  if (typeof value !== "string") throw new InputError("Preencha os campos obrigatórios.");
  const clean = value.trim();
  if (clean.length < min || clean.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean)) {
    throw new InputError("Confira o tamanho e o conteúdo dos campos.");
  }
  return clean;
}
export function uuid(value: unknown): string {
  const id = text(value, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new InputError("Identificador inválido.");
  return id;
}
export function email(value: unknown): string {
  const clean = text(value, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new InputError("Informe um e-mail válido.");
  return clean;
}
export const passwordRules = [
  { label: "De 12 a 32 caracteres (até 32 bytes)", check: (value: string) => value.length >= 12 && new TextEncoder().encode(value).length <= 32 },
  { label: "Uma letra maiúscula", check: (value: string) => /[A-Z]/.test(value) },
  { label: "Uma letra minúscula", check: (value: string) => /[a-z]/.test(value) },
  { label: "Um número", check: (value: string) => /\d/.test(value) },
  { label: "Um símbolo", check: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export function password(value: unknown, signup = false): string {
  const maxPasswordLength = 32;
  // a senha não passa por trim pra não mudar o que a pessoa digitou
  if (typeof value !== "string" || !value.length || value.length > maxPasswordLength ||
      (signup && passwordRules.some(({ check }) => !check(value)))) {
    throw new InputError(`Use uma senha de 12 a ${maxPasswordLength} caracteres com maiúscula, minúscula, número e símbolo.`);
  }
  if (new TextEncoder().encode(value).length > maxPasswordLength) throw new InputError(`A senha é longa demais. Use até ${maxPasswordLength} bytes.`);
  return value;
}
export function accountPhone(value: unknown) {
  const digits = text(value, 24).replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(digits)) throw new InputError("Informe o telefone com DDD.");
  return digits;
}

export function minimumSignupAge(role: "cliente" | "profissional") {
  return role === "profissional" ? 18 : 16;
}

export function validateBirthDate(value: unknown, role: "cliente" | "profissional") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new InputError("Informe uma data de nascimento válida.");
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getUTCFullYear() < 1900) {
    throw new InputError("Informe uma data de nascimento válida.");
  }
  const now = new Date();
  const age = minimumSignupAge(role);
  const birthdayThisYear = value.slice(5);
  const today = now.toISOString().slice(5, 10);
  const years = now.getUTCFullYear() - date.getUTCFullYear() - Number(today < birthdayThisYear);
  if (years < age) throw new InputError(`A idade mínima para esse perfil é de ${age} anos.`);
  return value;
}

export function profileMetadata(value: unknown) {
  const v = object(value, ["role", "cep", "street", "neighborhood", "uf", "state_name", "city", "whatsapp", "services", "legal_version", "birth_date", "first_name"]);
  if (v.role !== "cliente" && v.role !== "profissional") throw new InputError("Perfil inválido.");
  const phone = text(v.whatsapp, 20).replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(phone)) throw new InputError("Informe um telefone válido.");
  const uf = text(v.uf, 2);
  if (!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf)) throw new InputError("Estado inválido.");
  const cep = text(v.cep ?? "", 9, 0).replace(/\D/g, "");
  if (cep && !/^\d{8}$/.test(cep)) throw new InputError("CEP inválido.");
  if (!Array.isArray(v.services) || v.services.length > 30) throw new InputError("Selecione até 30 serviços.");
  return { role: v.role, cep, street: text(v.street ?? "", 200, 0), neighborhood: text(v.neighborhood, 120),
    uf, state_name: text(v.state_name ?? "", 60, 0), city: text(v.city, 120), whatsapp: phone,
    birth_date: validateBirthDate(v.birth_date, v.role),
    first_name: text(v.first_name, 60),
    ...(v.legal_version === undefined ? {} : { legal_version: text(v.legal_version, 32) }),
    services: v.services.map(item => text(item, 100)) };
}
export function budgetInput(value: unknown) {
  const v = object(value, ["client", "service", "value", "serviceId", "professionalId", "whatsapp", "status", "details", "shareContact"]);
  if (v.status !== undefined && v.status !== "solicitado") throw new InputError("Status inicial inválido.");
  const phone = v.whatsapp ? text(v.whatsapp, 20).replace(/\D/g, "") : null;
  if (phone && !/^\d{10,11}$/.test(phone)) throw new InputError("Telefone inválido.");
  return { client: text(v.client, 120), service: text(v.service, 200), value: text(v.value, 40),
    service_id: v.serviceId ? uuid(v.serviceId) : null,
    professional_id: v.professionalId ? uuid(v.professionalId) : null, whatsapp: phone,
    ...(v.shareContact === true ? { share_contact: true } : {}),
    details: v.details === undefined ? null : text(v.details, 2000, 0), status: "solicitado" };
}
export function quoteInput(value: unknown) {
  const v = object(value, ["id", "quoteAmount", "quoteMessage", "delivery"]);
  if (typeof v.quoteAmount !== "number" || !Number.isFinite(v.quoteAmount) ||
      v.quoteAmount <= 0 || v.quoteAmount > 9999999.99 ||
      Math.abs(v.quoteAmount * 100 - Math.round(v.quoteAmount * 100)) > 1e-7) {
    throw new InputError("Informe um valor válido para a proposta.");
  }
  return { id: uuid(v.id), quote_amount: v.quoteAmount, delivery: text(v.delivery, 200),
    quote_message: v.quoteMessage === undefined || v.quoteMessage === "" ? null : text(v.quoteMessage, 2000) };
}
export function budgetStatus(value: unknown) {
  if (!["cotado", "aceito", "em_andamento", "realizado", "recusado", "cancelado"].includes(String(value))) {
    throw new InputError("Status inválido.");
  }
  return value as Exclude<import("../types/app").BudgetStatus, "solicitado">;
}
export function rating(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) throw new InputError("Avalie de 1 a 5.");
  return value;
}

function optionalHttps(value: unknown, instagram = false): string | null {
  const raw = text(value ?? "", 300, 0);
  if (!raw) return null;
  let url: URL;
  try { url = new URL(/^https:\/\//i.test(raw) ? raw : "https://" + raw); }
  catch { throw new InputError("Informe um link HTTPS válido."); }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".") || /^\w+:\/\//.test(raw) && !/^https:\/\//i.test(raw)) {
    throw new InputError("Informe um link HTTPS válido.");
  }
  if (instagram && (!["instagram.com", "www.instagram.com"].includes(url.hostname) || url.port || !/^\/[A-Za-z0-9._]+\/?$/.test(url.pathname))) {
    throw new InputError("Informe o endereço do seu perfil profissional do Instagram.");
  }
  if (instagram) { url.search = ""; url.hash = ""; }
  return text(url.href, 300);
}

export function profileSettings(value: unknown) {
  const input = object(value, ["services", "bio", "instagram_url", "website_url", "whatsapp_business", "avatar_path", "first_name", "whatsapp"]);
  if (!Array.isArray(input.services) || input.services.length > 30) throw new InputError("Selecione até 30 tipos de serviço.");
  const services = [...new Set(input.services.map((item) => text(item, 100, 3)))];
  const phone = text(input.whatsapp_business ?? "", 24, 0).replace(/\D/g, "");
  if (phone && !/^\d{10,11}$/.test(phone)) throw new InputError("Informe o WhatsApp Business com DDD, sem +55.");
  const contact = text(input.whatsapp ?? "", 24, 0).replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(contact)) throw new InputError("Informe seu WhatsApp com DDD, sem +55.");
  return {
    services,
    first_name: text(input.first_name, 60),
    whatsapp: contact,
    bio: text(input.bio ?? "", 500, 0) || null,
    instagram_url: optionalHttps(input.instagram_url, true),
    website_url: optionalHttps(input.website_url),
    whatsapp_business: phone || null,
    avatar_path: input.avatar_path == null ? null : text(input.avatar_path, 85),
  };
}
