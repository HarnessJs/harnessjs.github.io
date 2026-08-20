# `ThenaConfig`

Passed to `Thena.create(...)`. Everything is optional.

```ts
import type { ThenaConfig } from "@thenajs/core";

export const config: ThenaConfig = {
  log: true,
  report: true,
  stores: [MyQdrant],
  redact: true,
};

const app = Thena.create(MyWorkflow, config);
```

| Key | Type | Default |
| --- | --- | --- |
| `log` | `boolean \| "verbose" \| (e: ExecutionEvent) => void` | off |
| `report` | `boolean \| ReportOptions` | off |
| `stores` | `VectorStoreCtor[]` | — |
| `redact` | `RedactConfig` | **on** |

## `log`

```ts
type LogConfig = boolean | "verbose" | ((event: ExecutionEvent) => void);
```

| Value | Effect |
| --- | --- |
| `true` | indented console tree, with durations |
| `"verbose"` | the same, plus content (response, tool I/O) |
| function | your own sink — pino, winston, a file, JSON lines |

```
[thena] ▸ workflow ExplorerWorkflow
[thena]   ▸ agent ExplorerAgent
[thena]     ▸ chat
[thena]     ▸ tool read_file
[thena]     ◂ tool read_file  3ms ✓
[thena]     ◂ chat  1.81s ✓
```

## `report`

```ts
interface ReportOptions {
  dir?: string; // default "report"
  format?: "html" | "json" | "both"; // default "both"
  content?: boolean; // default true
}
```

`content: false` keeps the tree, the durations and the telemetry, and drops the
text. It is the setting for handling personal data: known secrets are already
masked by `redact`, but there is no regex for a name or an address.

Each run writes `<dir>/<runId>/index.html` and `<dir>/<runId>/report.json`.
`<dir>/index.html` is an index of every run.

## `stores`

```ts
stores: [QdrantNomic, QdrantOpenAI];
```

Vector store **classes**. Each is instantiated **once** and shared by every
agent — one connection and one collection setup, however many agents exist.

Injection is positional: the array's order is the order of the agents'
constructor parameters.

::: warning Reordering silently changes behaviour
The parameters have the same type, so TypeScript cannot catch it. Treat the order
as a contract — append at the end, never in the middle. Or name the store:
`@memory(QdrantOpenAI)`.
:::

Several stores make sense when they are mutually incompatible — typically
embedding models of different dimensions, which cannot share a collection.

Embeddings come from each agent's own `provider`, whose `embed()` is public and
which accepts `embedModel`.

## `redact`

**On by default.** Masks known secrets in everything captured — prompt, response,
tool I/O and error messages — before it reaches the report, the log or a plugin:
`Bearer …`, connection strings with a password, `sk-…`, `ghp_…`, JWTs, and fields
named like `api_key` or `password`.

A file on disk, with no retention policy and no access control, is the worst place
for a secret to surface by accident.

```ts
redact: false;                        // off
redact: (text) => myMasking(text);    // replaces the default
```

To add patterns without losing the built-in ones, use the exported
`redactSecrets`. See [Redaction](/en/advanced/redaction).

## Per-run overrides

`report` and `log` can be overridden for a single execution, because each run has
its own context:

```ts
await app.run({ input, report: false, log: "verbose" });
```

See [Per-run configuration](/en/techniques/per-run-configuration).

## Related

- [Configuration](/en/get-started/configuration) — the guided version
- [Run and RunHandle](/en/reference/run)
- [Report](/en/devtools/report)
