# Production

An agent behind HTTP is a long-running process serving concurrent requests, each
of which is slow, expensive and cancellable. That combination is what this page
is about.

## The shape

```ts
import express from "express";
import { Thena } from "@thenajs/core";

const app = Thena.create(AssistantWorkflow, config); // once, at startup
const server = express();

server.post("/runs", async (req, res) => {
  try {
    const answer = await app.run({
      prompt: req.body.message,
      data: { requestId: req.id },
      signal: req.signal,
      budget: { maxDurationMs: 120_000, maxCostUsd: 0.5 },
    });
    res.json({ answer });
  } catch (err) {
    if (req.signal.aborted) return; // the client left
    req.log.error(err);
    res.status(500).json({ error: "run failed" });
  }
});
```

**Create the app once.** `Thena.create` is synchronous and does no I/O, but the
workflow compiles once and the vector stores connect once. Creating it per
request throws that away.

**`run` is concurrent-safe.** Each call opens its own context, state, budget and
recorder. Two requests in flight never see each other.

## Non-negotiables

Four things separate a demo from a service:

```ts
budget: { maxDurationMs: 120_000, maxCostUsd: 0.5 }   // it cannot run forever
signal: req.signal                                     // it stops when the client leaves
```

```ts
maxIterations: 8                                       // the loop has a ceiling
```

```ts
process.on("SIGTERM", async () => {
  await app.dispose();
  process.exit(0);
});
```

Without a budget, one bad run can consume a day's API spend. Without `signal`,
work continues for a client that hung up. Without `dispose`, a deploy kills
in-flight runs mid-turn.

## Long runs: POST then SSE

Answering synchronously only works while runs are short. Past that, return the id
immediately:

```ts
const runs = new Map<string, RunHandle<string>>();

server.post("/runs", (req, res) => {
  const exec = app.run({
    prompt: req.body.message,
    observe: true, // ← required: the handle is the only consumer
    budget: { maxDurationMs: 300_000 },
  });
  runs.set(exec.runId, exec);
  exec.result.finally(() => setTimeout(() => runs.delete(exec.runId), 60_000));
  res.status(202).json({ runId: exec.runId }); // synchronous
});

server.get("/runs/:id/stream", async (req, res) => {
  const exec = runs.get(req.params.id);
  if (!exec) return res.status(404).end();

  res.setHeader("Content-Type", "text/event-stream");
  for await (const event of exec.eventStream) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
});

server.delete("/runs/:id", (req, res) => {
  runs.get(req.params.id)?.abort(new Error("cancelled by client"));
  res.status(204).end();
});
```

`runId` is available synchronously, before the first turn. A client that connects
to the stream three seconds later still sees the whole run, because late
subscribers get the buffered backlog.

::: warning `observe: true` is not optional here
With no `report`, `log` or plugin, an unobserved run emits nothing and
`eventStream` never yields. You get a one-time warning rather than silence.
:::

Note the eviction: without it, that `Map` is a memory leak.

## Configuration per request

Keep the service quiet and turn one run up when you need to:

```ts
await app.run({
  prompt,
  log: req.header("x-debug") ? "verbose" : false,
  report: req.header("x-debug") ? { dir: `report/${req.id}` } : false,
});
```

No redeploy, no global flag. See
[Per-run configuration](/en/techniques/per-run-configuration).

## Observability

`report: true` writes a folder per run. That is right for development and wrong
for a busy service — it is unbounded disk growth of files nobody reads.

In production, forward events instead:

```ts
await app.use(otelPlugin()); // your own, see Writing plugins
```

Keep the report as a per-request opt-in, as above. See
Observability.

::: warning Flow is not a production tool
`thenaFlow()` keeps runs in memory and serves an unauthenticated page. It belongs
on your machine.
:::

## Docker

There is nothing ThenaJS-specific here — it is an ordinary Node service. Two
details that are easy to get wrong:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
# The agent prompts are .md files read at runtime, next to the compiled .js
CMD ["node", "dist/main.js"]
```

**The `.md` prompts must be in the image.** They are read at runtime from beside
the compiled `.js`. A build that copies only `*.js` produces
`[@Agent] Prompt markdown not found` on the first run.

**Node 20.19 or newer**, which is what the packages' `engines` requires.

If you use a local Ollama, it is a separate service — the container needs to
reach it, and `localhost` inside a container is not your host.

## Health checks

A liveness probe should not call the model. It costs money and it will be slow
enough to fail the probe.

```ts
server.get("/healthz", (_req, res) => res.status(200).end());
```

For readiness, check what the run actually depends on — the provider's host and
the vector store — with your own short-timeout ping, not through an agent.

## Failure modes to expect

| Symptom | Usual cause |
| --- | --- |
| `fetch failed` after ~300s | no `timeoutMs`; the request hung so retry never fired |
| memory grows over days | a `Map` of handles with no eviction, or a plugin retaining nodes |
| costs spike overnight | a loop with no ceiling, or no `budget` |
| the process will not exit | a plugin holding a server open; call `app.dispose()` |
| works alone, breaks under load | module-level mutable state in your tools |

That last one is worth repeating: the framework isolates runs, but it cannot
isolate a `let` at module scope in your own code.

## Related

- [Scaling](/en/deployment/scaling)
- [Environment variables](/en/deployment/environment-variables)
- [Multi-tenancy](/en/deployment/multi-tenancy)
- [Streaming](/en/fundamentals/streaming)
