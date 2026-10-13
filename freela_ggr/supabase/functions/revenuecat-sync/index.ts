import { createClient } from "npm:@supabase/supabase-js@2";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const rcKey = Deno.env.get("REVENUECAT_SECRET_KEY");
    const webhookKey = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
    if (!rcKey) return reply(503, { error: "Billing not configured" });
    const admin = createClient(url, adminKey, {
      auth: { persistSession: false },
    });
    const authorization = req.headers.get("authorization") ?? "";
    let users: string[];
    if (webhookKey && authorization === webhookKey) {
      const raw = await req.text();
      if (raw.length > 65536) return reply(413, {});
      const { event } = JSON.parse(raw);
      if (event?.type === "TEST") return reply(200, { ok: true });
      // consulta o estado atual porque cancelar pode manter o acesso até o vencimento
      // um webhook antigo ou repetido não libera a assinatura por conta própria
      users = [
        ...new Set([
          event?.app_user_id,
          ...(event?.aliases ?? []),
          ...(event?.transferred_from ?? []),
          ...(event?.transferred_to ?? []),
        ]),
      ]
        .filter((id): id is string => typeof id === "string" && uuid.test(id))
        .slice(0, 100);
    } else {
      if (!authorization.startsWith("Bearer ")) return reply(401, {});
      const { data, error } = await admin.auth.getUser(authorization.slice(7));
      if (error || !data.user) return reply(401, {});
      users = [data.user.id];
    }
    for (const userId of users) {
      const { data: user } = await admin.auth.admin.getUserById(userId);
      if (!user.user) continue;
      const checkedAt = new Date().toISOString();
      const response = await fetch(
        "https://api.revenuecat.com/v1/subscribers/" +
          encodeURIComponent(userId),
        {
          headers: { Authorization: "Bearer " + rcKey },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) throw new Error("RevenueCat unavailable");
      const body = await response.json();
      const entitlement = body.subscriber?.entitlements?.freela;
      const subscription = entitlement
        ? body.subscriber?.subscriptions?.[entitlement.product_identifier]
        : null;
      const expiry = entitlement?.expires_date;
      const grace = subscription?.grace_period_expires_date;
      const expiresAt = expiry
        ? new Date(
            Math.max(Date.parse(expiry), grace ? Date.parse(grace) : 0),
          ).toISOString()
        : null;
      const sandboxAllowed =
        Deno.env.get("REVENUECAT_ALLOW_SANDBOX") === "true";
      const active =
        !!entitlement &&
        (!expiresAt || Date.parse(expiresAt) > Date.now()) &&
        (sandboxAllowed || subscription?.is_sandbox !== true);
      const { error } = await admin.rpc("record_freela_subscription", {
        p_user_id: userId,
        p_active: active,
        p_expires_at: expiresAt,
        p_checked_at: checkedAt,
      });
      if (error) throw error;
    }
    return reply(200, { synced: true });
  } catch {
    return reply(503, { error: "Subscription sync unavailable. Retry later." });
  }
});
