import { test, expect } from "@playwright/test";

/**
 * AgentForge Dual-Mode Revamp — End-to-End Playwright Tests
 *
 * Prerequisites:
 *   - Frontend (Vite) running on http://localhost:3000
 *   - Mock mode (no backend required for UI testing)
 *
 * The dashboard runs fully with mock data. All interactions work without a
 * backend.  The two operation modes are:
 *   1. Agentic AI Tool Hardening  (/agent-hardening)
 *   2. LLM Reinforcement Lab      (/rl-lab)
 */

test.describe("AgentForge Dual-Mode Revamp", () => {
  async function sampleArenaRegion(page: import("@playwright/test").Page) {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Arena canvas did not have a bounding box");

    return page.screenshot({
      clip: {
        x: box.x + box.width * 0.52,
        y: box.y + box.height * 0.16,
        width: box.width * 0.43,
        height: box.height * 0.62,
      },
    });
  }

  function changedByteCount(before: Buffer, after: Buffer) {
    let changed = 0;
    for (let i = 0; i < Math.min(before.length, after.length); i++) {
      if (before[i] !== after[i]) {
        changed++;
      }
    }
    return changed;
  }

  /* ------------------------------------------------------------------ */
  /*  1 – Home page                                                     */
  /* ------------------------------------------------------------------ */

  test("1 - main page loads with two mode cards", async ({ page }) => {
    await page.goto("/");

    // Branding
    await expect(page.getByText("AgentForge").first()).toBeVisible();

    // Both mode cards
    await expect(
      page.getByText("Agentic AI Tool Hardening")
    ).toBeVisible();
    await expect(
      page.getByText("LLM Reinforcement Lab")
    ).toBeVisible();

    // Primary CTA buttons on the cards
    await expect(
      page.getByRole("button", { name: "Start Agent Hardening" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start RL Lab" })
    ).toBeVisible();
  });

  /* ------------------------------------------------------------------ */
  /*  2 – Process strip                                                 */
  /* ------------------------------------------------------------------ */

  test("2 - process strip shows 7 steps", async ({ page }) => {
    await page.goto("/");

    // Seven-step process strip below the mode cards
    await expect(page.getByText("Upload", { exact: true })).toBeVisible();

    await expect(page.getByText("Spawn Harnesses", { exact: true })).toBeVisible();
    await expect(page.getByText("Attack or Evaluate", { exact: true })).toBeVisible();
    await expect(page.getByText("Verify or Score", { exact: true })).toBeVisible();
    await expect(page.getByText("Patch or Train", { exact: true })).toBeVisible();
    await expect(page.getByText("Retest", { exact: true })).toBeVisible();
    await expect(page.getByText("Export", { exact: true })).toBeVisible();
  });

  /* ------------------------------------------------------------------ */
  /*  3 – Agent Hardening entry                                         */
  /* ------------------------------------------------------------------ */

  test("3 - Run Demo Agent opens agent hardening workspace", async ({
    page,
  }) => {
    await page.goto("/");

    // Click the "Run Demo Agent" secondary button on the first card
    await page.getByRole("button", { name: "Run Demo Agent" }).click();

    // Should navigate to /agent-hardening
    await page.waitForURL("**/agent-hardening");

    // The arena should be visible
    await expect(page.getByText("Agent Hardening Arena")).toBeVisible();
  });

  /* ------------------------------------------------------------------ */
  /*  4 – Agent Hardening panels                                        */
  /* ------------------------------------------------------------------ */

  test("4 - agent hardening page shows all panels", async ({ page }) => {
    await page.goto("/agent-hardening");

    // Left ops panel sections
    await expect(page.getByText("Agent Source")).toBeVisible();
    await expect(page.getByText("Harness Army")).toBeVisible();
    await expect(page.getByText("Agent Generations")).toBeVisible();
    await expect(page.getByText("Attack Queue")).toBeVisible();
    await expect(page.getByText("Evaluation Log")).toBeVisible();
    await expect(page.getByText("Latest Patch")).toBeVisible();

    // Right workspace widgets
    await expect(page.getByText("Agent Hardening Arena")).toBeVisible();
    await expect(page.getByText("Export & Share")).toBeVisible();
    await expect(page.getByText("Next Wave", { exact: true })).toBeVisible();
  });

  /* ------------------------------------------------------------------ */
  /*  5 – Run Wave                                                      */
  /* ------------------------------------------------------------------ */

  test("5 - Run Wave button exists and is clickable", async ({ page }) => {
    await page.goto("/agent-hardening");
    await page.getByRole("button", { name: "ON", exact: true }).click();
    await page.getByRole("button", { name: "4x" }).click();

    // Run Wave button is present (either in nav bar or Next Wave panel)
    const runWaveBtn = page.getByRole("button", { name: "Run Wave" });
    await expect(runWaveBtn.first()).toBeVisible();

    // Click to start a wave of attacks
    await runWaveBtn.first().click();

    // The UI should enter the running state after the click
    await expect(page.getByText("Running").first()).toBeVisible({ timeout: 5000 });
  });

  test("5b - arena renders and animates combat sprites during a wave", async ({ page }) => {
    await page.goto("/agent-hardening");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "ON", exact: true }).click();
    await page.getByRole("button", { name: "4x" }).click();

    const idleRegion = await sampleArenaRegion(page);
    await page.getByRole("button", { name: "Run Wave" }).first().click();
    await page.waitForTimeout(1100);
    const enemiesSpawnedRegion = await sampleArenaRegion(page);
    await page.waitForTimeout(900);
    const activeCombatRegion = await sampleArenaRegion(page);

    expect(changedByteCount(idleRegion, enemiesSpawnedRegion)).toBeGreaterThan(1200);
    expect(changedByteCount(enemiesSpawnedRegion, activeCombatRegion)).toBeGreaterThan(400);
  });

  /* ------------------------------------------------------------------ */
  /*  6 – Apply Patch                                                   */
  /* ------------------------------------------------------------------ */

  test("6 - Apply Patch changes generation", async ({ page }) => {
    await page.goto("/agent-hardening");
    await page.getByRole("button", { name: "ON", exact: true }).click();
    await page.getByRole("button", { name: "4x" }).click();

    // Apply the hardening patch directly
    await page.getByRole("button", { name: "Apply Patch" }).click();

    // Latest patch panel should now show the applied patch details
    await expect(
      page.getByText("+12% Survival").first()
    ).toBeVisible({ timeout: 10000 });
  });

  /* ------------------------------------------------------------------ */
  /*  7 – Export                                                        */
  /* ------------------------------------------------------------------ */

  test("7 - Export button exists", async ({ page }) => {
    await page.goto("/agent-hardening");

    // Export & Share panel on the right side
    await expect(page.getByText("Export & Share")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export Agent", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export Report", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export Bundle", exact: true })).toBeVisible();

    // Export button in the top navigation bar
    await expect(page.getByRole("button", { name: "Export" }).first()).toBeVisible();
  });

  /* ------------------------------------------------------------------ */
  /*  8 – RL Lab entry                                                  */
  /* ------------------------------------------------------------------ */

  test("8 - Run Demo Lab opens RL lab workspace", async ({ page }) => {
    await page.goto("/");

    // Click the "Run Demo Lab" secondary button on the second card
    await page.getByRole("button", { name: "Run Demo Lab" }).click();

    // Should navigate to /rl-lab
    await page.waitForURL("**/rl-lab");

    // RL lab header and left-panel sections
    await expect(page.getByText("RL Training Arena")).toBeVisible();
    await expect(page.getByText("Model Source")).toBeVisible();
    await expect(page.getByText("Reward Signal")).toBeVisible();
    await expect(page.getByText("Training Optimization")).toBeVisible();
  });

  /* ------------------------------------------------------------------ */
  /*  9 – RL Lab reward components                                      */
  /* ------------------------------------------------------------------ */

  test("9 - RL lab shows reward components", async ({ page }) => {
    await page.goto("/rl-lab");

    // Reward and training panels contain the key metric labels
    await expect(page.getByText("Reward Signal")).toBeVisible();
    await expect(page.getByText("Training Optimization")).toBeVisible();

    // Individual metric tiles
    await expect(page.getByText("Progress").first()).toBeVisible();
    await expect(page.getByText("Total Reward").first()).toBeVisible();
    await expect(page.getByText("Best Signal")).toBeVisible();
    await expect(page.getByText("Checkpoints").first()).toBeVisible();

    // Event Log panel
    await expect(page.getByText("Training Log")).toBeVisible();
  });

  /* ------------------------------------------------------------------ */
  /*  10 – Cross-mode navigation                                        */
  /* ------------------------------------------------------------------ */

  test("10 - navigation between modes works", async ({ page }) => {
    // Start at the home page
    await page.goto("/");
    await expect(
      page.getByText("Agentic AI Tool Hardening")
    ).toBeVisible();

    // Navigate to Agent Hardening mode
    await page.getByRole("button", { name: "Start Agent Hardening" }).click();
    await page.waitForURL("**/agent-hardening");
    await expect(page.getByText("Agent Hardening Arena")).toBeVisible();

    // Brand/logo returns to the main menu
    await page.getByRole("link", { name: "Back to AgentForge menu" }).click();
    await page.waitForURL("**/");
    await expect(
      page.getByText("LLM Reinforcement Lab")
    ).toBeVisible();

    // Return to home
    await page.goto("/");
    await expect(
      page.getByText("LLM Reinforcement Lab")
    ).toBeVisible();

    // Navigate to RL Lab mode
    await page.getByRole("button", { name: "Start RL Lab" }).click();
    await page.waitForURL("**/rl-lab");
    await expect(page.getByText("RL Training Arena")).toBeVisible();
  });
});
