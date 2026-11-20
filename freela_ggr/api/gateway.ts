import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import { LEGAL_VERSION } from "../src/data/legalDocuments";
import { findForbiddenService } from "../src/data/serviceOptions";
import { PHOTO_MAX_BASE64_LENGTH, PHOTO_MAX_BYTES, PHOTO_REQUEST_MAX_BYTES } from "../src/data/photoLimits";
import * as v from "../src/security/validation";
import { BUDGET_COLUMNS, JOB_COLUMNS, PROFILE_COLUMNS, SERVICE_COLUMNS } from "../src/security/columns";

type Request = IncomingMessage & { body?: unknown };
const cookieName = (suffix: string) => `${process.env.VERCEL ? "__Host-" : ""}freela-${suffix}`;
function cookies(req: Request): Record<string, string> {
  const entries = (req.headers.cookie ?? "").split(";").map(item => item.trim().split("="));
  return Object.fromEntries(entries.filter(([key]) => key).map(([key, ...value]) => [key, value.join("=")]));
}
function setSession(res: ServerResponse, session: Session | null) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : "";
  const options = `; HttpOnly; SameSite=Lax; Path=/${secure}`;
  // divide o jwt pra cada cookie ficar abaixo do limite do navegador
  const access = session?.access_token ?? "";
  if (access.length > 12000) throw new Error("session too large");
  res.setHeader("Set-Cookie", [
    ...Array.from({ length: 4 }, (_, index) => {
      const part = access.slice(index * 3000, (index + 1) * 3000);
      return `${cookieName(`access${index}`)}=${part}${options}; Max-Age=${part && session ? session.expires_in : 0}`;
    }),
    `${cookieName("refresh")}=${session?.refresh_token ?? ""}${options}; Max-Age=${session ? 604800 : 0}`,
  ]);
}
function publicUser(user: User | null) {
  return user ? { id: user.id, email: user.email } : null;
}
function authResult(user: User | null, session: Session | null) {
  const safe = publicUser(user);
  return { user: safe, session: session && safe ? { user: safe } : null };
}
function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status; res.end(JSON.stringify(body));
}
function servicePricing(item: Record<string, unknown>) {
  if (item.fixed_price_cents === undefined && item.price_negotiable === undefined) {
    return { price: v.text(item.price, 10), fixed_price_cents: null, price_negotiable: false };
  }
  if (item.price_negotiable === true) return { price: "A combinar", price_negotiable: true, fixed_price_cents: null };
  const cents = item.fixed_price_cents;
  if (typeof cents !== "number" || !Number.isSafeInteger(cents) || cents < 1 || cents > 999999999) {
    throw new v.InputError("Informe o preço fixo ou marque A combinar.");
  }
  return {
    price: (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    price_negotiable: false, fixed_price_cents: cents,
  };
}

function portfolioPaths(value: unknown, userId: string, serviceId: string): string[] {
  if (!Array.isArray(value) || value.length > 10) throw new v.InputError("Quantidade de fotos inválida.");
  const pattern = new RegExp(`^${userId}/${serviceId}(-([1-9]|10|[0-9a-f-]{36}))?[.]jpg$`);
  return value.map((path) => {
    if (typeof path !== "string" || !pattern.test(path)) throw new v.InputError("Foto inválida.");
    return path;
  });
}

async function uploadPortfolioImage(db: SupabaseClient, path: string, value: unknown) {
  const encoded = v.text(value, PHOTO_MAX_BASE64_LENGTH);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new v.InputError("Imagem inválida.");
  const image = Buffer.from(encoded, "base64");
  if (image.length < 5 || image.length > PHOTO_MAX_BYTES || image[0] !== 255 || image[1] !== 216 || image[2] !== 255 || image.at(-2) !== 255 || image.at(-1) !== 217) throw new v.InputError("Envie uma imagem JPEG válida.");
  const file = new Blob([new Uint8Array(image)], { type: "image/jpeg" });
  const { error } = await db.storage.from("service-portfolio").upload(path, file, { contentType: "image/jpeg" });
  if (!error || error.status === 409 || error.statusCode === "Duplicate") return;
  if (error.statusCode === "NoSuchBucket") {
    throw new v.InputError("O armazenamento de fotos ainda não está configurado.");
  }
  if (error.statusCode === "EntityTooLarge" || error.status === 413) {
    throw new v.InputError("O armazenamento recusou o tamanho da foto. Confira o limite de 2 MB no Supabase.");
  }
  if (error.statusCode === "AccessDenied" || error.status === 403 || /row-level security/i.test(error.message)) {
    throw new v.InputError("O armazenamento recusou a permissão para enviar a foto. Confira as permissões do Supabase.");
  }
  throw error;
}

export default async function handler(req: Request, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method !== "POST") return send(res, 405, { error: { message: "Método não permitido." } });
    // exige origem exata e json pra bloquear csrf, inclusive no login
    const expectedOrigin = process.env.APP_ORIGIN ?? (process.env.VERCEL ? "" : "http://localhost:3000");
    if (!expectedOrigin || req.headers.origin !== expectedOrigin ||
        (process.env.VERCEL && req.headers["x-forwarded-proto"] !== "https")) {
      return send(res, 403, { error: { message: "Origem não permitida." } });
    }
    if (!req.headers["content-type"]?.startsWith("application/json")) return send(res, 415, { error: { message: "Formato não permitido." } });
    if (Number(req.headers["content-length"] ?? 0) > PHOTO_REQUEST_MAX_BYTES) return send(res, 413, { error: { message: "Envio muito grande." } });
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    if (Buffer.byteLength(raw) > PHOTO_REQUEST_MAX_BYTES) return send(res, 413, { error: { message: "Envio muito grande." } });
    const input = v.object(JSON.parse(raw), ["action", "payload"]);
    const action = v.text(input.action, 40);
    const payload = input.payload ?? {};
    if (action !== "publishService" && action !== "uploadPortfolioPhoto" && action !== "uploadProfileAvatar" && Math.max(Number(req.headers["content-length"] ?? 0), Buffer.byteLength(raw)) > 16384) return send(res, 413, { error: { message: "Envio muito grande." } });
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !/^https:\/\//.test(url) || !key?.startsWith("sb_publishable_")) throw new Error("server configuration");
    // nunca usa service_role: o banco continua validando o usuário com rls
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

    if (action === "requestPasswordReset" || action === "completePasswordReset") {
      const request = action === "requestPasswordReset";
      const item = v.object(payload, request ? ["email", "captchaToken"] : ["email", "code", "password"]);
      const email = v.email(item.email);
      if (request) {
        const captchaToken = item.captchaToken ? v.text(item.captchaToken, 4096) : undefined;
        if (process.env.VERCEL && !captchaToken) throw new v.InputError("Confirme a verificação de segurança.");
        const { error } = await client.auth.resetPasswordForEmail(email, { captchaToken });
        if (error && error.code !== "user_not_found") throw error;
      } else {
        const password = v.password(item.password, true);
        const token = v.text(item.code, 10);
        if (!/^\d{6,10}$/.test(token)) throw new v.InputError("Informe o código numérico recebido por e-mail.");
        const verified = await client.auth.verifyOtp({ email, token, type: "recovery" });
        if (verified.error) throw verified.error;
        if (!verified.data.session) return send(res, 400, { error: { code: "otp_expired" } });
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        await client.auth.signOut({ scope: "global" }).catch(() => {});
      }
      return send(res, 200, { data: null });
    }

    if (["login", "signup", "resend"].includes(action)) {
      const data = v.object(payload, action === "resend" ? ["email", "type", "options"] : ["email", "password", "options"]);
      const options = v.object(data.options ?? {}, action === "signup" ? ["captchaToken", "data"] : ["captchaToken"]);
      const captchaToken = options.captchaToken ? v.text(options.captchaToken, 4096) : undefined;
      if (process.env.VERCEL && !captchaToken) return send(res, 400, { error: { code: "captcha_failed", message: "Confirme a verificação de segurança." } });
      const address = v.email(data.email);
      if (action === "resend") {
        const { error } = await client.auth.resend({ type: "signup", email: address, options: { captchaToken } });
        if (error) throw error;
        return send(res, 200, { data: { user: null } });
      }
      const credentials = { email: address, password: v.password(data.password, action === "signup"), options: { captchaToken } };
      const metadata = action === "signup" ? v.profileMetadata(options.data) : undefined;
      if (metadata && metadata.legal_version !== LEGAL_VERSION) throw new v.InputError("Aceite os Termos de Uso e confirme a ciência da Política de Privacidade.");
      const result = action === "login" ? await client.auth.signInWithPassword(credentials) :
        await client.auth.signUp({ ...credentials, options: { captchaToken, data: metadata } });
      if (result.error) throw result.error;
      if (result.data.session) setSession(res, result.data.session);
      // cadastro sem sessão não revela se a conta já existia
      return send(res, 200, { data: authResult(result.data.session ? result.data.user : null, result.data.session) });
    }

    const saved = cookies(req);
    let access = Array.from({ length: 4 }, (_, index) => saved[cookieName(`access${index}`)] ?? "").join("");
    let user: User | null = null;
    if (access) {
      const result = await client.auth.getUser(access);
      user = result.data.user;
    }
    if (!user && saved[cookieName("refresh")]) {
      const result = await client.auth.refreshSession({ refresh_token: saved[cookieName("refresh")] });
      if (result.data.session) {
        access = result.data.session.access_token;
        user = result.data.user;
        setSession(res, result.data.session);
      }
    }
    if (action === "logout") {
      v.object(payload, []);
      if (access) await fetch(`${url}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${access}` } });
      setSession(res, null);
      return send(res, 200, { data: { user: null, session: null } });
    }
    if (action === "session") {
      v.object(payload, []);
      if (!user) setSession(res, null);
      return send(res, 200, { data: { user: publicUser(user) } });
    }
    if (!user || !access) return send(res, 401, { error: { message: "Entre na sua conta novamente." } });
    const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${access}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    if (action === "changeAccountEmail") {
      const item = v.object(payload, ["email", "password", "captchaToken"]);
      const address = v.email(item.email);
      if (!user.email) throw new v.InputError("Seu perfil não tem um e-mail associado.");
      if (address.toLowerCase() === user.email.toLowerCase()) throw new v.InputError("Informe um e-mail diferente do atual.");
      const verified = await client.auth.signInWithPassword({
        email: user.email,
        password: v.password(item.password),
        options: { captchaToken: item.captchaToken ? v.text(item.captchaToken, 4096) : undefined },
      });
      if (verified.error || verified.data.user?.id !== user.id) {
        return send(res, verified.error?.status === 429 ? 429 : 400, { error: { message: "Não foi possível confirmar sua senha. Confira os dados e tente novamente." } });
      }
      try {
        const { error } = await client.auth.updateUser({ email: address });
        if (error) return send(res, error.status === 429 ? 429 : 400, { error: { message: "Não foi possível solicitar a troca de e-mail. Confira o endereço e tente novamente." } });
        return send(res, 200, { data: true });
      } finally {
        await client.auth.signOut({ scope: "local" }).catch(() => {});
      }
    }
    let result;
    switch (action) {
      case "changeAccountPhone": {
        const item = v.object(payload, ["phone", "password"]);
        result = await db.rpc("change_account_phone", {
          new_phone: v.accountPhone(item.phone),
          current_password: v.password(item.password),
        });
        break;
      }
      case "legalStatus":
        result = await db.rpc("legal_status"); break;
      case "acceptLegal": {
        const item = v.object(payload, ["version"]);
        result = await db.rpc("accept_legal", { document_version: v.text(item.version, 32) }); break;
      }
      case "freelaUsage":
        v.object(payload, []);
        result = await db.rpc("freela_usage"); break;
      case "quotes":
        v.object(payload, []);
        result = await db.from("professional_quotes").select("*").is("source_budget_id", null).order("created_at", { ascending: false }).limit(100); break;
      case "createQuote": {
        const item = v.object(payload, ["request_id", "client", "service", "amount_cents", "whatsapp", "remote"]);
        if (!Number.isSafeInteger(item.amount_cents) || Number(item.amount_cents) <= 0 || Number(item.amount_cents) > 999999999) throw new v.InputError("Informe um valor válido.");
        const phone = item.whatsapp ? v.text(item.whatsapp, 11) : null;
        if (phone && !/^\d{10,11}$/.test(phone)) throw new v.InputError("Informe um WhatsApp com DDD.");
        const requestId = v.uuid(item.request_id);
        result = await db.from("professional_quotes").insert({ user_id: user.id, request_id: requestId, client: v.text(item.client, 120), service: v.text(item.service, 2000), amount_cents: item.amount_cents, whatsapp: phone, ...(item.remote === undefined ? {} : { remote: item.remote === true }) }).select().single();
        if (result.error?.code === "23505") result = await db.from("professional_quotes").select().eq("request_id", requestId).single();
        break;
      }
      case "syncSubscription": {
        v.object(payload, []);
        const response = await fetch(`${url}/functions/v1/revenuecat-sync`, { method: "POST", headers: { Authorization: `Bearer ${access}`, apikey: key, "Content-Type": "application/json" }, body: "{}" });
        if (!response.ok) return send(res, 503, { error: { message: "Não foi possível atualizar sua assinatura. Tente novamente em instantes." } });
        return send(res, 200, { data: { synced: true } });
      }
      case "profile":
        v.object(payload, []);
        result = await db.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle(); break;
      case "services": {
        const item = v.object(payload, ["page", "mine"]);
        const page = item.page === undefined ? 0 : Number(item.page);
        if (!Number.isSafeInteger(page) || page < 0) throw new v.InputError("Página inválida.");
        const query = db.from("services").select(SERVICE_COLUMNS).order("created_at", { ascending: false }).order("id").range(page * 100, page * 100 + 99);
        if (item.mine === true) query.eq("provider_id", user.id);
        const services = await query;
        if (services.error) throw services.error;
        const providerIds = services.data.flatMap((row) => row.provider_id ? [row.provider_id] : []);
        const [premium, names, unavailable] = await Promise.all([
          db.rpc("catalog_premium_providers", { provider_ids: providerIds }),
          db.rpc("catalog_provider_names", { provider_ids: providerIds }),
          db.rpc("catalog_unavailable_providers", { provider_ids: providerIds }),
        ]);
        if (premium.error) throw premium.error;
        if (names.error && names.error.code !== "PGRST202") throw names.error;
        if (unavailable.error && unavailable.error.code !== "PGRST202") throw unavailable.error;
        const full = new Set<string>(unavailable.data ?? []);
        const active = new Set<string>(premium.data ?? []);
        result = { data: services.data.map((row) => ({ ...row, provider: names.data?.[row.provider_id] ?? row.provider, provider_premium: !!row.provider_id && active.has(row.provider_id), unavailable: !!row.provider_id && full.has(row.provider_id) })), error: null };
        break;
      }
      case "publishService": {
        const item = v.object(payload, ["id", "title", "description", "price", "remote", "image", "photos", "provider", "category", "fixed_price_cents", "price_negotiable"]);
        const id = v.uuid(item.id);
        const title = v.text(item.title, 100, 3);
        const description = v.text(item.description, 1000);
        const pricing = servicePricing(item);
        if (findForbiddenService(title) || findForbiddenService(description)) throw new v.InputError("Informe um serviço permitido.");
        if (typeof item.remote !== "boolean") throw new v.InputError("Informe como o serviço será prestado.");
        const profile = await db.from("profiles").select("role,uf,city,neighborhood,first_name").eq("id", user.id).single();
        if (profile.error) throw profile.error;
        if (profile.data.role !== "profissional") return send(res, 403, { error: { message: "Recurso disponível para profissionais." } });
        const { uf, city, neighborhood } = profile.data;
        if (!item.remote && (!uf || !city || !neighborhood)) throw new v.InputError("Informe a região de atendimento.");
        const photos = portfolioPaths(item.photos ?? [], user.id, id);
        if (photos.length && item.image) throw new v.InputError("Formato de portfólio inválido.");
        const category = item.category === undefined ? title : v.text(item.category, 100, 3);
        if (findForbiddenService(category)) throw new v.InputError("Escolha uma categoria permitida.");
        const provider = profile.data.first_name?.trim();
        if (!provider) return send(res, 400, { error: { code: "PT400", message: "Preencha seu primeiro nome na Conta antes de publicar." } });
        const path = item.image ? `${user.id}/${id}.jpg` : null;
        if (path) await uploadPortfolioImage(db, path, item.image);
        result = await db.from("services").insert({
          id, title, description, ...pricing, category, provider, provider_id: user.id,
          remote: item.remote, portfolio_path: path,
          ...(photos.length ? { portfolio_paths: photos } : {}),
          uf: item.remote ? "" : uf, city: item.remote ? "" : city,
          neighborhood: item.remote ? "" : neighborhood,
        }).select("id").single();
        if (result.error?.code === "23505") result = await db.from("services").select("id").eq("id", id).eq("provider_id", user.id).single();
        break;
      }
      case "uploadPortfolioPhoto": {
        const item = v.object(payload, ["id", "photoId", "image"]);
        const id = v.uuid(item.id);
        const photoId = v.uuid(item.photoId);
        const path = `${user.id}/${id}-${photoId}.jpg`;
        await uploadPortfolioImage(db, path, item.image);
        return send(res, 200, { data: null });
      }
      case "updatePortfolio": {
        const item = v.object(payload, ["id", "photos", "category", "title", "price", "fixed_price_cents", "price_negotiable"]);
        const id = v.uuid(item.id);
        const photos = portfolioPaths(item.photos, user.id, id);
        const category = item.category === undefined ? undefined : v.text(item.category, 100, 3);
        const title = item.title === undefined ? undefined : v.text(item.title, 100, 3);
        if ((category && findForbiddenService(category)) || (title && findForbiddenService(title))) throw new v.InputError("Escolha um nome e uma categoria permitidos.");
        const current = await db.from("services").select("portfolio_path,portfolio_paths").eq("id", id).eq("provider_id", user.id).single();
        if (current.error) throw current.error;
        result = await db.from("services").update({ portfolio_path: null, portfolio_paths: photos, category, title, ...(item.price === undefined ? {} : servicePricing(item)) }).eq("id", id).eq("provider_id", user.id).select("id").single();
        if (!result.error) {
          const previous: string[] = current.data.portfolio_paths.length ? current.data.portfolio_paths : [current.data.portfolio_path].filter(Boolean);
          const removed = previous.filter((path) => !photos.includes(path));
          if (removed.length) await db.storage.from("service-portfolio").remove(removed);
        }
        break;
      }
      case "professionalReviews":
        v.object(payload, []);
        result = await db.rpc("professional_reviews"); break;
      case "budgetContact": {
        const item = v.object(payload, ["id"]);
        result = await db.rpc("budget_contact", { budget_id: v.uuid(item.id) }); break;
      }
      case "profileSettings": {
        v.object(payload, []);
        const fields = "services,first_name,whatsapp,bio,instagram_url,website_url,whatsapp_business,avatar_path";
        result = await db.from("profiles").select(fields + ",birth_date").eq("id", user.id).single();
        if (result.error?.code === "42703") result = await db.from("profiles").select(fields).eq("id", user.id).single();
        break;
      }
      case "saveProfileSettings": {
        const { whatsapp: _phone, ...update } = v.profileSettings(payload);
        if (update.services.some(findForbiddenService)) throw new v.InputError("Escolha tipos de serviço permitidos.");
        const current = await db.from("profiles").select("avatar_path").eq("id", user.id).single();
        if (current.error) throw current.error;
        result = await db.from("profiles").update(update).eq("id", user.id).select("id").single();
        if (!result.error && current.data.avatar_path && current.data.avatar_path !== update.avatar_path) {
          await db.storage.from("service-portfolio").remove([current.data.avatar_path]);
        }
        break;
      }
      case "professionalCard": {
        const item = v.object(payload, ["provider"]);
        result = await db.rpc("professional_card", { provider: v.uuid(item.provider) }); break;
      }
      case "uploadProfileAvatar": {
        const item = v.object(payload, ["id", "image"]);
        const path = `${user.id}/avatar-${v.uuid(item.id)}.jpg`;
        try {
          await uploadPortfolioImage(db, path, item.image);
        } catch (error) {
          if (error instanceof v.InputError) throw error;
          const storage = error as { statusCode?: string };
          const missingBucket = storage.statusCode === "NoSuchBucket";
          const message = missingBucket
            ? "O armazenamento de fotos de perfil ainda não está disponível."
            : "O servidor não conseguiu receber a foto de perfil.";
          return send(res, 400, { error: { message } });
        }
        return send(res, 200, { data: null });
      }
      case "portfolioImage": {
        const item = v.object(payload, ["path"]);
        const path = v.text(item.path, 114);
        if (!/^[0-9a-f-]{36}\/(?:avatar-[0-9a-f-]{36}|[0-9a-f-]{36}(-([1-9]|10|[0-9a-f-]{36}))?)\.jpg$/.test(path)) throw new v.InputError("Imagem inválida.");
        const image = await db.storage.from("service-portfolio").download(path);
        if (image.error) throw image.error;
        return send(res, 200, { data: Buffer.from(await image.data.arrayBuffer()).toString("base64") });
      }
      case "budgets":
        v.object(payload, []);
        result = await db.from("budgets").select(BUDGET_COLUMNS).order("created_at", { ascending: false }).limit(100); break;
      case "jobs":
        v.object(payload, []);
        result = await db.from("completed_jobs").select(JOB_COLUMNS).order("created_at", { ascending: false }).limit(100); break;
      case "createBudget":
        result = await db.from("budgets").insert({ ...v.budgetInput(payload), user_id: user.id }).select(BUDGET_COLUMNS).single(); break;
      case "budgetQuote": {
        const quote = v.quoteInput(payload);
        result = await db.from("budgets").update({
          status: "cotado",
          quote_amount: quote.quote_amount,
          quote_message: quote.quote_message,
          delivery: quote.delivery,
        }).eq("id", quote.id).select("id").single(); break;
      }
      case "budgetStatus": {
        const data = v.object(payload, ["id", "status"]);
        result = await db.from("budgets").update({ status: v.budgetStatus(data.status) }).eq("id", v.uuid(data.id)).select("id").single(); break;
      }
      case "rating": {
        const data = v.object(payload, ["id", "rating"]);
        result = await db.from("completed_jobs").update({ rating: v.rating(data.rating) }).eq("id", v.uuid(data.id)).select("id").single(); break;
      }
      default: return send(res, 404, { error: { message: "Operação não encontrada." } });
    }
    if (result.error) throw result.error;
    return send(res, 200, { data: result.data });
  } catch (error) {
    const err = error as { code?: string; status?: number; details?: string; message?: string };
    const limited = err.code === "PT429" || err.status === 429;
    const status = error instanceof v.InputError || error instanceof SyntaxError ? 400 : limited ? 429 : err.status && err.status < 500 ? err.status : err.code ? 400 : 500;
    // não manda detalhes do banco, tokens ou dados pessoais na mensagem de erro
    return send(res, status, { error: { status, code: limited ? "PT429" : err.code,
      details: err.code === "PT429" ? err.details : undefined,
      message: err.code === "PT402" ? "Você usou os 10 orçamentos deste mês. Aguarde a renovação da franquia." : error instanceof v.InputError ? error.message : ["PT400", "PT409"].includes(err.code ?? "") && err.message ? err.message : limited ? "Limite temporário atingido." : "Não foi possível concluir a operação. Confira os dados e tente novamente." } });
  }
}
