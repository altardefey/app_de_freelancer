const { test, expect } = require("@playwright/test");
const { mkdirSync, readFileSync } = require("node:fs");
const id = "00000000-0000-0000-0000-000000000001";
async function fixture(
  page,
  { signedIn = true, role = "profissional", used = 0, premium = false, accepted = true, jobs = [], budgets = [] } = {},
) {
  const state = { signedIn, used, premium, accepted, profileSettings: { first_name: "Marina", whatsapp: "11912345678", services: [], bio: null, instagram_url: null, website_url: null, whatsapp_business: null, avatar_path: null }, quotes: [], sent: [], requests: [] };
  await page.route("**/api/gateway", async (route) => {
    const { action, payload } = route.request().postDataJSON();
    state.requests.push(action);
    let data;
    const user = { id, email: "profissional@example.test" };
    switch (action) {
      case "session":
        data = { user: state.signedIn ? user : null };
        break;
      case "login":
        state.signedIn = true;
        data = { user, session: { user } };
        break;
      case "profileSettings":
        data = state.profileSettings;
        break;
      case "saveProfileSettings":
        state.profileSettings = payload;
        data = { id };
        break;
      case "professionalCard":
        data = null;
        break;
      case "profile":
        data = { id, role, city: "", uf: "", neighborhood: "" };
        break;
      case "legalStatus":
        data = { version: "2026-11-09.1", accepted: state.accepted };
        break;
      case "requestPasswordReset":
      case "completePasswordReset":
        state.sent.push({ action, ...payload });
        data = null;
        break;
      case "acceptLegal":
        state.accepted = payload.version === "2026-11-09.1";
        data = null;
        break;
      case "uploadPortfolioPhoto":
        state.sent.push(payload);
        data = null;
        break;
      case "publishService":
        state.sent.push(payload);
        data = { id: payload.id };
        break;
      case "freelaUsage":
        data = {
          used: state.used,
          limit: 10,
          premium: state.premium,
          resetsAt: "2026-11-01T03:00:00Z",
        };
        break;
      case "quotes":
        data = state.quotes;
        break;
      case "budgets":
        data = budgets;
        break;
      case "budgetContact":
        data = "11912345678";
        break;
      case "budgetQuote":
        if (state.used >= 10) {
          await route.fulfill({ status: 400, json: { error: { code: "PT402" } } });
          return;
        }
        state.used++;
        state.sent.push(payload);
        Object.assign(budgets.find((budget) => budget.id === payload.id), {
          status: "cotado", quote_amount: payload.quoteAmount, quote_message: payload.quoteMessage, delivery: payload.delivery,
        });
        data = { id: payload.id };
        break;
      case "professionalReviews":
      case "jobs":
        data = jobs;
        break;
      case "rating":
        jobs.find((job) => job.id === payload.id).rating = payload.rating;
        data = { id: payload.id };
        break;
      case "services":
        data = [
          {
            id: "00000000-0000-0000-0000-000000000002",
            provider_id: id,
            title: "Pintura residencial",
            provider: "Ana Souza",
            price: "R$ 250",
            category: "Pintura",
            description: "Pintura de paredes e acabamento para sua casa.",
            uf: "SP",
            city: "São Paulo",
            neighborhood: "Centro",
          },
          { id: "remote-art", provider_id: id, title: "Arte digital", category: "Arte digital", remote: true },
        ];
        break;
      case "createBudget":
        state.sent.push(payload);
        data = { id: "budget-one", ...payload };
        break;
      case "createQuote":
        await new Promise((resolve) => setTimeout(resolve, 250));
        state.used++;
        data = {
          id: "quote-" + state.used,
          user_id: id,
          ...payload,
          created_at: "2026-10-13T12:00:00Z",
        };
        state.quotes.unshift(data);
        break;
      default:
        data = {};
    }
    await route.fulfill({ json: { data } });
  });
  return state;
}
async function screenshot(page, name) {
  mkdirSync("test-results/screenshots", { recursive: true });
  await page.screenshot({
    path: "test-results/screenshots/" + name + ".png",
    fullPage: true,
  });
}
test("login responsive, accessible fields, professional navigation", async ({
  page,
}) => {
  const state = await fixture(page, { signedIn: false });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Entre no Freela")).toBeVisible();
  await screenshot(page, "login-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await screenshot(page, "login-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("profissional@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page.getByText("Painel profissional")).toBeVisible();
  await screenshot(page, "home-mobile");
  await page.getByRole("tab", { name: "Orçamentos" }).click();
  await expect(page.getByText("Pedidos recebidos", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Freela+", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Assinar Freela+" }),
  ).toBeDisabled();
  await screenshot(page, "plus-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await screenshot(page, "plus-desktop");
  expect(errors).toEqual([]);
});
const sampleOrder = {
  id: "00000000-0000-0000-0000-000000000009",
  client: "Maria",
  service: "Pintura <teste>",
  value: "R$ 125,50",
  details: "Pintar a sala de 20 metros.",
  agreed_price_cents: 12550,
  remote: false,
  status: "solicitado",
  created_at: "2026-10-13T12:00:00Z",
};
test("opening WhatsApp downloads the detailed quote PDF", async ({ page, context }) => {
  await fixture(page, { budgets: [{ ...sampleOrder }] });
  await context.route("https://wa.me/**", (route) => route.fulfill({ body: "WhatsApp" }));
  await page.goto("/orcamentos");
  await page.getByLabel("Prazo ou dias disponíveis").fill("Quarta-feira");
  await page.getByRole("button", { name: "Salvar proposta" }).click();
  const [download, chat] = await Promise.all([
    page.waitForEvent("download"),
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Abrir WhatsApp do cliente" }).click(),
  ]);
  await chat.waitForURL("https://wa.me/5511912345678?*");
  expect(new URL(chat.url()).searchParams.get("text")).toContain("Quarta-feira");
  expect(download.suggestedFilename()).toBe("orcamento-freela.pdf");
  const pdf = readFileSync(await download.path(), "ascii");
  expect(pdf).toMatch(/^%PDF-/);
  expect(pdf).toContain("Cliente: Maria");
  expect(pdf).toContain("Pintar a sala de 20 metros.");
  expect(pdf).toContain("125,50");
  expect(pdf).toContain("Quarta-feira");
});
test("eleventh proposal preserves its delivery draft", async ({ page }) => {
  await fixture(page, { used: 10, budgets: [{ ...sampleOrder }] });
  await page.goto("/orcamentos");
  await page.getByLabel("Prazo ou dias disponíveis").fill("Quarta-feira");
  await page.getByRole("button", { name: "Salvar proposta" }).click();
  await expect(page.getByText("Você usou os 10 orçamentos deste mês.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Prazo ou dias disponíveis")).toHaveValue("Quarta-feira");
});
test("premium professional can quote a service with negotiable price", async ({ page }) => {
  const state = await fixture(page, { used: 9, premium: true, budgets: [{ ...sampleOrder, agreed_price_cents: null, remote: true }] });
  await page.goto("/orcamentos");
  await page.getByLabel("Valor da proposta (R$)").fill("250,00");
  await page.getByLabel("Prazo de entrega").fill("3 dias úteis");
  await page.getByRole("button", { name: "Salvar proposta" }).click();
  await expect(page.getByRole("button", { name: "Abrir WhatsApp do cliente" })).toBeVisible();
  expect(state.sent[0]).toMatchObject({ quoteAmount: 250, delivery: "3 dias úteis" });
});
test("client request keeps draft and sends details", async ({ page }) => {
  const state = await fixture(page, { role: "cliente" });
  await page.goto("/");
  const listing = page.getByRole("button", { name: "Ver serviço Pintura residencial", exact: true });
  await expect(listing).toBeVisible();
  await screenshot(page, "client-mobile");
  await listing.click();
  await page
    .getByRole("textbox", { name: "Descreva o serviço de que você precisa" })
    .fill("Pintar a sala de 20 metros.");
  await page.getByRole("button", { name: "Fechar serviço" }).click();
  await listing.click();
  await expect(
    page.getByRole("textbox", { name: "Descreva o serviço de que você precisa" }),
  ).toHaveValue("Pintar a sala de 20 metros.");
  await expect(page.getByText("Ao enviar o pedido", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(
    page.getByText(
      "Pedido enviado. O profissional já pode consultar sua solicitação.",
    ),
  ).toBeVisible();
  expect(state.sent[0].details).toBe("Pintar a sala de 20 metros.");
  expect(state.sent[0].shareContact).toBe(true);
  expect(state.sent[0]).not.toHaveProperty("whatsapp");
});
test("registration retains step when returning from login, narrow viewport", async ({
  page,
}) => {
  await fixture(page, { signedIn: false });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "Criar uma conta grátis" }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByText("Localização")).toBeVisible();
  await screenshot(page, "register-mobile");
  await page.getByRole("button", { name: "Voltar ao login" }).click();
  await page.getByRole("button", { name: "Criar uma conta grátis" }).click();
  await expect(page.getByText("Localização")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("Freela+ price and comparison fit a narrow phone", async ({ page }) => {
  await fixture(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/freela-plus");
  const price = page.getByText("R$ 14,99", { exact: true }).first();
  await price.scrollIntoViewIfNeeded();
  await screenshot(page, "plus-narrow-price");
  const box = await price.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(
    await price.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page
    .getByText("A franquia grátis renova", { exact: false })
    .scrollIntoViewIfNeeded();
  await screenshot(page, "plus-narrow-comparison");
});

test("legal renewal requires both acknowledgements and dark mode persists", async ({ page }) => {
  const state = await fixture(page, { signedIn: false, accepted: false });
  await page.goto("/");
  await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("profissional@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page.getByText("Revise os documentos do Freela")).toBeVisible();
  await page.getByRole("link", { name: "Ler Termos de Uso" }).click();
  await expect(page.getByText("Versão 2026-11-09.1")).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page.getByText("Revise os documentos do Freela")).toBeVisible();
  expect(state.requests).not.toContain("logout");
  await page.getByRole("checkbox", { name: "Aceito os Termos de Uso" }).click();
  const accept = page.getByRole("button", { name: "Aceitar e continuar" });
  await expect(accept).toBeDisabled();
  await page.getByRole("checkbox", { name: "Li a Política de Privacidade" }).click();
  await accept.click();
  await expect(page.getByText("Revise os documentos do Freela")).toHaveCount(0);
  expect(state.accepted).toBe(true);
  const dark = page.getByRole("switch", { name: "Modo escuro" });
  await dark.click();
  await expect(dark).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(dark).toHaveCount(1);
  await expect(dark).toHaveAttribute("aria-checked", "true");
});

test("quote preview includes the edited note and fixed address request", async ({ page }) => {
  const state = await fixture(page, { budgets: [{ ...sampleOrder }] });
  await page.goto("/orcamentos");
  await expect(page.getByText("Maria", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Valor da proposta (R$)")).toHaveCount(0);
  await page.getByLabel("Prazo ou dias disponíveis").fill("Segunda a quarta");
  await page.getByRole("button", { name: "Salvar proposta" }).click();
  await expect(page.getByRole("button", { name: "Abrir WhatsApp do cliente" })).toBeVisible();
  expect(state.sent[0]).toMatchObject({ quoteAmount: 125.5, delivery: "Segunda a quarta" });
  await page.getByRole("textbox", { name: "Mensagem para o cliente" }).fill("Veja minha proposta.");
  const preview = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Abrir prévia para salvar em PDF" }).click();
  const popup = await preview;
  await expect(popup.getByText("Pintura <teste>")).toBeVisible();
  await expect(popup.getByText("Segunda a quarta", { exact: false })).toBeVisible();
  await expect(popup.getByText("Pintar a sala de 20 metros.", { exact: true })).toBeVisible();
  await expect(popup.getByText("Veja minha proposta.", { exact: false })).toBeVisible();
  await expect(popup.getByText("Por favor, responda com o endereço completo", { exact: false })).toBeVisible();
});

test("a remote service publishes without a local address and appears under remote services", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Gerenciar meus anúncios" }).click();
  await page.getByRole("button", { name: "Adicionar um serviço" }).click();
  await expect(page.getByRole("textbox", { name: "Seu nome no anúncio" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Buscar categoria" }).fill("design gráfico");
  await page.getByRole("button", { name: "Design gráfico", exact: true }).click();
  await page.getByRole("textbox", { name: "Buscar categoria" }).fill("arte digital");
  await page.getByRole("button", { name: "Arte digital", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remover categoria Design gráfico" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Nome do serviço" }).fill("Arte digital");
  await page.getByRole("textbox", { name: "Descrição do trabalho" }).fill("Criação de ilustrações");
  await page.getByRole("textbox", { name: "Valor do serviço" }).fill("A combinar");
  await page.getByRole("switch", { name: "Serviço remoto para todo o Brasil" }).click();
  const picker = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Adicionar foto do portfólio (opcional)" }).click();
  await (await picker).setFiles("assets/images/favicon.png");
  await expect(page.getByLabel("Prévia do portfólio")).toBeVisible();
  await page.getByRole("button", { name: "Publicar serviço" }).click();
  await expect(page.getByText("Serviço publicado no catálogo.")).toBeVisible();
  expect(state.sent[0].image).toMatch(/^\/9j\//);
  expect(state.sent[1]).toMatchObject({ remote: true, price: "A combinar", category: "Arte digital" });
  expect(state.sent[1]).not.toHaveProperty("provider");
  expect(state.sent[1].photos).toHaveLength(1);
  await fixture(page, { role: "cliente" });
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Só serviços remotos" }).click();
  await expect(page.getByRole("button", { name: "Ver serviço Arte digital", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver serviço Pintura residencial", exact: true })).toHaveCount(0);
});

test("password recovery opens from login and checks the repeated password", async ({ page }) => {
  const state = await fixture(page, { signedIn: false });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Reenviar e-mail de confirmação" })).toHaveCount(0);
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("pessoa@example.test");
  await page.getByRole("button", { name: "Enviar código por e-mail" }).click();
  await page.getByLabel("Código do e-mail").fill("123456");
  await page.getByLabel("Nova senha", { exact: true }).fill("NovaSenha123!");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("As duas senhas precisam ser iguais.")).toBeVisible();
  await page.getByLabel("Repita a nova senha").fill("NovaSenha123!");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByText("Senha alterada", { exact: true })).toBeVisible();
  expect(state.sent.map((item) => item.action)).toEqual(["requestPasswordReset", "completePasswordReset"]);
});

test("login opens the registered client area without choosing a profile", async ({ page }) => {
  const state = await fixture(page, { signedIn: false, role: "cliente" });
  await page.goto("/");
  await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("cliente@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page.getByRole("tab", { name: "Explorar" })).toBeVisible();
  expect(state.requests.filter((action) => action === "session")).toHaveLength(1);
});

test("client rates completed services from account", async ({ page }) => {
  await fixture(page, { role: "cliente", jobs: [
    { id: "00000000-0000-0000-0000-000000000012", title: "Montagem de mesa", provider: "Marina", rating: null },
    { id: "00000000-0000-0000-0000-000000000013", title: "Arte digital", provider: "Joana", rating: 4 },
  ] });
  await page.goto("/");
  await expect(page.getByText("Serviços concluídos", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByText("Para avaliar · 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Já avaliados · 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Avaliar Montagem de mesa com 5 estrelas" }).click();
  await expect(page.getByText("Já avaliados · 2", { exact: true })).toBeVisible();
  await screenshot(page, "history-client-mobile");
});

test("professional manages listings and account on separate pages", async ({ page }) => {
  await fixture(page, { premium: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Gerenciar meus anúncios" }).click();
  await expect(page).toHaveURL(/\/meus-anuncios$/);
  await expect(page.getByRole("button", { name: "Editar perfil profissional" })).toHaveCount(0);
  await expect(page.getByText("Configurações", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sair da conta" })).toHaveCount(0);
  await page.getByRole("button", { name: "Adicionar um serviço" }).click();
  await expect(page.getByText("Portfólio · 0 de 10 fotos")).toBeVisible();
  await page.getByRole("tab", { name: "Conta" }).click();
  await expect(page.getByRole("button", { name: "Editar perfil profissional" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible();
  await expect(page.getByText("Meus anúncios", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Serviços concluídos", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelar assinatura" }).click();
  await expect(page.getByRole("button", { name: "Assinaturas da App Store" })).toBeVisible();
  await screenshot(page, "account-professional-mobile");
});

test("registration shows password and reports the missing rules on Enter", async ({ page }) => {
  await fixture(page, { signedIn: false });
  await page.route("https://viacep.com.br/ws/**", (route) => route.fulfill({
    headers: { "access-control-allow-origin": "*" },
    json: { logradouro: "Rua de teste", bairro: "Centro", localidade: "São Paulo", uf: "SP" },
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Criar uma conta grátis" }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByPlaceholder("CEP", { exact: true }).fill("01001000");
  await expect(page.getByText("São Paulo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("textbox", { name: "Buscar tipos de serviço" }).fill("arte digital");
  await page.getByRole("button", { name: "Arte digital", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const field = page.getByLabel("Senha", { exact: true }).and(page.locator('[autocomplete="new-password"]'));
  await field.fill("Senha");
  await expect(page.getByLabel("Uma letra maiúscula, cumprido")).toBeVisible();
  await expect(page.getByLabel("Um número, pendente")).toBeVisible();
  await field.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Use uma senha de");
  await screenshot(page, "registration-password-mobile");
  await page.getByRole("checkbox", { name: "Mostrar senha" }).click();
  await expect(field).not.toHaveAttribute("type", "password");
  await field.fill("SenhaLonga123!");
  await expect(page.getByLabel("Um símbolo, cumprido")).toBeVisible();
});

test("professional edits public profile and opens legal documents from settings", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/conta");
  await expect(page.getByRole("link", { name: "Ler Termos de Uso" })).toHaveCount(0);
  await page.getByRole("button", { name: "Termos e privacidade" }).click();
  await expect(page.getByRole("link", { name: "Ler Termos de Uso" })).toBeVisible();
  await page.getByRole("button", { name: "Editar perfil profissional" }).click();
  await page.getByRole("textbox", { name: "Bio", exact: true }).fill("Ilustração editorial");
  await page.getByRole("textbox", { name: "Instagram profissional" }).fill("instagram.com/marina");
  await page.getByRole("textbox", { name: "WhatsApp Business" }).fill("(11) 91234-5678");
  await page.getByRole("textbox", { name: "Buscar tipos de serviço" }).fill("Ilustração editorial");
  await page.getByRole("button", { name: "Criar categoria “Ilustração editorial”" }).click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("button", { name: "WhatsApp Business" })).toBeVisible();
  expect(state.profileSettings).toMatchObject({ services: ["Ilustração editorial"], instagram_url: "https://instagram.com/marina", whatsapp_business: "11912345678" });
});
