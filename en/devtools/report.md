# Report

Agents are hard to debug because the decisions are the model's. The report exists
for that: at the end of a run, an HTML file with the whole tree — what was sent,
what it decided, how long it took and what it cost.

```ts
// src/config.ts
export const config: ThenaConfig = {
  log: true, // live tree in the terminal
  report: true, // HTML + JSON at the end
};
```

Run it and open `report/index.html`.

::: tip To watch it happen
The report is the after. For real time, in a browser graph, see
[Flow](/en/devtools/flow).
:::

## Where the files land

```
report/
  index.html              ← index of every run
  <runId>/
    index.html            ← this run's tree
    report.json           ← the same, structured
```

::: warning This changed in 0.9
Each run now gets its own subfolder. Scripts that read a fixed
`report/index.html` as *the* run's report need updating — that path is now the
index of all of them.
:::

## Options

```ts
report: { dir: "report", format: "both", content: true }
```

| Option | Default | Notes |
| --- | --- | --- |
| `dir` | `"report"` | output folder |
| `format` | `"both"` | `"html"`, `"json"` or `"both"` |
| `content` | `true` | record prompt, response and tool I/O |

`content: false` keeps the tree, the durations and the telemetry, and drops the
text. It is the setting for handling personal data — known secrets are already
masked by redaction, but there is no regex for a name
or an address.

## What you can measure

Every node carries structured data. The point is that measuring a run should not
require pattern-matching over text:

| Node | Fields |
| --- | --- |
| `workflow` | `chatCalls`, `toolCalls`, `tokens`, `costUsd`, `elapsedMs`, `exceeded` |
| `loop` | `iterations`, `exhausted`, `maxIterations` |
| `chat` | `toolCallSource`, `promptTokens`, `completionTokens`, `costUsd`, `attempts` |
| `tool` | `isError` (and the node's status becomes `error`) |

In practice:

- **tool error rate** — count `tool` nodes with an error status
- **loops that did not converge** — `exhausted: true`
- **API instability** — `attempts` present, which only happens after a retry
- **model fragility** — `toolCallSource: "rescued"`, meaning it wrote the call as
  text instead of using the structured format

That last one is a good thermometer: if it climbs, the model is at the edge of
the task.

## Adding your own telemetry

`ctx.meta()` writes onto this step's node, so it appears in `report.json` and in
the Flow graph:

```ts
async execute(@input() args, @context() ctx: Context) {
  const rows = await db.query(args.sql);
  ctx.meta({ rowCount: rows.length, cached: false });
  return format(rows);
}
```

Middleware has the same thing as `inv.meta()` — it is how a cache that hits in
4ms says so, instead of leaving you to infer it from the duration.

## Reading the JSON

```ts
import { readFile } from "node:fs/promises";

const report = JSON.parse(await readFile(`report/${runId}/report.json`, "utf8"));

const errors = countNodes(report, (n) => n.kind === "tool" && n.status === "error");
```

```ts
interface ExecutionNode {
  id: string;
  kind: "workflow" | "loop" | "parallel" | "agent" | "chat" | "tool";
  name: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  status: "ok" | "error";
  error?: string;
  data: Record<string, unknown>;
  children: ExecutionNode[];
}
```

This is what to attach to a bug report — it carries far more than a description
of what you saw.

## Cost

Tokens appear with no configuration — Ollama and OpenAI both report them. For
money, give the provider a price:

```ts
super({ apiKey, model, costPer1kTokens: { input: 0.00015, output: 0.0006 } });
```

There is no built-in table, deliberately: prices change, and a stale table lies
confidently.

## Opt-in, zero cost

With no `report` and no `log`, nothing is captured and there is no overhead — the
instrumentation is a no-op, and the run skips building the tree entirely. It is
worth about 2× in CPU time per run.

There is no external service and no telemetry. The report is a local file.

## Nested runs

A sub-workflow started by a tool is nested inside the tool's node:

```
workflow ParentWorkflow
  agent ParentAgent
    chat
      tool deploy
        workflow DeployWorkflow
          agent DeployAgent
```

Isolating a subtask costs you shared context, not observability.

## Related

- [Flow](/en/devtools/flow) — the same run, live
- [Logging](/en/devtools/logging)
- [Debugging](/en/devtools/debugging)
- [`ThenaConfig`](/en/reference/thena-config)
