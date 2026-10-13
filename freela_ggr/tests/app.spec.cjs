const { test, expect } = require("@playwright/test");
const { mkdirSync } = require("node:fs");
const id = "00000000-0000-0000-0000-000000000001";
async function fixture(
  page,
  { signedIn = true, role = "profissional", used = 0, premium = false } = {},
) {
  const state = { signedIn, used, premium, quotes: [], sent: [], requests: [] };
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
      case "profile":
        data = { id, role, city: "", uf: "", neighborhood: "" };
        break;
      case "freelaUsage":
        data = {
          used: state.used,
          limit: 5,
          premium: state.premium,
          resetsAt: "2026-11-01T03:00:00Z",
        };
        break;
      case "quotes":
        data = state.quotes;
        break;
      case "budgets":
      case "jobs":
        data = [];
        break;
      case "services":
        data = [
          {
            id: "service-one",
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
  mkdirSync("output/freela-redesign", { recursive: true });
  await page.screenshot({
    path: "output/freela-redesign/" + name + ".png",
    fullPage: true,
  });
}
test("login responsive, accessible fields, professional navigation and draft", async ({
  page,
}) => {
  const state = await fixture(page, { signedIn: false });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Vamos começar?")).toBeVisible();
  await screenshot(page, "login-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await screenshot(page, "login-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("profissional@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Entrar na minha conta" }).click();
  await expect(page.getByText("Seu trabalho, em dia.")).toBeVisible();
  await screenshot(page, "home-mobile");
  await page
    .getByRole("button", { name: "Novo orçamento", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nome do cliente" })
    .fill("Maria Almeida");
  await page
    .getByRole("textbox", { name: "Descrição do serviço" })
    .fill("Pintura de duas paredes");
  await page
    .getByRole("textbox", { name: "Valor total (R$)", exact: true })
    .fill("1.250,90");
  await screenshot(page, "quote-mobile");
  await page.getByRole("button", { name: "Voltar aos orçamentos" }).click();
  await page
    .getByRole("button", { name: "Novo orçamento", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Nome do cliente" }),
  ).toHaveValue("Maria Almeida");
  await page.getByRole("button", { name: "Salvar orçamento" }).dblclick();
  await expect(page.getByText("Pronto para fechar.")).toBeVisible();
  expect(state.quotes.length).toBe(1);
  expect(state.quotes[0].amount_cents).toBe(125090);
  await page.getByRole("tab", { name: "Freela+", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Assinar Freela+" }),
  ).toBeDisabled();
  await screenshot(page, "plus-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await screenshot(page, "plus-desktop");
  expect(errors).toEqual([]);
});
test("sixth quote blocks UI and links to upgrade", async ({ page }) => {
  await fixture(page, { used: 5 });
  await page.goto("/novo-orcamento");
  await expect(
    page.getByText(
      "Você chegou aos 5 orçamentos deste mês. Seu rascunho continua salvo.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salvar orçamento" }),
  ).toBeDisabled();
  await screenshot(page, "limit-mobile");
  await page
    .getByRole("button", { name: "Criar sem limites com Freela+" })
    .click();
  await expect(page.getByText("Seu talento", { exact: false })).toBeVisible();
});
test("premium does not block after five quotes", async ({ page }) => {
  await fixture(page, { used: 12, premium: true });
  await page.goto("/novo-orcamento");
  await expect(
    page.getByRole("button", { name: "Salvar orçamento" }),
  ).toBeEnabled();
});
test("client request keeps draft and sends details", async ({ page }) => {
  const state = await fixture(page, { role: "cliente" });
  await page.goto("/");
  await expect(page.getByText("Pintura residencial")).toBeVisible();
  await screenshot(page, "client-mobile");
  await page.getByText("Pintura residencial", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "O que você precisa? (opcional)" })
    .fill("Pintar a sala de 20 metros.");
  await page.getByRole("button", { name: "Fechar serviço" }).click();
  await page.getByText("Pintura residencial", { exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "O que você precisa? (opcional)" }),
  ).toHaveValue("Pintar a sala de 20 metros.");
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(
    page.getByText(
      "Pedido enviado. O profissional já pode consultar sua solicitação.",
    ),
  ).toBeVisible();
  expect(state.sent[0].details).toBe("Pintar a sala de 20 metros.");
});
test("registration retains step when returning from login, narrow viewport", async ({
  page,
}) => {
  await fixture(page, { signedIn: false });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "Criar uma conta grátis" }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByText("Perto de você.")).toBeVisible();
  await screenshot(page, "register-mobile");
  await page.getByRole("button", { name: "Voltar ao login" }).click();
  await page.getByRole("button", { name: "Criar uma conta grátis" }).click();
  await expect(page.getByText("Perto de você.")).toBeVisible();
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
