# Workflows

A workflow declares the order of the steps and the state they share. It is also
the unit of execution: a run belongs to a workflow, not to an agent.

```ts
@Workflow({
  state: ReviewState,
  steps: [PlannerAgent, loop({ steps: [ReaderAgent, ReviewerAgent], until })],
})
export class ReviewWorkflow {}
```

## Why an agent needs one

Even for a single agent:

```ts
@Workflow({ steps: [MyAgent] })
export class MyWorkflow {}
```

The run's context, budget, cancellation, state and recorder all belong to the
workflow. Letting the single-agent case skip it would mean two execution models
instead of one.

## The three kinds of step

```ts
import { parallel, loop, untilAnswered } from "@thenajs/core";

steps: [
  PlannerAgent,                              // sequence
  parallel([SecurityAgent, PerfAgent]),      // concurrent
  loop({ steps: [Executor], until: untilAnswered, maxIterations: 8 }),
];
```

They nest freely. A `loop` can hold a `parallel`, which can hold another `loop`.

### Sequence

Steps run in order and share the same conversation history, so each one sees what
the previous said.

### Parallel

`parallel([...])` runs its steps at the same time. Every branch reads the same
history, and their turns are appended in declaration order.

`ctx.output` ends up being the last declared branch's, so the other answers are
lost. Read the results from the history, or have each agent write to a field of
its own:

```ts
export class SecurityAgent {
  afterResponse(r: string, ctx: Context) {
    ctx.security = r;
  }
}
```

### Loop

```ts
loop({
  steps: [ExecutorAgent],
  until: untilAnswered,
  maxIterations: 8,
  onExhausted: (ctx, n) => console.warn(`ceiling after ${n}`),
  maxFails: 5,
  onFail: (ctx, info) => console.warn(info.message),
});
```

`until` returns **`true` to stop**. Defaults: `maxIterations` is `10`,
`maxFails` is `5` — consecutive tool failures that end the loop, because the
signal of being stuck is repetition, not accumulation. `Infinity` turns it off.

## State

```ts
export class ReviewState {
  approved = false;
  rounds = 0;
}

@Workflow({ state: ReviewState, steps: [...] })
export class ReviewWorkflow {}
```

The initial values are the field initialisers — no schema, no factory. The
framework instantiates **one per run**, and everyone sees the same object:
agents via `@state()`, tools via `@state()`, and a loop's `until` as its second
parameter.

```ts
until: (ctx, s: ReviewState) => s.approved;
```

`state` is optional. If nothing asks for it, nothing pays for it — and if
something does ask while the workflow declares none, the failure names the class
and the parameter rather than handing you `undefined`.

See [State and context](/en/fundamentals/state-and-context).

## Running it

```ts
const app = Thena.create(ReviewWorkflow, config);
const result = await app.run({ prompt: "Review src/" });
await app.dispose();
```

`Thena.create` is not async. `app.run` returns a
`RunHandle` — `await` it for the result, or keep it to
cancel and observe.

Concurrent `run` calls are safe: each opens its own context, state and budget.

## Common mistakes

**Inverting `until`.** `true` means stop. A condition that reads like "keep
going while…" is backwards.

**Expecting a bare agent step to iterate.** One agent step is one turn. Wrap it
in a `loop` if the task needs investigation.

**Nothing writes what `until` reads.** The single most common cause of a loop
that always hits `maxIterations`. Set `onExhausted` to find out.

**`push`-ing to a shared array from every `parallel` branch.** The history is
ordered; your own state object is still written in completion order. Assign to
distinct keys.

## Related

- [State and context](/en/fundamentals/state-and-context)
