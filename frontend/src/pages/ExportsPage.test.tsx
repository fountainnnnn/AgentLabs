import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ExportsPage from "@/pages/ExportsPage";

const artifacts = [
  { id: "art_1", run_id: "run_1", kind: "bundle_zip", filename: "agentlabs_hardened_agent_bundle.zip", media_type: "application/zip", real_or_simulated: "simulated", size_bytes: 2048, download_url: "/api/artifacts/art_1/download" },
];

function mockFetch() {
  return vi.fn(async (url: string) => {
    const body = url.includes("/api/artifacts")
      ? { artifacts }
      : url.includes("/api/session")
        ? { auth_required: false, authenticated: true }
        : { status: "ok", llm: { provider: "mock", live: false }, lora_mode: "adapter_simulation" };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ExportsPage", () => {
  it("lists artifacts with truth labels and download links", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(
      <MemoryRouter>
        <ExportsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("agentlabs_hardened_agent_bundle.zip")).toBeTruthy();
    expect(screen.getByText("simulated")).toBeTruthy();
    const link = screen.getByRole("link", { name: /download/i });
    expect(link.getAttribute("href")).toBe("/api/artifacts/art_1/download");
    expect(await screen.findByText("Mock provider (offline)")).toBeTruthy();
  });
});
