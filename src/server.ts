import { buildApp } from "./app.ts";
import { createAdaptersFromEnv } from "./config/env.ts";

const port = Number(process.env.PORT) || 3001;
const adapters = createAdaptersFromEnv();
const app = buildApp(adapters);

const shutdown = async () => {
  await app.close();
  adapters.repository?.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(
    `API Server listening on ${address} (storage: ${adapters.repository ? "sqlite" : "in-memory"}, docker: ${adapters.dockerClient ? "configured" : "unconfigured"})`
  );
});
