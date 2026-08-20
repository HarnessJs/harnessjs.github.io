# Your first workflow

A workflow declares the order of the steps. Every step shares the same state and
the same conversation history, so what one agent says, the next one sees.

A step is one of exactly three things:

```ts
import { Workflow, parallel, loop, untilAnswered } from "@thenajs/core";

@Workflow({
  steps: [
    PlannerAgent, // 1. an agent, in sequence
    parallel([ExplorerAgent, ReviewerAgent]), // 2. concurrent
    loop({
      // 3. repetition
      steps: [ExecutorAgent],
      until: untilAnswered,
      maxIterations: 8,
    }),
  ],
})
export class MyWorkflow {}
```

They nest freely — a `loop` can hold a `parallel`, which can hold another `loop`.

## Sequence

The simplest form. Each agent runs after the previous one and sees what it said,
because the history is shared.

```ts
@Workflow({ steps: [ResearcherAgent, WriterAgent] })
export class ArticleWorkflow {}
```

::: tip One step's output becomes the next one's own words
An agent's turn enters the history as `assistant`. The next agent receives that
as if **it** had said it — which is right for a continuing conversation, and
wrong when the output should have been context instead.
:::

## Parallel

For independent agents looking at the same input:

```ts
parallel([SecurityAnalystAgent, PerformanceAnalystAgent]);
```

They all get the same state and run at the same time. Because they all write to
`ctx.output`, the last write wins — read the results from the shared history, or
have each agent write into a field of its own on `ctx`.

## Loop

Where the agent works in several turns — investigate, act, look, repeat:

```ts
loop({
  steps: [ExecutorAgent],
  until: untilAnswered,
  maxIterations: 8,
  onExhausted: (ctx, n) => console.warn(`hit the ceiling after ${n} turns`),
});
```

`until` returns **`true` to stop**. `untilAnswered` is the built-in one that
means "stop when the agent answered without calling a tool" — the usual end of an
investigate-and-act loop.

`maxIterations` defaults to `10`, and it is not optional in spirit: without a
ceiling, a model that never converges runs forever.

## A complete example

A reviewer that reads, judges and repeats until it approves. The state is what
ties it together:

```ts
// src/workflows/review.state.ts
export class ReviewState {
  approved = false;
  rounds = 0;
}
```

```ts
// src/workflows/review.workflow.ts
@Workflow({
  state: ReviewState,
  steps: [
    PlannerAgent, // decides what to look at
    loop({
      steps: [ReaderAgent, ReviewerAgent],
      until: (_ctx, s: ReviewState) => s.approved,
      maxIterations: 5,
      onExhausted: (_ctx, rounds) =>
        console.warn(`did not approve in ${rounds} rounds`),
    }),
  ],
})
export class ReviewWorkflow {}
```

```ts
// the reviewer writes the decision that `until` reads
import { state } from "@thenajs/core";

export class ReviewerAgent {
  constructor(@state() private readonly s: ReviewState) {}

  async afterResponse(response: string) {
    this.s.rounds++;
    this.s.approved = response.includes("APPROVED");
  }
}
```

Note the second parameter of `until`: it is the `ReviewState` instance for this
run. Without something writing `approved`, the condition would never become true
and the loop would run to the ceiling every time — the most common mistake when
building a loop with your own stopping criterion.

## Running it

```ts
// src/main.ts
import { Thena } from "@thenajs/core";
import { ReviewWorkflow } from "./workflows/review.workflow";
import { config } from "./config";

const app = Thena.create(ReviewWorkflow, config);

const verdict = await app.run({
  input: { message: "Review the src/ directory" },
  memory: { userId: "123" }, // durable context, becomes a `system` message
});

await app.dispose();
```

`run` returns the output and **propagates** the error — printing is your
application's job, not the framework's. Concurrent calls are safe: each one opens
its own run context.

**Next: [configuration](/en/get-started/configuration).**
