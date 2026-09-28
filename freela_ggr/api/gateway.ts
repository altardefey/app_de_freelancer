import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient, type Session, type User } from "@supabase/supabase-js";
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
    if (Number(req.headers["content-length"] ?? 0) > 16384) return send(res, 413, { error: { message: "Envio muito grande." } });
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    if (Buffer.byteLength(raw) > 16384) return send(res, 413, { error: { message: "Envio muito grande." } });
    const input = v.object(JSON.parse(raw), ["action", "payload"]);
    const action = v.text(input.action, 40);
    const payload = input.payload ?? {};
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !/^https:\/\//.test(url) || !key?.startsWith("sb_publishable_")) throw new Error("server configuration");
    // nunca usa service_role: o banco continua validando o usuário com rls
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

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
      const result = action === "login" ? await client.auth.signInWithPassword(credentials) :
        await client.auth.signUp({ ...credentials, options: { captchaToken, data: v.profileMetadata(options.data) } });
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
    let result;
    switch (action) {
      case "profile":
        v.object(payload, []);
        result = await db.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle(); break;
      case "services":
        v.object(payload, []);
        result = await db.from("services").select(SERVICE_COLUMNS).order("created_at", { ascending: false }).limit(100); break;
      case "budgets":
        v.object(payload, []);
        result = await db.from("budgets").select(BUDGET_COLUMNS).order("created_at", { ascending: false }).limit(100); break;
      case "jobs":
        v.object(payload, []);
        result = await db.from("completed_jobs").select(JOB_COLUMNS).order("created_at", { ascending: false }).limit(100); break;
      case "createBudget":
        result = await db.from("budgets").insert({ ...v.budgetInput(payload), user_id: user.id }).select(BUDGET_COLUMNS).single(); break;
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
    const err = error as { code?: string; status?: number; details?: string };
    const limited = err.code === "PT429" || err.status === 429;
    const status = error instanceof v.InputError || error instanceof SyntaxError ? 400 : limited ? 429 : err.status && err.status < 500 ? err.status : err.code ? 400 : 500;
    // não manda detalhes do banco, tokens ou dados pessoais na mensagem de erro
    return send(res, status, { error: { status, code: limited ? "PT429" : err.code,
      details: err.code === "PT429" ? err.details : undefined,
      message: error instanceof v.InputError ? error.message : limited ? "Limite temporário atingido." : "Não foi possível concluir a operação. Confira os dados e tente novamente." } });
  }
}
