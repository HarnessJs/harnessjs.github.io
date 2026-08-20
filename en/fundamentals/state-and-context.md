# State and context

Every run carries a `ctx` object that crosses all the steps. It has two parts
that are easy to confuse — and that confusion is the source of most questions.

```
ctx                    ← the run's context: your fields and the runtime's
 └─ ctx.state          ← the conversation with the model: what it actually sees
```

**Rule of thumb:** if the model needs to read it, it goes in `ctx.state`. If it is
your data, for your code to decide something, it goes on `ctx` directly.

## `ctx.state` — what the model sees

Three compartments, each becoming part of the prompt:

| Bucket | What it holds | How it reaches the model |
| --- | --- | --- |
| `history` | the conversation: `user`, `assistant`, `tool` turns | the messages, in order |
| `memory` | durable context (`string[]`) | a `system` message at the top |
| `tasks` | items being tracked (`string[]`) | a note inside the `system` message |

```ts
ctx.state.history; // Message[]
ctx.state.memory; // string[]
ctx.state.append("memory", "The user is called Castro");
ctx.state.set("history", ctx.state.history.slice(0, -1)); // drop the last turn
```

The initial `memory` is seeded at `run`:

```ts
await app.run({
  input: { message: "Hello" },
  memory: { userId: "123", plan: "pro" }, // becomes durable context
});
```

## `ctx` — your loose data

The context accepts any field, typed as `unknown`:

```ts
ctx.attempts = ((ctx.attempts as number) ?? 0) + 1;
```

Good for a one-off marker. For what steps genuinely exchange, prefer
[the workflow state](#the-workflow-state), which is typed and needs no cast.

The runtime writes some fields there too:

| Field | What it is |
| --- | --- |
| `ctx.turn` | last turn's summary: `calledTool`, `toolName`, `toolError`, `toolCallSource`, `response` |
| `ctx.output` | the last step's output |
| `ctx.budget` | accumulated usage, when there is a budget |

And the run-level controls, which are about the **execution** rather than the
step:

| | |
| --- | --- |
| `ctx.runId` | the run's id, the same one in every `ExecutionEvent` |
| `ctx.data` | your data channel — **never goes to the model** |
| `ctx.signal` | the run's `AbortSignal`, to pass to your `fetch` |
| `ctx.usage()` | accumulated usage so far |
| `ctx.abort(reason)` | cancel the run from inside |
| `ctx.stop()` | end it gracefully, keeping the output so far |
| `ctx.onDispose(fn)` | register a cleanup, run in reverse like `defer` |
| `ctx.meta(data)` | write telemetry onto this step's node |

## `memory` vs `data`

They look alike and are opposites. Both travel with the run; only one reaches the
model.

```ts
await app.run({
  input: { message: "What's my plan?" },
  memory: { plan: "pro" }, // serialised into `system` — the model reads it
  data: { accountId: "acme" }, // never serialised, never in the report
});
```

Use `memory` for context the model **should** read. Use `data` for what the run
must carry and the model should not see: a tenant id, an internal token, a
correlation id.

`data` is typed by you:

```ts
type MyRun = { accountId: string; region: string };

const app = Thena.create<string, MyRun>(Flow, config);
await app.run({ input, data: { accountId: "acme", region: "sa-east-1" } });

context<MyRun>().data.accountId; // string, no cast
```

::: tip Use `type`, not `interface extends`
An `interface` that extends the run-data shape inherits its index signature, so a
misspelled field silently becomes `unknown` instead of a compile error.
:::

## The workflow state

For what steps exchange with each other, declare a class. The initial values are
the field initialisers — no schema, no factory, no cast:

```ts
// src/workflows/review.state.ts
export class ReviewState {
  approved = false;
  rounds = 0;
  problems: string[] = [];
}
```

The workflow declares it, and the framework instantiates **one per run**:

```ts
@Workflow({ state: ReviewState, steps: [ /* … */ ] })
export class ReviewWorkflow {}
```

Whoever needs it asks with `@state()`:

```ts
@Agent({ provider: MyProvider, prompt: "./reviewer.agent.md" })
export class ReviewerAgent {
  constructor(@state() private readonly s: ReviewState) {}

  async afterResponse(response: string) {
    this.s.rounds++;
    this.s.approved = /\bAPPROVED\b/.test(response);
  }
}
```

And `until` receives it as its second parameter:

```ts
loop({
  steps: [ReviewerAgent],
  until: (ctx, s: ReviewState) => s.approved,
  maxIterations: 5,
});
```

Everyone sees **the same object** — agents, hooks, tools and the `until`. No
`as unknown as`, no loose field on `ctx`.

::: tip Tools too
A tool can ask for the state: `async execute(@input() args, @state() s)`. It is
how a tool reaches something belonging to the flow.
:::

## One step's output becomes the next one's words

A consequence of shared state worth knowing before it bites.

When an agent answers, its turn is appended to `history` as `role: "assistant"`.
The next agent reads the same `history` — so it receives that **as if it had
already answered itself**.

In most flows that is what you want: a continuing conversation. But when the
output is *context* (a plan, a summary, a piece of research) rather than *speech*,
promote it:

```ts
export class PlannerAgent {
  afterResponse(plan: string, ctx: Context) {
    ctx.state.set("history", ctx.state.history.slice(0, -1)); // out of the transcript
    ctx.state.append("memory", `Plan to follow:\n${plan}`); // into the system message
    ctx.plan = plan;
  }
}
```

This is the cause behind "the second agent answers with nothing": it read the
history, saw an assistant turn, and concluded it was done.

The alternative — when the step needs a history of its own rather than just a
clean output — is to isolate it. See
Nested runs.

## What a tool sees

By default `execute` receives **only the validated arguments**, which keeps the
tool a pure function from the flow's point of view and trivial to test:

```ts
async execute(@input() { path }: { path: string }) {
  return readFile(path, "utf8");
}
```

When it needs more, the parameters say so:

```ts
async execute(
  @input() { path }: { path: string },
  @context() ctx: Context,
  @state() s: ReviewState,
) {
  s.filesRead.push(path);
  return readFile(path, "utf8");
}
```

Use sparingly: a tool that reads the context stops being testable on its own.

## Related

- [The run](/en/fundamentals/the-run)
- [Dependency injection](/en/fundamentals/dependency-injection)
