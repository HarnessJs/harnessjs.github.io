# Multi-tenancy

One process, one app, many tenants — each with its own credentials, model and
data, and none of them able to see another's.

The whole mechanism is two pieces: **`run({ data })`** carries the tenant, and a
**provider factory** reads it.

There is a complete working example in
[`examples/multi-tenancy`](https://github.com/thenajs/ThenaJS/tree/main/examples/multi-tenancy).

## Type the run's data

```ts
// src/execution.ts
export type AccountData = {
  tenantId: string;
};
```

::: tip `type`, not `interface extends`
Both compile, but an interface extending the run-data shape inherits its index
signature — and then `ctx.data.fieldThatDoesNotExist` passes as `unknown` instead
of erroring. With `type`, the typo is caught at compile time.
:::

## The provider becomes a factory

```ts
// src/providers/tenant.provider.ts
import { OllamaProvider, context } from "@thenajs/core";
import type { AccountData } from "../execution";

const MODEL: Record<string, string> = {
  acme: "qwen2.5:3b",
  globex: "qwen2.5-coder:1.5b",
};

export const tenantProvider = () => {
  const { tenantId } = context<AccountData>().data;
  return new OllamaProvider({
    host: "http://localhost:11434",
    model: MODEL[tenantId],
  });
};
```

```ts
@Agent({ provider: tenantProvider, prompt: "./assistant.agent.md" })
export class AssistantAgent {}
```

The factory is called **once per run**, already inside the run's scope — which is
exactly why it can read `context()`. Before the first step, but after the run
exists.

The generic is what makes `tenantId` arrive as a `string`. Without it, `data` is
`Record<string, unknown>` and every access needs a cast.

## Running it

```ts
const app = Thena.create<string, AccountData>(AssistantWorkflow, config);

const acme = await app.run({
  input: { message: "…" },
  data: { tenantId: "acme" },
});

const globex = await app.run({
  input: { message: "…" },
  data: { tenantId: "globex" },
});
```

The generic works at both ends: `data` is checked here, and
`context<AccountData>()` returns typed fields inside.

Concurrent calls are safe. Each `run` opens its own `RunContext`, so two
tenants' requests in flight at the same time cannot see each other's `data`,
state, budget or history.

## Reaching the tenant from a tool

`context()` and `@context()` are two doors to the same object:

```ts
@Tool({ name: "who_am_i", description: "…", schema: z.object({}) })
export class WhoAmITool {
  execute(@input() _args: unknown, @context() ctx: Context<AccountData>) {
    return `This run belongs to account ${ctx.data.tenantId}.`;
  }
}
```

`ctx` here is the **same object** the provider factory read. The decorator form
inside a tool, the function form anywhere else in the run.

## Why `data` and not `memory`

```ts
data: { tenantId: "acme" }; // never reaches the model, never in the report
memory: { plan: "pro" }; // serialised into `system` — the model reads it
```

A tenant id in `memory` would go into the prompt and into the report on disk.
Worse, the model could then repeat it — and a model that can say a tenant id is a
model that can be talked into saying the wrong one.

`data` is transported and never interpreted. That is the isolation boundary.

## Per-tenant credentials

The same pattern, with the key coming from your own store:

```ts
export const tenantProvider = () => {
  const { tenantId } = context<AccountData>().data;
  const account = accounts.get(tenantId); // your lookup

  return new OpenAIProvider({
    apiKey: account.apiKey,
    model: account.tier === "pro" ? "gpt-4o" : "gpt-4o-mini",
    costPer1kTokens: PRICES[account.model],
  });
};
```

::: warning The factory runs per run, not per turn
It is called once when the run is compiled. Rotating a credential mid-run is not
possible — and should not be. A long-lived cache of provider instances keyed by
tenant is fine, as long as the lookup itself happens in the factory.
:::

## Per-tenant budgets

Budgets are per run, so they are per tenant for free:

```ts
await app.run({
  input,
  data: { tenantId },
  budget: {
    maxCostUsd: account.remainingCredit,
    mode: "stop",
    onExceeded: (info) => billing.flag(tenantId, info),
  },
});
```

This is the natural place to enforce a plan limit — and `"stop"` returns the
partial answer rather than failing the request.

## Per-tenant memory

Vector stores are app-level and shared, so isolate with a dataset:

```ts
await vectors.remember(text, { dataset: `tenant:${tenantId}` });
await vectors.recall(query, { dataset: `tenant:${tenantId}` });
```

::: warning Never `dataset: null` in a multi-tenant app
It searches **every** dataset, which means every tenant. That is a data leak with
no error message.
:::

Because the dataset must come from `ctx.data` rather than from an argument the
model controls, do not expose it in a tool's schema.

## What is shared

| | Scope |
| --- | --- |
| `data`, state, history, budget, recorder | **per run** |
| workflow shape, agents, tools | per app |
| plugins | per app |
| vector store instances | per app |
| module-level variables in your code | per process |

That last row is the one that bites. A `let currentTenant` at module scope is
shared by every concurrent run, and will interleave. Everything tenant-specific
goes through `ctx.data`.

## Isolating the report

Per-run overrides keep one tenant's prompts out of another's folder:

```ts
await app.run({
  input,
  data: { tenantId },
  report: { dir: `report/${tenantId}` },
});
```

Or, for tenants whose data must not be written at all:

```ts
report: account.strictPrivacy ? { content: false } : true;
```

## Related

- [Per-run configuration](/en/techniques/per-run-configuration)
- [State and context](/en/fundamentals/state-and-context) — `data` vs `memory`
- [Production](/en/deployment/production)
- [Security](/en/best-practices/security)
