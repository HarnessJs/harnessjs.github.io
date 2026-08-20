# Configuration

There are two places to configure a ThenaJS application, and the difference
between them is lifetime:

- **`ThenaConfig`** — passed to `Thena.create(...)`. Applies to the app, and to
  every run it opens.
- **Run options** — passed to `app.run({ ... })`. Apply to that one execution.

Both are entirely optional. An agent that only talks needs neither.

## `ThenaConfig`

```ts
// src/config.ts
import type { ThenaConfig } from "@thenajs/core";

export const config: ThenaConfig = {
  // Logs what is running, live (agents, chats, tools).
  log: true,
  // Writes an HTML + JSON report to `report/` at the end of each run.
  report: true,
};
```

```ts
const app = Thena.create(MyWorkflow, config);
```

| Option | What it does |
| --- | --- |
| `log` | `true` for an indented console tree, `"verbose"` to include the content, or a `(event) => void` function as your own sink |
| `report` | `true` for the defaults, or `{ dir, format, content }` |
| `memory` | vector store classes, instantiated once and shared by every agent |
| `redact` | secret masking on captured content — **on by default** |

### `log`

`true` prints the execution tree as it happens:

```
[thena] ▸ workflow ExplorerWorkflow
[thena]   ▸ agent ExplorerAgent
[thena]     ▸ chat
[thena]     ▸ tool read_file
[thena]     ◂ tool read_file  3ms ✓
[thena]     ◂ chat  1.81s ✓
```

`"verbose"` adds the prompt, the response and the tool I/O. A function receives
every `ExecutionEvent` and lets you forward them to pino, winston, a file or JSON
lines.

### `report`

Writes a Playwright-style report at the end of the run:

```ts
report: { dir: "report", format: "both", content: true }
```

- `dir` — output folder, default `"report"`
- `format` — `"html"`, `"json"` or `"both"` (default)
- `content` — record each step's prompt, response and tool I/O (default `true`).
  `false` keeps the tree, the durations and the telemetry, and drops the text.

Each run gets its own subfolder: `report/<runId>/index.html` and
`report/<runId>/report.json`. `report/index.html` lists all of them.

### `redact`

Secret masking runs **by default** on everything captured — prompt, response,
tool I/O and error messages — before it reaches the report, the log or a plugin.
It knows `Bearer …`, connection strings with a password, `sk-…`, `ghp_…`, JWTs,
and fields named like `api_key` or `password`.

`false` turns it off. A function replaces the default; use the exported
`redactSecrets` to add patterns without losing the built-in ones.

## Run options

```ts
await app.run({
  input: { message: "Review the src/ directory" },
  memory: { userId: "123" },
  budget: { maxChatCalls: 20, maxCostUsd: 0.5 },
  signal: AbortSignal.timeout(30_000),
});
```

| Option | What it does |
| --- | --- |
| `input` | the run's input. `message` becomes the initial pipeline input; otherwise the whole object is serialised |
| `memory` | durable context, serialised into the `system` message — **the model reads it** |
| `data` | your own data channel, available at `ctx.data` — **never goes to the model** |
| `budget` | a ceiling for the whole run: time, calls, tokens, cost |
| `signal` | cancels the run from outside |
| `observe` | turns on live observation even with no report, log or plugin |
| `report` / `log` | override `ThenaConfig` for this run only |

### `memory` vs `data`

They look similar and are opposites. Both travel with the run; only one reaches
the model.

```ts
await app.run({
  input: { message: "What is my plan?" },
  memory: { plan: "pro" }, // the model reads this
  data: { accountId: "acme" }, // the model never sees this
});
```

Use `memory` for context the model **should** read. Use `data` for what the run
needs to carry and the model should not see — a tenant id, an internal token, a
correlation id. `data` also stays out of the report.

### `budget`

Without a `budget`, nothing is measured and nothing is checked.

```ts
budget: {
  maxDurationMs: 60_000,
  maxChatCalls: 20,
  maxToolCalls: 50,
  maxTokens: 100_000,
  maxCostUsd: 0.5,
  mode: "stop",              // default; "throw" raises BudgetExceededError
  onExceeded: (info) => console.warn(`hit ${info.reason}`),
}
```

`mode: "stop"` is the default and ends the run **gracefully** — the remaining
steps are skipped and the run returns the output it already had. `"throw"` raises
`BudgetExceededError` instead.

`maxCostUsd` only works if the provider was given `costPer1kTokens`; `maxTokens`
only counts what the provider actually reports.

::: warning The ceiling is a barrier, not a mid-sentence cut
Stopping is checked **between** units of work, and a model call is only counted
once it has answered. A run can spend one call past the limit before it stops.
:::

## Environment variables

ThenaJS reads no environment variables of its own — there is no `THENA_*` to
learn. Credentials go where you put them:

```ts
super({ apiKey: process.env.OPENAI_API_KEY! });
```

That is deliberate: the framework never reaches for a global, so two providers in
the same process can use two different keys.

**Next: [next steps](/en/get-started/next-steps).**
