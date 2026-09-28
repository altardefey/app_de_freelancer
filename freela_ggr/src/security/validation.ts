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
export function password(value: unknown, signup = false): string {
  // a senha não passa por trim pra não mudar o que a pessoa digitou
  if (typeof value !== "string" || !value.length || value.length > 72 ||
      (signup && (value.length < 12 || !/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)))) {
    throw new InputError("Use uma senha de 12 a 72 caracteres com maiúscula, minúscula, número e símbolo.");
  }
  if (new TextEncoder().encode(value).length > 72) throw new InputError("A senha é longa demais. Use até 72 bytes.");
  return value;
}
export function profileMetadata(value: unknown) {
  const v = object(value, ["role", "cep", "street", "neighborhood", "uf", "state_name", "city", "whatsapp", "services"]);
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
    services: v.services.map(item => text(item, 100)) };
}
export function budgetInput(value: unknown) {
  const v = object(value, ["client", "service", "value", "professionalId", "whatsapp", "status"]);
  if (v.status !== undefined && v.status !== "solicitado") throw new InputError("Status inicial inválido.");
  const phone = v.whatsapp ? text(v.whatsapp, 20).replace(/\D/g, "") : null;
  if (phone && !/^\d{10,11}$/.test(phone)) throw new InputError("Telefone inválido.");
  return { client: text(v.client, 120), service: text(v.service, 200), value: text(v.value, 40),
    professional_id: v.professionalId ? uuid(v.professionalId) : null, whatsapp: phone, status: "solicitado" };
}
export function budgetStatus(value: unknown) {
  if (!["pendente", "realizado", "recusado"].includes(String(value))) throw new InputError("Status inválido.");
  return value as "pendente" | "realizado" | "recusado";
}
export function rating(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) throw new InputError("Avalie de 1 a 5.");
  return value;
}
