import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Una serata tipo, con quattro persone vere (quattro browser separati):
 * il Master, due giocatori e un estraneo. Controlla soprattutto CHI VEDE COSA.
 */

const PASSWORD = "segreta123";

/** Con E2E_SHOTS=<cartella> salva uno screenshot (chiaro e scuro): serve a controllare l'aspetto, non fa parte dei test. */
async function shot(page: Page, name: string, project: string) {
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  await page.waitForLoadState("networkidle");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(600); // le transizioni CSS devono finire
    await page.screenshot({ path: `${dir}/${name}-${scheme}-${project}.png`, fullPage: true });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

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
    await shot(p1, "diario", testInfo.project.name);
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
    await shot(p1, "compendio-velia", testInfo.project.name);
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

  await test.step("la creazione guidata produce una scheda privata", async () => {
    await p1.goto(`${campaignUrl}/scheda/modifica`);
    await p1.getByLabel("Nome del PG").fill("Kael Senzaterra");
    await p1.getByLabel("Identità").fill("Mercenario in cerca di riscatto");
    await p1.getByLabel("Tema").fill("Speranza");
    await p1.getByLabel("Origine").fill("Le Terre Cineree");
    await p1.getByRole("button", { name: "Continua" }).click();

    await p1.getByLabel("Classe 1").fill("Furia");
    await p1.getByLabel("Classe 2").fill("Elementalista");
    await p1.getByRole("button", { name: "Continua" }).click();
    await p1.getByRole("button", { name: "Continua" }).click();
    await p1.getByRole("button", { name: "Vai al passo 2: Classi" }).click();
    await expect(p1.getByRole("heading", { name: "Classi" })).toBeVisible();
    await expect(p1.getByLabel("Classe 1")).toHaveValue("Furia");
    await p1.getByRole("button", { name: "Continua" }).click();
    await p1.getByRole("button", { name: "Continua" }).click();
    await p1.getByText("Scegli dal catalogo dei manuali").click();
    await p1.getByLabel("Cerca").fill("PV Plus");
    const heroicAbility = p1.getByRole("listitem").filter({ hasText: "PV Plus" });
    await expect(heroicAbility.getByText("Abilità Eroica")).toBeVisible();
    await expect(heroicAbility.getByText("Richiede padroneggiare almeno una Classe")).toBeVisible();
    const heroicButton = heroicAbility.getByRole("button", { name: "Aggiungi comunque…" });
    await expect(heroicButton).toBeEnabled();
    await heroicButton.click();
    const warning = p1.getByRole("dialog");
    await expect(warning.getByText("Requisiti non soddisfatti")).toBeVisible();
    await expect(warning.getByText("Richiede padroneggiare almeno una Classe")).toBeVisible();
    await warning.getByRole("button", { name: "Annulla" }).click();
    await expect(warning).toBeHidden();
    await p1.getByLabel("Categoria").selectOption("skill");
    await p1.getByLabel("Cerca").fill("Tecnologie");
    const unavailableSkill = p1.getByRole("listitem").filter({ hasText: "Tecnologie" });
    await expect(unavailableSkill.getByText("Richiede la Classe: Artefice")).toBeVisible();
    await expect(unavailableSkill.getByRole("button", { name: "Aggiungi comunque…" })).toBeEnabled();
    await p1.getByLabel("Categoria").selectOption("all");
    await p1.getByLabel("Cerca").fill("Adrenalina");
    await expect(p1.getByText("Disponibile · Furia 3/10")).toBeVisible();
    await p1.getByRole("button", { name: "Aggiungi alla scheda" }).click();
    await expect(p1.getByLabel("Abilità 1", { exact: true })).toHaveValue("Adrenalina");
    await expect(p1.getByLabel("Gradi")).toHaveAttribute("max", "5");
    await expect(p1.getByLabel("Promemoria abilità 1")).toHaveValue(/Aumenta i danni mentre sei in Crisi/);
    // Una voce con requisiti non soddisfatti si aggiunge solo dopo la conferma nella finestra di avviso.
    await p1.getByLabel("Cerca").fill("Tecnologie");
    await p1
      .getByRole("listitem")
      .filter({ has: p1.getByText("Tecnologie", { exact: true }) })
      .getByRole("button", { name: "Aggiungi comunque…" })
      .click();
    await p1.getByRole("dialog").getByRole("button", { name: "Aggiungi comunque" }).click();
    await expect(p1.getByRole("dialog")).toBeHidden();
    await expect(p1.getByLabel("Abilità 2", { exact: true })).toHaveValue("Tecnologie");
    await p1.getByLabel("Cerca").fill("Fulgur");
    await expect(p1.getByText("Disponibile · Elementalista 2/10")).toBeVisible();
    await p1.getByRole("button", { name: "Aggiungi alla scheda" }).click();
    await expect(p1.getByLabel("Costo incantesimo 1")).toHaveValue("10 × B");
    await expect(p1.getByLabel("Bersaglio incantesimo 1")).toHaveValue("Fino a tre creature");
    await expect(p1.getByLabel("Promemoria incantesimo 1")).toHaveValue(/danni da fulmine/);
    await expect(p1.getByLabel("Incantesimo offensivo 1")).toBeChecked();
    await p1.getByLabel("Cerca").fill("Vortice");
    await p1.getByRole("button", { name: "Aggiungi alla scheda" }).click();
    await expect(p1.getByLabel("Durata incantesimo 2")).toHaveValue("Scena");
    await p1.getByLabel("Cerca").fill("Purificazione");
    await expect(p1.getByText(/Avvelenato, Confuso, Debole, Furente, Lento o Scosso/)).toBeVisible();
    await expect(p1.getByText(/può includere te stesso e i nemici/)).toBeVisible();
    await p1.getByLabel("Cerca").fill("Bimagus");
    await expect(p1.getByText("Richiede padroneggiare 2 Classi tra: Elementalista, Entropista, Spiritista")).toBeVisible();
    await expect(p1.getByText("Richiede livello personaggio 30 (ora 5)")).toBeVisible();
    await p1.getByLabel("Cerca").fill("Soldato Arcano");
    await expect(p1.getByText("Richiede padroneggiare 1 Classe tra: Elementalista, Maestro d'Armi, Tiratore")).toBeVisible();
    await expect(p1.getByText("Richiede almeno 2 incantesimi offensivi (ne risultano 1)")).toBeVisible();
    await p1.getByLabel("Cerca").fill("Miglioria");
    await expect(p1.getByText("Artefice padroneggiato (livello 10; prerequisito da verificare)")).toBeVisible();
    await expect(p1.getByText("Requisito da verificare sulla fonte")).toBeVisible();
    await expect(p1.getByText(/ogni livello di Visionario/)).toBeVisible();
    await p1.getByLabel("Cerca").fill("Tasche Profonde");
    await expect(p1.getByText("Richiede padroneggiare 1 Classe tra: Artefice")).toBeVisible();
    await expect(p1.getByText(/riduci il costo di 1 PI, fino a un minimo di 1/)).toBeVisible();
    await p1.getByLabel("Cerca").fill("Dosaggio Esperto");
    await expect(p1.getByText("Richiede padroneggiare 1 Classe tra: Artefice, Gourmet, Mercante, Sapiente")).toBeVisible();
    await expect(p1.getByText(/fino al 150%/)).toBeVisible();
    await p1.getByLabel("Cerca").fill("Magicannone Quantico");
    await expect(p1.getByText(/Artefice padroneggiato \+ Tecnologie/)).toBeVisible();
    await expect(p1.getByText(/Manca il beneficio avanzato Magitech di Tecnologie/)).toBeVisible();
    await expect(p1.getByText(/multi \(3\) e ignorare le Resistenze/)).toBeVisible();
    await p1.getByLabel("Cerca").fill("Nebulizzazione");
    await expect(p1.getByText(/Artefice padroneggiato \+ Tecnologie/)).toBeVisible();
    await expect(p1.getByText(/Manca il beneficio avanzato Alchimia di Tecnologie/)).toBeVisible();
    await expect(p1.getByText(/Perdi tutti i punti a fine scena/)).toBeVisible();
    await p1.getByRole("button", { name: "+ Aggiungi Abilità" }).click();
    await p1.getByLabel("Abilità 2", { exact: true }).fill("Tecnologie");
    await p1.getByLabel("Classe abilità 2", { exact: true }).fill("Artefice");
    await p1.getByLabel("Gradi").nth(1).fill("2");
    await p1.getByLabel("Tecnologie Magitech", { exact: true }).selectOption("2");
    await p1.getByLabel("Cerca").fill("Magicannone Quantico");
    await expect(p1.getByText(/Manca il beneficio avanzato Magitech di Tecnologie/)).toHaveCount(0);
    await expect(p1.getByText(/Richiede padroneggiare 1 Classe tra: Artefice/)).toBeVisible();
    await p1.getByLabel("Cerca").fill("Nebulizzazione");
    await expect(p1.getByText(/Manca il beneficio avanzato Alchimia di Tecnologie/)).toBeVisible();
    await p1.getByLabel("Cerca").fill("Stretta della Scimmia");
    await expect(p1.getByText("Richiede padroneggiare 1 Classe tra: Furia")).toBeVisible();
    await p1.getByLabel("Mostra solo le opzioni disponibili per questo PG").check();
    await expect(p1.getByText("Nessuna voce corrisponde ai filtri.")).toBeVisible();
    await p1.getByLabel("Mostra solo le opzioni disponibili per questo PG").uncheck();
    await p1.getByRole("button", { name: "+ Aggiungi rituale personale" }).click();
    await p1.getByLabel("Rituale 1", { exact: true }).fill("Velo protettivo");
    await p1.getByRole("button", { name: "Continua" }).click();

    await p1.getByRole("button", { name: "+ Aggiungi oggetto" }).click();
    await p1.getByLabel("Oggetto 1", { exact: true }).fill("Spada di bronzo");
    await p1.getByLabel("Costo").fill("501");
    await p1.getByLabel("Risultato del tiro 2d6").selectOption("7");
    await p1.getByRole("button", { name: "Crea il personaggio" }).click();
    await expect(p1.locator("p[role=alert]")).toContainText("budget iniziale è 500");
    await p1.getByLabel("Costo").fill("200");
    await p1.getByRole("button", { name: "Crea il personaggio" }).click();
    await expect(p1.getByRole("heading", { name: "Il tuo personaggio" })).toBeVisible();
    await p1.goto(`${campaignUrl}/scheda`);
    await expect(p1.getByText("Spada di bronzo")).toBeVisible();
    await expect(p1.getByText("Adrenalina")).toBeVisible();
    await expect(p1.getByText("Magitech: Avanzata")).toBeVisible();
    await expect(p1.getByText("LA 1/5")).toBeVisible();
    await expect(p1.getByText("Velo protettivo")).toBeVisible();
    await expect(p1.getByText("370", { exact: true })).toBeVisible();
    await shot(p1, "scheda", testInfo.project.name);

    await p2.goto(campaignUrl);
    await expect(p2.getByLabel("Il gruppo").getByText("Kael Senzaterra")).toBeVisible();
    await p2.goto(`${campaignUrl}/scheda`);
    await expect(p2.getByText("Mercenario in cerca di riscatto")).toHaveCount(0);

    await gm.goto(`${campaignUrl}/scheda`);
    await gm.locator("summary", { hasText: "Kael Senzaterra" }).click();
    await expect(gm.getByText("Mercenario in cerca di riscatto")).toBeVisible();
  });

  await test.step("inventario e Zenit restano personali", async () => {
    await p1.goto(`${campaignUrl}/cassa`);
    const acquisitionForm = p1.locator("section").filter({ has: p1.getByRole("heading", { name: "Nuovo oggetto" }) }).locator("form");
    await acquisitionForm.locator('[name="name"]').fill("Amuleto trovato");
    await acquisitionForm.locator('[name="acquisition"]').selectOption("found");
    await acquisitionForm.getByRole("button", { name: "Registra oggetto" }).click();
    await expect(acquisitionForm.locator('[name="name"]')).toHaveValue("");

    await acquisitionForm.locator('[name="name"]').fill("Pozione personale");
    await acquisitionForm.locator('[name="acquisition"]').selectOption("purchase");
    await acquisitionForm.locator('[name="cost"]').fill("50");
    await acquisitionForm.getByRole("button", { name: "Registra oggetto" }).click();
    await expect(acquisitionForm.locator('[name="name"]')).toHaveValue("");
    await expect(p1.getByText("Zenit personali: 320")).toBeVisible();

    await p1.goto(`${campaignUrl}/scheda`);
    await expect(p1.getByText("Amuleto trovato")).toBeVisible();
    await expect(p1.getByText("Pozione personale")).toBeVisible();
    await expect(p1.getByText("320", { exact: true })).toBeVisible();

    await p2.goto(`${campaignUrl}/cassa`);
    await expect(p2.getByRole("heading", { name: "Inventario del gruppo" })).toHaveCount(0);
    await expect(p2.getByText("Pozione personale")).toHaveCount(0);
  });

  await test.step("i progressi si annotano dopo la sessione", async () => {
    await p1.goto(`${campaignUrl}/scheda/modifica`);
    await p1.getByLabel("Sessione (facoltativa)").fill("2");
    await p1.getByLabel("Registro dei progressi (facoltativo)").fill("Il Master assegna una nuova Abilità; registrata dopo la sessione.");
    await p1.getByRole("button", { name: "Salva scheda" }).click();
    await expect(p1.getByText("Scheda salvata.")).toBeVisible();
    await p1.goto(`${campaignUrl}/scheda`);
    await p1.getByText(/Registro dei progressi/).click();
    await expect(p1.getByText("Il Master assegna una nuova Abilità; registrata dopo la sessione.")).toBeVisible();
  });

  await test.step("ricerca", async () => {
    await p2.goto(`${campaignUrl}/cerca?q=Velia`);
    await expect(p2.getByRole("heading", { name: "Diario" })).toBeVisible();
    await p2.goto(`${campaignUrl}/cerca?q=Ombra`);
    await expect(p2.getByText("Nessun risultato")).toBeVisible();
  });

  await test.step("ricerca per parole in italiano, sempre nel rispetto della visibilità", async () => {
    // "guidava" non è nel testo ("ci guida"): la trova la ricerca in italiano, non quella della frase esatta.
    await p2.goto(`${campaignUrl}/cerca?q=${encodeURIComponent("chi ci guidava verso il porto?")}`);
    await expect(p2.getByText("Pubblico:")).toBeVisible();
    // La voce privata di Bea ("Ombra era un gatto") la trova solo Bea.
    const q = encodeURIComponent("quali gatti?");
    await p1.goto(`${campaignUrl}/cerca?q=${q}`);
    await expect(p1.getByText("Segreto corretto:")).toBeVisible();
    await p2.goto(`${campaignUrl}/cerca?q=${q}`);
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
    await shot(p1, "libro", testInfo.project.name);
  });

  await test.step("il contatore AI personale conta le richieste di Bea", async () => {
    await p1.goto("/account");
    // Riassunto + tag suggeriti + capitolo = 3 richieste.
    await expect(p1.getByText(/Ne hai usate\s*3\s*su 30/)).toBeVisible();
    await p2.goto("/account");
    await expect(p2.getByText(/Ne hai usate\s*0\s*su 30/)).toBeVisible();
  });

  // Solo con E2E_SHOTS: le altre pagine, per controllarne l'aspetto.
  if (process.env.E2E_SHOTS) {
    for (const [name, path] of [
      ["cronologia", "/cronologia"],
      ["fili", "/fili"],
      ["frasi", "/frasi"],
      ["inventario", "/cassa"],
      ["cerca", "/cerca?q=Velia"],
      ["compendio", "/compendio"],
    ]) {
      await p1.goto(`${campaignUrl}${path}`);
      await shot(p1, name, testInfo.project.name);
    }
    await p1.goto("/account");
    await shot(p1, "account", testInfo.project.name);
    await p1.goto("/");
    await shot(p1, "home", testInfo.project.name);
  }

  await test.step("esportazione in Markdown", async () => {
    const res = await p1.request.get(`${campaignUrl}/esporta`);
    expect(res.ok()).toBe(true);
    const md = await res.text();
    expect(md).toContain("# Le Cronache di Prova");
    expect(md).toContain("Segreto corretto");
    expect(md).toContain("Registro dei progressi");
    expect(md).toContain("Amuleto trovato");
    const other = await p2.request.get(`${campaignUrl}/esporta`);
    expect(await other.text()).not.toContain("Segreto corretto");
  });
});

test("campagna personale: un giocatore da solo, poi il gruppo si unisce", async ({ browser, baseURL }, testInfo) => {
  const run = `${testInfo.project.name.slice(0, 3)}${Date.now().toString(36)}`;
  const solo = await signUp(browser, `solo${run}`, "Dora", baseURL!);
  const master = await signUp(browser, `vero${run}`, "Vero Master", baseURL!);
  solo.on("dialog", (d) => d.accept());

  let campaignUrl = "";

  await test.step("crea la campagna personale e arriva alla scheda del PG", async () => {
    await solo.getByLabel("Nome della tua campagna personale").fill("Il diario di Dora");
    await solo.getByRole("button", { name: "Crea la mia campagna" }).click();
    await expect(solo).toHaveURL(/\/scheda\/modifica$/);
    await expect(solo.getByLabel("Nome del PG")).toBeVisible();
    await expect(solo.getByText("Campagna personale: la vedi solo tu")).toBeVisible();
    await expect(solo.locator("span.select-all")).toHaveCount(0);
    await expect(solo.getByRole("link", { name: "Scheda PG" })).toBeVisible();
    campaignUrl = new URL(solo.url()).pathname.replace(/\/scheda\/modifica$/, "");
  });

  await test.step("scrive nel diario e aggiunge un filo a mano", async () => {
    await writeEntry(solo, campaignUrl, "Arrivati a #Portocielo con @Velia", false);
    await expect(solo.getByText("Arrivati a")).toBeVisible();
    await solo.goto(`${campaignUrl}/fili`);
    await expect(solo.locator('input[name="text"]').first()).toBeVisible();
  });

  await test.step("apre la campagna al gruppo e passa il ruolo al vero Master", async () => {
    await solo.goto(`${campaignUrl}/scheda`);
    await solo.getByRole("button", { name: "Apri la campagna al gruppo" }).click();
    const code = (await solo.locator("span.select-all").innerText()).trim();
    expect(code).toMatch(/^[A-F0-9]{8}$/);

    await master.goto("/");
    await master.getByLabel("Codice invito").fill(code);
    await master.getByRole("button", { name: "Entra nella campagna" }).click();
    await expect(master).toHaveURL(new RegExp(`${campaignUrl}/scheda$`));

    await solo.goto(`${campaignUrl}/scheda`);
    await expect(solo.getByRole("link", { name: "Giocatori" })).toBeVisible();
    await solo.getByRole("button", { name: "Passa il ruolo di Master" }).click();
    await expect(solo.getByText("Giocatore: vedi solo le tue note")).toBeVisible();

    await master.reload();
    await expect(master.getByText("Sei il Master: vedi le note di tutti")).toBeVisible();
  });
});
