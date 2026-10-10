import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

// Serves the built frontend from the FastAPI backend (single-container layout), in mock mode.
// Build the frontend first: npm --prefix frontend run build
const python = process.env.PYTHON ?? "python3";
const dataDir = path.join(os.tmpdir(), `agentlabs-e2e-${Date.now()}`);

export default defineConfig({
  testDir: ".",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    // Optional: reuse an already-installed Chromium instead of running `npx playwright install`.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `${python} -m uvicorn main:app --host 127.0.0.1 --port 4173`,
    cwd: path.resolve(__dirname, "../../backend"),
    url: "http://127.0.0.1:4173/healthz",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      AGENTLABS_DATA_DIR: dataDir,
      AGENTLABS_LLM_PROVIDER: "mock",
      OPENAI_API_KEY: "",
      AGENTLABS_SIM_STEP_DELAY: "0.01",
    },
  },
});
