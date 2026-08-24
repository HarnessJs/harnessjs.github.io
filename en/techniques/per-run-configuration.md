# Per-run configuration

One app, many runs, different settings. Possible because each run opens its own
context — nothing is global.

```ts
const app = Thena.create(MyWorkflow, { log: true, report: true });

await app.run({ prompt, report: false }); // this one writes nothing
await app.run({ prompt, log: "verbose" }); // this one is loud
```

## What can vary per run

| Option | Notes |
| --- | --- |
| `report` | `boolean \| ReportOptions` — overrides `ThenaConfig.report` |
| `log` | `boolean \| "verbose" \| fn` — overrides `ThenaConfig.log` |
| `budget` | there is no app-level budget; it only exists per run |
| `signal` | cancellation |
| `observe` | forces observation on |
| `state` | where the run starts — the `history`, `tasks` and `memory` it inherits |
| `data` | your channel, which the model never sees |

`stores` in `ThenaConfig` is a different thing — the vector store classes — and
is not per-run.

## Debugging one request in production

The most useful application. Keep the app quiet, and turn one run up:

```ts
app.post("/runs", async (req, res) => {
  const debug = req.header("x-debug") === "1";

  const answer = await agent.run({
    prompt: req.body.message,
    log: debug ? "verbose" : false,
    report: debug ? { dir: `report/${req.id}` } : false,
  });

  res.json({ answer });
});
```

No redeploy, no global flag, no noise from the other requests in flight.

## Handling sensitive runs

```ts
await app.run({
  prompt,
  report: { content: false }, // keep the tree, drop the text
});
```

Known secrets are already masked by `redact`, but there is no regex for a
customer's name. `content: false` keeps the shape, durations and telemetry of the
run while writing none of the text to disk.

## The provider can vary too

`@Agent({ provider })` accepts a factory, called **once per run** inside the run's
scope — so it can read `context()`:

```ts
@Agent({
  provider: () => new OpenAIProvider({
    apiKey: keyFor(context<MyRun>().data.tenantId),
    model: context<MyRun>().data.tier === "pro" ? "gpt-4o" : "gpt-4o-mini",
  }),
  prompt: "./assistant.agent.md",
})
export class AssistantAgent {}
```

```ts
await app.run({ prompt, data: { tenantId: "acme", tier: "pro" } });
```

This is the whole mechanism behind multi-tenancy:
one app, one process, credentials and model chosen per request.

::: tip A factory runs at compile time, before the first step
`context()` there gives you the **run's** context — `data`, `runId`, `signal` —
but not a step's. Touching `state` throws with an explanation.
:::

## `data` vs `memory`

Both travel with the run; only one reaches the model.

```ts
await app.run({
  prompt,
  state: { memory: ["plan: pro"] }, // serialised into `system` — the model reads it
  data: { tenantId: "acme" }, // never serialised, never in the report
});
```

A tenant id, an internal token, a correlation id belong in `data`. Anything the
model must know to answer belongs in `state.memory`.

Type it once and it stays typed:

```ts
type MyRun = { tenantId: string; tier: "free" | "pro" };
const app = Thena.create<string, MyRun>(MyWorkflow, config);

context<MyRun>().data.tier; // "free" | "pro", no cast
```

## What cannot vary per run

The workflow shape — steps, state class, tools, agent classes — is compiled when
the app is created. A run cannot add a step or swap an agent.

If two request types need different shapes, build two apps. They are cheap:
`Thena.create` is synchronous and does no I/O.

```ts
const quick = Thena.create(QuickWorkflow, config);
const deep = Thena.create(DeepWorkflow, config);
```

Plugins are also app-level: `app.use()` must be called before `run`, and applies
to every run. A middleware that should only act sometimes checks the run itself:

```ts
tool: async (inv, next) => {
  if (!inv.run.data.auditing) return next();
  return audited(inv, next);
};
```

## Related

- [Configuration](/en/get-started/configuration)
- [`ThenaConfig`](/en/reference/thena-config)
- [Multi-tenancy](/en/deployment/multi-tenancy)
- [State and context](/en/fundamentals/state-and-context)
