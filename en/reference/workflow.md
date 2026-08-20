# `@Workflow`

Declares the order of the steps. They all share the same state.

```ts
import { Workflow, loop, parallel, untilAnswered } from "@thenajs/core";

@Workflow({
  state: ReviewState,
  steps: [
    PlannerAgent,
    parallel([SecurityAgent, PerfAgent]),
    loop({ steps: [ExecutorAgent], until: untilAnswered, maxIterations: 8 }),
  ],
})
export class ReviewWorkflow {}
```

## `WorkflowConfig`

| Key | Type | Required |
| --- | --- | --- |
| `steps` | `WorkflowStep[]` | yes |
| `state` | `new () => object` | no |

### `steps`

```ts
type WorkflowStep = AgentClass | ParallelStep | LoopStep;
```

Run in order. `parallel` and `loop` blocks nest freely inside each other. See
[Steps](/en/reference/steps).

### `state`

```ts
export class ReviewState {
  approved = false;
  rounds = 0;
}
```

Initial values are the field initialisers — no schema, no factory. The framework
instantiates **one per run** and hands the same object to everyone who asks:

| Who | How |
| --- | --- |
| an agent | `constructor(@state() private s: ReviewState)` |
| a tool | `execute(@input() a, @state() s: ReviewState)` |
| a loop's `until` | the second parameter |

Omitting `state` is fine as long as nothing asks for it. If something does, the
failure names the class and the parameter rather than injecting `undefined` — and
for an `until` that declares a second parameter, it is caught **before the run
starts**, from the function's arity.

## `WorkflowMetadata`

Readable with `getWorkflowMetadata(WorkflowClass)`:

```ts
interface WorkflowMetadata {
  steps: WorkflowStep[];
  state?: StateCtor;
}
```

## Running it

```ts
const app = Thena.create(ReviewWorkflow, config);
```

`Thena.create` is not async. See [Run and RunHandle](/en/reference/run).

A single agent still needs a workflow — the run's context, budget, cancellation
and recorder belong to it:

```ts
@Workflow({ steps: [MyAgent] })
export class MyWorkflow {}
```

## Related

- [Workflows](/en/fundamentals/workflows) — the concept
- [Steps](/en/reference/steps) — `parallel`, `loop` and the `until` helpers
- [Run and RunHandle](/en/reference/run)
