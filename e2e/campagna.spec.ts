import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Una serata tipo, con quattro persone vere (quattro browser separati):
 * il Master, due giocatori e un estraneo. Controlla soprattutto CHI VEDE COSA.
 */

const PASSWORD = "segreta123";

async function signUp(browser: Browser, username: string, displayName: string, baseURL: string) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: "Prima volta? Crea un account" }).click();
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="name"]').fill(displayName);
  await page.getByRole("button", { name: "Crea account" }).click();
  await expect(page.getByText(`Ciao, ${displayName}`)).toBeVisible();
  return page;
}

async function writeEntry(page: Page, campaignUrl: string, body: string, isPublic: boolean) {
  await page.goto(campaignUrl);
  const textarea = page.locator('textarea[name="body"]').first();
  await textarea.fill(body);
  if (isPublic) await page.locator('form:has(textarea[name="body"]) input[name="public"]').check();
  await page.getByRole("button", { name: "Salva nel diario" }).click();
  await expect(textarea).toHaveValue("");
}

test("una campagna dall'inizio: visibilità, compendio, frasi, cassa, AI", async ({ browser, baseURL }, testInfo) => {
  const run = `${testInfo.project.name.slice(0, 3)}${Date.now().toString(36)}`;
  const gm = await signUp(browser, `master${run}`, "Master Ada", baseURL!);
  const p1 = await signUp(browser, `bea${run}`, "Bea", baseURL!);
  const p2 = await signUp(browser, `carlo${run}`, "Carlo", baseURL!);
  const outsider = await signUp(browser, `estraneo${run}`, "Estraneo", baseURL!);

  let campaignUrl = "";
  let code = "";

  await test.step("il Master crea la campagna e legge il codice invito", async () => {
    await gm.getByLabel("Nome della campagna").fill("Le Cronache di Prova");
    await gm.getByRole("button", { name: "Crea campagna" }).click();
    await expect(gm.getByRole("heading", { name: "Le Cronache di Prova" })).toBeVisible();
    campaignUrl = new URL(gm.url()).pathname;
    code = (await gm.locator("span.select-all").innerText()).trim();
    expect(code).toMatch(/^[A-F0-9]{8}$/);
  });

  await test.step("i giocatori entrano con il codice", async () => {
    for (const p of [p1, p2]) {
      await p.goto("/");
      await p.getByLabel("Codice invito").fill(code);
      await p.getByRole("button", { name: "Entra nella campagna" }).click();
      await expect(p).toHaveURL(new RegExp(`${campaignUrl}/scheda$`));
    }
  });

  await test.step("Bea scrive una voce privata e una pubblica", async () => {
    await writeEntry(p1, campaignUrl, "Segreto: @Ombra ci osserva dal tetto.\n? Chi è Ombra?", false);
    await writeEntry(p1, campaignUrl, "Pubblico: @Velia ci guida a #Portocielo con **coraggio**.\n! Raggiungere il faro", true);
    await expect(p1.getByText("Segreto:")).toBeVisible();
    await expect(p1.getByText("Pubblico:")).toBeVisible();
    await expect(p1.locator("strong", { hasText: "coraggio" })).toBeVisible();
  });

  await test.step("Carlo vede solo la voce pubblica di Bea", async () => {
    await p2.goto(campaignUrl);
    await expect(p2.getByText("Pubblico:")).toBeVisible();
    await expect(p2.getByText("Segreto:")).toHaveCount(0);
    await p2.goto(`${campaignUrl}/compendio`);
    await expect(p2.getByText("Velia", { exact: true })).toBeVisible();
    await expect(p2.getByText("Ombra", { exact: true })).toHaveCount(0);
    await p2.goto(`${campaignUrl}/fili`);
    await expect(p2.getByText("Chi è Ombra?")).toHaveCount(0);
    await expect(p2.getByText("Raggiungere il faro")).toHaveCount(0);
  });

  await test.step("Carlo carica l'immagine di Velia e Bea la vede", async () => {
    await p2.goto(`${campaignUrl}/compendio/npc/velia`);
    // Il caricamento parte da JavaScript: aspettiamo che la pagina sia idratata.
    await p2.waitForLoadState("networkidle");
    await p2.locator('input[type="file"]').setInputFiles("public/icons/icon-192.png");
    await expect(p2.getByText("Immagine caricata da te")).toBeVisible();
    await p1.goto(`${campaignUrl}/compendio/npc/velia`);
    await expect(p1.getByRole("img", { name: "Velia" })).toBeVisible();
    await expect(p1.getByText("Immagine caricata da Carlo")).toBeVisible();
  });

  await test.step("il Master vede tutto, anche fili e obiettivi di Bea", async () => {
    await gm.goto(campaignUrl);
    await expect(gm.getByText("Segreto:")).toBeVisible();
    await expect(gm.getByText("Pubblico:")).toBeVisible();
    await gm.goto(`${campaignUrl}/fili`);
    await expect(gm.getByText("Chi è Ombra?")).toBeVisible();
    await expect(gm.getByText("Raggiungere il faro")).toBeVisible();
  });

  await test.step("un estraneo non può aprire la campagna", async () => {
    await outsider.goto(campaignUrl);
    await expect(outsider.getByText("Qui non c'è niente")).toBeVisible();
  });

  await test.step("Bea modifica la sua voce privata", async () => {
    await p1.goto(campaignUrl);
    const card = p1.locator("article", { hasText: "Segreto:" });
    await card.getByRole("button", { name: "Modifica" }).click();
    await card.locator('textarea[name="body"]').fill("Segreto corretto: @Ombra era un gatto.");
    await card.getByRole("button", { name: "Salva modifiche" }).click();
    await expect(p1.getByText("Segreto corretto:")).toBeVisible();
  });

  await test.step("scrivendo @Ve compare il suggerimento Velia", async () => {
    await p2.goto(campaignUrl);
    await p2.waitForLoadState("networkidle");
    const textarea = p2.locator('textarea[name="body"]').first();
    await textarea.click();
    await textarea.pressSequentially("Oggi @Ve", { delay: 30 });
    await expect(p2.getByRole("option", { name: /Velia/ })).toBeVisible();
    await textarea.press("Enter");
    await expect(textarea).toHaveValue("Oggi @Velia ");
  });

  await test.step("frasi memorabili: le vede tutto il gruppo", async () => {
    await p1.goto(`${campaignUrl}/frasi`);
    await p1.getByLabel("La frase").fill("Non toccate la bussola!");
    await p1.getByLabel("Chi l'ha detta").fill("@[Mastro Odo]");
    await p1.getByRole("button", { name: "Salva la frase" }).click();
    await expect(p1.getByText("Non toccate la bussola!")).toBeVisible();
    await p2.goto(`${campaignUrl}/frasi`);
    await expect(p2.getByText("Non toccate la bussola!")).toBeVisible();
  });

  await test.step("cassa e inventario del gruppo", async () => {
    await p2.goto(`${campaignUrl}/cassa`);
    await p2.getByLabel("Zenit").fill("300");
    await p2.getByLabel("Motivo").fill("Ricompensa del borgomastro");
    await p2.getByRole("button", { name: "Registra" }).click();
    await expect(p2.getByText("Ricompensa del borgomastro")).toBeVisible();
    await p2.getByLabel("Oggetto").fill("Bussola d'ottone");
    await p2.getByRole("button", { name: "Aggiungi all'inventario" }).click();
    await expect(p2.getByText("Bussola d'ottone")).toBeVisible();

    await p1.goto(`${campaignUrl}/cassa`);
    await expect(p1.getByText("300", { exact: true })).toBeVisible();
    await expect(p1.getByText("Bussola d'ottone")).toBeVisible();
  });

  await test.step("la scheda resta privata, ma il nome del PG lo vedono tutti", async () => {
    await p1.goto(`${campaignUrl}/scheda/modifica`);
    await p1.locator('input[name="name"]').fill("Kael Senzaterra");
    await p1.locator('input[name="identity"]').fill("Mercenario in cerca di riscatto");
    await p1.getByRole("button", { name: "Salva scheda" }).click();
    await expect(p1.getByText("Scheda salvata.")).toBeVisible();

    await p2.goto(campaignUrl);
    await expect(p2.getByLabel("Il gruppo").getByText("Kael Senzaterra")).toBeVisible();
    await p2.goto(`${campaignUrl}/scheda`);
    await expect(p2.getByText("Mercenario in cerca di riscatto")).toHaveCount(0);

    await gm.goto(`${campaignUrl}/scheda`);
    await gm.locator("summary", { hasText: "Kael Senzaterra" }).click();
    await expect(gm.getByText("Mercenario in cerca di riscatto")).toBeVisible();
  });

  await test.step("ricerca", async () => {
    await p2.goto(`${campaignUrl}/cerca?q=Velia`);
    await expect(p2.getByRole("heading", { name: "Diario" })).toBeVisible();
    await p2.goto(`${campaignUrl}/cerca?q=Ombra`);
    await expect(p2.getByText("Nessun risultato")).toBeVisible();
  });

  await test.step("AI (finta): riassunto, tag suggeriti, libro", async () => {
    await p1.goto(campaignUrl);
    await p1.waitForLoadState("networkidle");
    await p1.getByRole("button", { name: "Scrivi il riassunto" }).click();
    await expect(p1.getByText("Testo di prova dell'AI finta.").first()).toBeVisible();

    await p1.locator('textarea[name="body"]').first().fill("Abbiamo rivisto Velia al porto.");
    await p1.getByRole("button", { name: "✨ Suggerisci tag" }).click();
    await expect(p1.getByText("Nomi da collegare al compendio")).toBeVisible();
    await p1.getByRole("button", { name: "Applica al testo" }).click();
    await expect(p1.locator('textarea[name="body"]').first()).toHaveValue(/@Velia al porto\.[\s\S]*\? Chi ha mandato il messaggero\?[\s\S]*! Raggiungere il faro/);

    await p1.goto(`${campaignUrl}/libro`);
    await p1.waitForLoadState("networkidle");
    await p1.getByRole("button", { name: "✨ Scrivi il capitolo 1" }).click();
    await expect(p1.getByText("Testo di prova dell'AI finta.")).toBeVisible();
  });

  await test.step("esportazione in Markdown", async () => {
    const res = await p1.request.get(`${campaignUrl}/esporta`);
    expect(res.ok()).toBe(true);
    const md = await res.text();
    expect(md).toContain("# Le Cronache di Prova");
    expect(md).toContain("Segreto corretto");
    const other = await p2.request.get(`${campaignUrl}/esporta`);
    expect(await other.text()).not.toContain("Segreto corretto");
  });
});
