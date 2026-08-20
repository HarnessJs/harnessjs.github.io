# `@Agent`

Registers a class as an agent and loads its prompt from markdown.

```ts
import { Agent } from "@thenajs/core";

@Agent({
  provider: LocalOllamaProvider,
  tools: [ReadFileTool],
  prompt: "./explorer.agent.md",
  sampling: { temperature: 0 },
})
export class ExplorerAgent {}
```

## `AgentConfig`

| Key | Type | Required | Default |
| --- | --- | --- | --- |
| `provider` | `Providers \| ProviderCtor \| () => Providers` | yes | — |
| `prompt` | `string \| URL` | yes | — |
| `tools` | `(ToolType \| ToolClass)[]` | no | `[]` |
| `sampling` | `SamplingParams` | no | the provider's |

### `provider`

Three forms, resolved differently:

| Form | When it is built | Reads `context()`? |
| --- | --- | --- |
| instance | once, by you | — |
| class | `new ProviderCtor()`, no arguments | no |
| factory | **once per run**, inside the run scope | yes |

```ts
provider: () => new OpenAIProvider({ apiKey: keyFor(context().data) });
```

### `prompt`

- **relative path** — resolved from the agent's own file, by reading a stack
  trace
- **absolute path**
- **`URL`** — `new URL("./x.agent.md", import.meta.url)`, no stack trace

Read at runtime, so in a compiled build the `.md` must reach `dist/`.

### `sampling`

Overrides the provider's sampling **key by key** — unset keys keep the
provider's value. See [Providers](/en/reference/providers#samplingparams).

## `AgentMetadata`

What the decorator registers, readable with `getAgentMetadata(AgentClass)`:

```ts
interface AgentMetadata {
  provider: ProviderInput;
  tools: ToolInput[];
  prompt: string; // already loaded from the .md
  sampling?: SamplingParams;
}
```

## Class members

All optional. The runtime calls what exists.

| Member | Purpose |
| --- | --- |
| `constructor(@state() …, @memory() …)` | [injection](/en/reference/injection) |
| `beforePrompt`, `beforeTool`, `afterTool`, `afterResponse`, `onError` | [hooks](/en/reference/hooks) |
| `run(input, ctx)` | takes over the whole step — **no hook fires** |

### `run(input, ctx)`

```ts
export class CustomAgent {
  async run(input: string, ctx: Context): Promise<string> {
    return `handled ${input}`;
  }
}
```

The total escape hatch. The framework calls this instead of running a turn: no
model call, no tool loop, no hooks.

## Errors

```
[@Agent] Prompt markdown not found: /path/…
```

The relative path resolves from the agent's file. Moving the `.ts` without the
`.md` breaks it.

## Related

- [Agents](/en/fundamentals/agents) — the concept
- [`@Tool`](/en/reference/tool)
- [`@Workflow`](/en/reference/workflow)
- [Hooks](/en/reference/hooks)
