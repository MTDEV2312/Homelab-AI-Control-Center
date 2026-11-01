import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";

describe("POST /api/services", () => {
  it("registers a valid Docker service", async () => {
    const app = buildApp();
    const payload = {
      name: "jellyfin",
      externalId: "jellyfin-container",
      integration: "docker",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/services",
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toMatchObject({
      name: "jellyfin",
      externalId: "jellyfin-container",
      integration: "docker",
    });
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
  });
});
