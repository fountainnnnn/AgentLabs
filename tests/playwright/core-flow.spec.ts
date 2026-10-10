import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const SHOTS = process.env.CAPTURE_SCREENSHOTS ? path.resolve(__dirname, "../../docs/screenshots") : null;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test("landing page shows both modules and offline provider", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("AgentLabs").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agent Hardening" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "LoRA Lab" })).toBeVisible();
  await expect(page.getByTestId("provider-status")).toContainText("Mock provider");
  await shot(page, "landing");
});

test("asset manifest and arena sprites are served", async ({ request }) => {
  for (const url of ["/assets/agentlabs/asset-manifest.json", "/assets/agentlabs/arena/arena_lab_clean.png", "/assets/agentlabs/hero/idle/idle_01.png"]) {
    expect((await request.get(url)).status()).toBe(200);
  }
});

test("hardening loop runs end to end and exports artifacts", async ({ page }) => {
  await page.goto("/agent-hardening");
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Start hardening run" }).click();
  await expect(page.getByTestId("truth-badge")).toContainText("Simulated");
  // the first attack is animated from a real case_result event
  await expect(page.getByTestId("attack-counter")).toContainText(/Attack 0\d\/0\d/);
  await expect(page.getByTestId("narration")).toContainText(/blocked|breached/);
  await shot(page, "agent-hardening");
  await page.getByRole("button", { name: "Skip to results" }).click();
  await expect(page.getByTestId("run-summary")).toBeVisible();
  await expect(page.getByTestId("metric-regression")).toContainText("%");
  await expect(page.getByTestId("generations")).toContainText("v1");
  await expect(page.getByTestId("export-panel")).toContainText("agent.json");
  await expect(page.getByTestId("export-panel")).toContainText("agentlabs_hardened_agent_bundle.zip");
  await shot(page, "agent-hardening-results");
});

test("LoRA lab: baseline, simulated training, checkpoint evaluation and export", async ({ page }) => {
  await page.goto("/rl-lab");
  await expect(page.getByTestId("model-panel")).toContainText("Adapter Simulation Mode");
  await page.getByRole("button", { name: "Load demo dataset" }).click();
  await expect(page.getByTestId("dataset-panel")).toContainText("29 samples");
  await page.getByRole("button", { name: "Run baseline" }).click();
  await page.getByRole("button", { name: "Skip to results" }).click();
  await expect(page.getByTestId("baseline-pass-rate")).toContainText("%");
  await page.getByRole("button", { name: "Train adapter" }).click();
  await page.getByRole("button", { name: "Skip to results" }).click();
  await expect(page.getByTestId("training-panel")).toContainText("Trainable params");
  await page.getByRole("button", { name: "Evaluate checkpoint" }).click();
  await page.getByRole("button", { name: "Skip to results" }).click();
  await expect(page.getByTestId("comparison")).toContainText("cases fixed");
  await expect(page.getByTestId("lora-exports")).toContainText("model_card.json");
  await shot(page, "lora-lab");
});

test("reports and exports list this session's runs", async ({ page }) => {
  await page.goto("/agent-hardening");
  await page.getByRole("button", { name: "Start hardening run" }).click();
  await page.getByRole("button", { name: "Skip to results" }).click();
  await expect(page.getByTestId("run-summary")).toBeVisible();
  await page.getByRole("link", { name: "Open in Reports" }).click();
  await expect(page.getByTestId("report-detail")).toContainText("Category breakdown");
  await expect(page.getByTestId("patch-diffs")).toContainText("[guard:");
  await shot(page, "reports");
  await page.goto("/exports");
  await expect(page.getByTestId("artifact-list")).toContainText("agent.json");
  await shot(page, "exports");
});
