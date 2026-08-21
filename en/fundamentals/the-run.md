# The run

A run has three nested layers. Understanding the order answers most "why did that
happen before this" questions.

## From the top

```
app.run()
 └─ workflow
     └─ step 1, step 2, step 3…          ← the order you declared in `steps`
         └─ each step is an agent, a `parallel` or a `loop`
             └─ agent turn
                 ├─ builds the messages
                 ├─ calls the model
                 ├─ if it asked for a tool: validate, run, keep the result
                 └─ returns the response
```

A `loop` repeats its inner block until `until` is true. A `parallel` runs its
steps at the same time, over one frozen read of the history, and appends what
they produced in declaration order.

## One agent turn, in detail

This is where hooks fit. The exact order:

```
beforePrompt(prompt, ctx)          ← changes the system prompt
        ↓
   model call
        ↓
   did it ask for a tool?
   ├─ yes → beforeTool(call, ctx)   ← swap args, or `throw` to cancel
   │          ↓
   │       execute(args)            ← your code, args already validated
   │          ↓
   │        afterTool(result, ctx)  ← transform the result
   └─ no  → (carry on)
        ↓
afterResponse(response, ctx)        ← transform the turn's response
        ↓
   writes ctx.turn and ctx.output

  any throw above → onError(error, ctx)
```

Every hook is optional. With none of them the turn happens identically — they
exist only for when you need to get in the middle.

::: tip The hook contract
Returning a value **replaces**. Returning `undefined` **keeps** the original.
That is why a `beforePrompt` that only wants to observe can simply return
nothing.
:::

## A turn is one call, not the whole task

The distinction that confuses people early: **an agent turn is a single round** —
one model call and at most one tool.

If the task needs investigation before answering, it needs several rounds. That
is what `loop` is for:

```ts
loop({ steps: [ReaderAgent], until: untilAnswered, maxIterations: 8 });
```

Without the loop, the agent would call a tool and the workflow would end right
there — with the tool's result as the output, and the model never given a chance
to interpret it.

## What survives between steps

Every step in a workflow shares the **same state**. An agent appends its turn to
the history; the next agent already sees the conversation so far.

That has a consequence worth knowing before it bites: one step's response enters
the next as the assistant's own words. See
[State and context](/en/fundamentals/state-and-context) for how to promote it to
context instead.

## The run's lifetime

Everything scoped to a run is created when `app.run()` is called and torn down
when it settles:

| | |
| --- | --- |
| `runId` | available synchronously, before the first turn |
| state | one instance of the `@Workflow({ state })` class |
| budget tracker | only if `budget` was passed |
| recorder | only if the run is being observed |
| `AbortSignal` | yours, combined with the handle's `abort()` |
| cleanups | `ctx.onDispose(fn)`, run in reverse on success, error or abort |

Concurrent runs never see each other. Two requests in one process each open their
own `RunContext`.

## Ending early

Two different things, and the difference matters:

- **`ctx.abort(reason)`** — cancels. The in-flight turn is interrupted and the
  reason arrives at the caller's `catch`.
- **`ctx.stop()`** — ends **gracefully**. Remaining steps are skipped and the run
  returns the output it already had, without throwing. Same behaviour as a budget
  in `"stop"` mode.

## Watching it happen

Turn on the log and the tree appears live:

```ts
export const config: ThenaConfig = { log: true };
```

```
[thena] ▸ workflow ReaderWorkflow
[thena]   ▸ loop
[thena]     ▸ agent ReaderAgent
[thena]       ▸ chat
[thena]         ▸ tool read_file
[thena]         ◂ tool read_file  12ms ✓
[thena]       ◂ chat  1.84s ✓
[thena]     ◂ agent ReaderAgent  1.85s ✓
```

`report: true` gives the same in HTML, with each step's content. `thenaFlow()`
gives it as a live graph in the browser.

::: warning A run with no observer records nothing
No report, no log, no plugin and no `observe: true` means no execution tree, no
events and no streaming request to the provider. That is the zero-cost path and
it is worth about 2× in CPU time — but it is also why `onEvent` can look broken.
See [Streaming](/en/fundamentals/streaming).
:::

## Related

- [What's automatic](/en/fundamentals/whats-automatic) — the exact list
- [State and context](/en/fundamentals/state-and-context)
- [Hooks](/en/fundamentals/hooks)
