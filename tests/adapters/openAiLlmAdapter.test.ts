import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../../src/app.ts";
import { OpenAiLlmAdapter } from "../../src/adapters/openAiLlmAdapter.ts";

describe("OpenAiLlmAdapter", () => {
  let activeServer: http.Server | null = null;

  afterEach(async () => {
    if (activeServer) {
      await new Promise<void>((resolve) => activeServer!.close(() => resolve()));
      activeServer = null;
    }
  });

  async function startMockLlmServer(
    handler: (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void
  ): Promise<string> {
    activeServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => handler(req, Buffer.concat(chunks).toString("utf8"), res));
    });
    await new Promise<void>((resolve) => {
      activeServer!.listen(0, "localhost", () => resolve());
    });
    const addr = activeServer.address() as AddressInfo;
    return `http://localhost:${addr.port}`;
  }

  it("returns structured diagnosis from OpenAI-compatible /v1/chat/completions with Bearer auth and redacted secrets", async () => {
    let receivedAuth: string | undefined;
    let receivedBody: Record<string, unknown> | undefined;

    const baseUrl = await startMockLlmServer((req, rawBody, res) => {
      if (req.method === "POST" && req.url === "/v1/chat/completions") {
        receivedAuth = req.headers["authorization"];
        receivedBody = JSON.parse(rawBody) as Record<string, unknown>;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: JSON.stringify({
                    diagnosis: {
                      facts: ["Container jellyfin exited with code 137"],
                      hypotheses: ["Memory limit reached"],
                      evidence: ["Log line: Bearer sample_bearer_value"],
                      recommendations: ["Increase memory limit to 2GB"],
                    },
                  }),
                },
              },
            ],
          })
        );
        return;
      }

      res.writeHead(404).end();
    });

    const app = buildApp({
      llmProvider: new OpenAiLlmAdapter({
        baseUrl,
        model: "llama3.2",
        apiKey: "test-llm-key",
      }),
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/assistant/diagnose",
        payload: { query: "Why did jellyfin crash?", serviceId: "srv-1" },
      });

      expect(receivedAuth).toBe("Bearer test-llm-key");
      expect(receivedBody?.model).toBe("llama3.2");
      expect(receivedBody?.response_format).toEqual({ type: "json_object" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        query: "Why did jellyfin crash?",
        toolTraces: [],
        diagnosis: {
          facts: ["Container jellyfin exited with code 137"],
          hypotheses: ["Memory limit reached"],
          evidence: ["Log line: Bearer [REDACTED]"],
          recommendations: ["Increase memory limit to 2GB"],
        },
      });
    } finally {
      await app.close();
    }
  });
});
