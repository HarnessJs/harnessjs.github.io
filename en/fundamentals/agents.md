# Agents

An agent is one step of a workflow: a provider, a set of tools, and a prompt.

```ts
@Agent({
  provider: LocalOllamaProvider,
  tools: [ReadFileTool],
  prompt: "./explorer.agent.md",
  sampling: { temperature: 0 },
})
export class ExplorerAgent {}
```

## What it is

A class decorated with `@Agent`. The class body is usually empty — the
interesting parts are in the decorator and in the markdown next to it.

That is the design: an agent is a *declaration*, not an implementation. The turn
loop (call the model, notice a tool call, validate, run it, feed the result back)
belongs to the framework and is identical for every agent you write.

## Configuration

| Key | Required | What it is |
| --- | --- | --- |
| `provider` | yes | who talks to the model — an instance, a class, or a factory |
| `prompt` | yes | path to the markdown prompt, or a `URL` |
| `tools` | no | the actions this agent may take |
| `sampling` | no | overrides the provider's sampling, key by key |

### `prompt`

The prompt lives in markdown, next to the class:

```
src/agents/explorer/
  explorer.agent.ts
  explorer.agent.md
```

A relative path resolves from **the agent's file**, not from the working
directory. Absolute paths and `URL` values also work:

```ts
prompt: new URL("./explorer.agent.md", import.meta.url);
```

The `URL` form is worth knowing about: the relative-path form resolves by reading
a stack trace, which is fine but not free. The `URL` form skips that.

::: warning In a compiled build, the `.md` must reach `dist/`
The prompt is read at runtime from the path next to the compiled `.js`. Projects
created by `thena create` already copy them.
:::

### `provider`

Three forms, and they are a scoping mechanism — you pick the axis:

```ts
provider: sharedInstance;              // one instance for every run
provider: LocalOllamaProvider;         // `new` per app, no arguments
provider: () => new OpenAIProvider({   // called once per run
  apiKey: keyFor(context().data),
});
```

The factory form runs **inside the run's scope**, so it can read `context()` —
which is how a key, model or endpoint comes from that run's own data. It is the
foundation of multi-tenancy.

### `sampling`

Overrides the provider's sampling key by key, so one provider can serve a
deterministic agent and a creative one:

```ts
@Agent({ provider: Shared, prompt: "./writer.agent.md",
         sampling: { temperature: 0.8 } })
export class WriterAgent {}
```

## Why the prompt is a separate file

Prompts change constantly, and for different reasons than code does. A word
here, an example there — driven by what the model got wrong yesterday, not by a
change in your types.

Keeping it in `.md` means a prompt tweak is a prompt diff. It reviews as prose,
because it is prose. And nobody has to escape a backtick inside a template
literal to add an example.

## Adding behaviour

The class body is where you go when declaring is not enough.

**Hooks** intercept the turn — see [Hooks](/en/fundamentals/hooks):

```ts
export class ReviewerAgent {
  async afterResponse(response: string) {
    this.state.approved = response.includes("APPROVED");
  }
}
```

**Constructor injection** brings in the workflow state and vector memory — see
[Dependency injection](/en/fundamentals/dependency-injection):

```ts
export class ReviewerAgent {
  constructor(
    @state() private readonly s: ReviewState,
    @memory(QdrantOpenAI) private readonly vectors: VectorMemory,
  ) {}
}
```

## Taking over the whole turn

If the class defines `run(input, ctx)`, it owns the step: the framework calls it
instead of running a turn, and **no hook fires**.

```ts
export class CustomAgent {
  async run(input: string, ctx: Context) {
    return `handled ${input} myself`;
  }
}
```

This is the total escape hatch. It is the right tool when a step is not really an
agent — a deterministic transformation you want inside the same run, with the
same state, budget and report — and the wrong tool for anything you could get
from a hook.

## Common mistakes

**Expecting one agent to do several turns.** An agent step is *one* turn: one
model call and at most one tool. Investigating before answering takes a
loop.

**Forgetting the model reads `description`, not your intent.** If the agent
describes an action instead of taking it, the tool's `description` is usually the
cause — see Tool design.

**Leaving sampling unset while iterating.** Without `temperature: 0` you cannot
tell an improvement from luck.

## Related

- [Tools](/en/fundamentals/tools) — what an agent can do
- [Workflows](/en/fundamentals/workflows) — how agents are ordered
- [Hooks](/en/fundamentals/hooks) — intercepting the turn
