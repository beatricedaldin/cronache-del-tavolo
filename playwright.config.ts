import { defineConfig, devices } from "@playwright/test";

/**
 * Test dell'interfaccia: un browser vero che fa il Master e i giocatori.
 * Si lanciano con `pnpm test:e2e`, che prima prepara un Supabase locale in Docker
 * (vedi scripts/e2e.sh). L'AI usa il servizio "finto": niente chiave, niente quota.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "it-IT",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "telefono", use: { ...devices["Pixel 7"] } }, { name: "computer", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { AI_PROVIDER: "finto" },
  },
});
