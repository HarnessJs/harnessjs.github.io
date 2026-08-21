# Multi-agent systems

More agents is not better. Each one is a separate prompt to maintain and at least
one more model call to pay for. The reason to split is that a **single prompt is
trying to hold two incompatible jobs**.

Good reasons to split:

- the jobs need different **tools** (a reader that only reads, an executor that
  can act)
- they need different **sampling** (a planner at `temperature: 0`, a writer at
  `0.8`)
- they need different **models** (a cheap classifier, an expensive reasoner)
- one must **judge** the other, and cannot be the same voice

Bad reasons: "it feels more organised", or because the prompt got long. A long
prompt is usually a prompt problem.

## The three shapes

### Pipeline

Each step refines the previous one, sharing history.

```ts
@Workflow({ steps: [ResearcherAgent, WriterAgent, EditorAgent] })
export class ArticleWorkflow {}
```

The catch: one step's output enters the next as the **assistant's own words**. If
the researcher's output is *context* rather than *speech*, promote it — otherwise
the writer reads it and concludes it already answered. See
[State and context](/en/fundamentals/state-and-context).

### Fan-out

Independent perspectives on the same input.

```ts
@Workflow({ steps: [parallel([SecurityAgent, PerfAgent]), SummariserAgent] })
```

The summariser is not optional: something has to combine the branches, because
`ctx.output` after a `parallel` is the last declared branch's, and the other
answers are gone. See
[Parallel execution](/en/techniques/parallel-execution).

### Critic loop

The one that changes results the most, and the one people get wrong.

```ts
export class ReviewState {
  approved = false;
  rounds = 0;
}

@Workflow({
  state: ReviewState,
  steps: [
    PlannerAgent,
    loop({
      steps: [ExecutorAgent, ReviewerAgent],
      until: (_ctx, s: ReviewState) => s.approved,
      maxIterations: 5,
      onExhausted: (_ctx, n) => console.warn(`no approval in ${n} rounds`),
    }),
  ],
})
export class ReviewWorkflow {}
```

```ts
export class ReviewerAgent {
  constructor(@state() private readonly s: ReviewState) {}

  async afterResponse(response: string) {
    this.s.rounds++;
    this.s.approved = /\bAPPROVED\b/.test(response);
  }
}
```

The reviewer must **write** what `until` reads. Without that, the loop runs to
the ceiling every time — the single most common bug in this shape.

::: tip Give the critic a way to say yes
A reviewer prompted only to find problems will always find one. Say explicitly:
*"If the work meets the criteria, reply exactly APPROVED and nothing else."*
:::

## Coordination is shared state, not messages

There is no agent-to-agent messaging. Agents coordinate through two channels:

| Channel | Who sees it | Use for |
| --- | --- | --- |
| `ctx.state.history` | the model, every turn | the conversation itself |
| `@Workflow({ state })` | your code only | decisions, counters, flags |

The typed state is where control flow lives. The history is where the reasoning
lives. Keeping them separate is what stops "did the reviewer approve?" becoming a
regex over prose in three places.

## Isolating a noisy specialist

When a subtask takes ten rounds to produce one line, running it in the parent's
history poisons the parent's context. Run it as a tool instead:

```ts
export class DeployTool {
  constructor(private readonly runtime: WorkflowRuntime) {}

  async execute(@input() { repo }: { repo: string }) {
    return this.runtime.run(DeployWorkflow, {
      input: { message: `Deploy ${repo}` },
    });
  }
}
```

The parent sees one string; the report still nests the whole child run inside the
tool node. See [Nested runs](/en/techniques/nested-runs).

The decision, in one line: **shared history when the parent must see the path,
isolated run when only the result matters.**

## Cost grows faster than you expect

A critic loop with `maxIterations: 5` over two agents is up to 10 model calls,
plus tools. Nested inside a `parallel` of three, 30.

Multi-agent is where a run-level `budget` stops being optional:

```ts
await app.run({ input, budget: { maxChatCalls: 30, maxCostUsd: 0.5 } });
```

## Building it up

Start with one agent and a loop. Split only when you can name which of the four
reasons at the top applies. Every split should make some prompt shorter — if all
of them got longer, it was the wrong cut.

## Related

- [Workflows](/en/fundamentals/workflows)
- [Loops](/en/techniques/loops)
- [Nested runs](/en/techniques/nested-runs)
- [Architecture](/en/best-practices/architecture)
