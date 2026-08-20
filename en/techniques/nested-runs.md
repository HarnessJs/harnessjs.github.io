# Nested runs

Sometimes a subtask is noisy: ten rounds of trial and error to reach a one-line
answer. If that happens in the same history, the parent agent carries all the
noise — and with a small model, that degrades its decisions.

The way out is running the subtask in a **workflow of its own**, started by a
tool:

```
parent agent  (lean history)
 └─ tool ──▶ isolated workflow  (its own state)
              ├─ 10 rounds of trial and error
              └─ returns ONE string to the parent
```

## How to write it

The tool's constructor receives an injected `WorkflowRuntime`:

```ts
import { Tool, WorkflowRuntime, input } from "@thenajs/core";
import { z } from "zod";
import { DeployWorkflow } from "../workflows/deploy.workflow";

@Tool({
  name: "deploy",
  description: "Runs the deploy process and returns the result.",
  schema: z.object({ repository: z.string() }),
})
export class DeployTool {
  constructor(private readonly runtime: WorkflowRuntime) {}

  async execute(@input() { repository }: { repository: string }) {
    return this.runtime.run(DeployWorkflow, {
      input: { message: `Deploy ${repository}` },
      memory: { environment: "staging" }, // explicit context for the child
    });
  }
}
```

The child starts with fresh state: it gets only what you passed in `input` and
`memory`.

That is the point — its noise does not pollute the parent — and it has a cost: it
starts not knowing what was asked. To pass something from the parent's
conversation through, ask for the context:

```ts
async execute(
  @input() { repository }: { repository: string },
  @context() ctx: Context,
) {
  const original = ctx.state.history.find((m) => m.role === "user")?.content;

  return this.runtime.run(DeployWorkflow, {
    input: { message: `Deploy ${repository}` },
    memory: { originalRequest: original },
  });
}
```

This is the central use case for `@context()`: **you** choose what crosses the
isolation, instead of all or nothing.

## Step or tool? The decision guide

This is the central architectural choice in a workflow, and the two look
equivalent until the first time the difference bites.

| | sub-agent as a **step** | sub-agent as a **tool** |
| --- | --- | --- |
| History | shared with the parent | its own, isolated |
| The output becomes | an `assistant` message | a tool observation |
| Who decides it runs | you, in the order of `steps` | the model, by calling the tool |
| Context cost in the parent | every turn of the child | one string |
| Use when | it is one conversation and the parent needs to see the path | the subtask is noisy, or only the result matters |

## You do not lose visibility

The report nests the child's run inside the tool's node:

```
workflow ParentWorkflow
  agent ParentAgent
    chat
      tool deploy
        workflow DeployWorkflow      ← the child appears here
          agent DeployAgent
            chat
```

You gave up shared context, not observability.

## The budget does cross

::: warning This changed in 0.9
A nested run **counts against its parent's budget**. Earlier versions kept
separate counters, and older documentation still says the budget does not cross —
it does now.
:::

Without a budget of its own, the child uses the parent's tracker. With one, it
gets a chained tracker and whichever limit blows first wins:

```ts
return this.runtime.run(DeployWorkflow, {
  input: { message: `Deploy ${repository}` },
  budget: { maxChatCalls: 5 }, // its own ceiling, still inside the parent's
});
```

The reason is that inheriting was otherwise an escape hatch: a `maxCostUsd` of $1
at the top could be walked around by any tool that started a sub-workflow.

Note that nesting relaxes the precision of the ceiling slightly — a run can
overshoot by one model call per level of nesting, because stopping is checked
between units of work.

## `WorkflowRuntime`

```ts
runtime.run<T = string>(WorkflowClass, options: WorkflowRunOptions): Promise<T>;
```

It is stateless — everything the run needs comes from the `RunContext` — and it
returns a plain `Promise`, not a `RunHandle`. A nested run is not separately
cancellable: it is cancelled with its parent, through the shared signal.

Only `input`, `memory` and `budget` are forwarded.

## When not to use it

Isolation costs a round trip's worth of context-setting, and the child cannot see
what the parent learned. If the parent genuinely needs to follow the reasoning —
a review that must see the investigation — make it a step and share the history.

## Related

- [Workflows](/en/fundamentals/workflows)
- [Multi-agent systems](/en/techniques/multi-agent-systems)
- [Budgets](/en/techniques/budgets)
- [`@Tool`](/en/reference/tool)
