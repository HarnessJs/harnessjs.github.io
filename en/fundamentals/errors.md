# Errors

The single most important thing to know: **a tool failure is an observation, not
an exception.**

The model asked for `READMEE.md`. Your tool threw `ENOENT`. In ThenaJS that does
not end the run — the error goes back to the model as the tool's result, and it
gets another turn:

```
[thena]   ▸ tool read_file
[thena]   ◂ tool read_file  2ms ✗   ENOENT: no such file or directory, 'READMEE.md'
[thena]   ▸ chat
[thena]     ▸ tool read_file
[thena]     ◂ tool read_file  3ms ✓

It is a TypeScript framework for building LLM agents.
```

It misspelled the name, was told, and fixed it. That single decision is what makes
an investigate-act-look-again loop work at all.

## The four ways a tool fails

They all end the same way: the model reads what went wrong.

| How | What the model sees |
| --- | --- |
| `execute` throws | the error message |
| `execute` returns `{ content, isError: true }` | your text |
| the model calls a tool that does not exist | a note saying so |
| the model sends arguments outside the schema | the Zod error |

Nothing to configure. The `tool` node in the report is marked `status: "error"`,
the `afterTool` hook receives `isError`, and `ctx.turn.toolError` is `true` — so
"how often do tools fail" is a count of nodes, not a regex over text.

## Write the message the model reads

Returning `isError` beats throwing, because you choose the words:

```ts
async execute({ path }: { path: string }) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return { content: `No file at "${path}". Check the path.`, isError: true };
  }
}
```

The difference is not cosmetic. `ENOENT: no such file or directory, open
'READMEE.md'` describes a syscall. `No file at "READMEE.md". Check the path.`
tells the model what to do next.

## Failures the model cannot fix

A bug in your code, an expired credential, a database that is down — none of those
improve on retry. The model cannot fix them, every attempt costs a call, and the
original message may carry things that should reach neither the model's context
nor your report on disk: a connection string, an internal hostname.

Throw `FatalToolError`. It crosses the agent and ends the run:

```ts
import { FatalToolError } from "@thenajs/core";

async execute({ query }: { query: string }) {
  try {
    return await db.query(query);
  } catch (err) {
    // The model cannot fix a database being down — and the original message
    // does not reach its context.
    throw new FatalToolError("database unavailable", { cause: err });
  }
}
```

The `cause` is preserved for your own logs. What the run reports is the message
you wrote.

::: tip Choosing between them
Ask: *could a different next action succeed?* A wrong path, a 404, a malformed
query — yes, make it an observation. A missing credential, a null-pointer bug, a
dead dependency — no, make it fatal.
:::

## Errors elsewhere

Tool errors are the special case. Everything else propagates normally.

| Where | What happens |
| --- | --- |
| a hook throws | the `onError` hook runs; if it returns nothing, the run fails |
| a middleware throws | the run fails |
| the provider throws | retried if transient, otherwise the run fails |
| the budget is exceeded | `mode: "stop"` ends gracefully; `"throw"` raises `BudgetExceededError` |
| `ctx.abort(reason)` | the run rejects with your reason |
| `ctx.stop()` | the run resolves with the output so far |

## `onError`

The agent's last chance to turn a crash into a degraded answer. Returning a value
makes it the agent's output:

```ts
async onError(error: Error, ctx: Context) {
  ctx.meta({ failed: error.name });   // visible in the report
  return "I could not complete that step.";
}
```

Returning nothing lets the error keep propagating.

## `app.run()` rejects

Since 0.9, a failing run reaches you:

```ts
try {
  await app.run({ input });
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.warn(`hit ${err.info.reason}: ${err.info.value} of ${err.info.limit}`);
  }
}
```

Before, the failure went quiet. The framework does not print, does not swallow
and does not mark the process behind your back — printing is your application's
job.

## Cleaning up

`ctx.onDispose(fn)` registers a cleanup for the end of the run — success, error
or abort. They run in reverse registration order, like `defer`:

```ts
const conn = await pool.acquire();
ctx.onDispose(() => conn.release());
```

This is the right place for anything a failed run would otherwise leak.

## Common mistakes

**Throwing in `beforeTool` to deny recoverably.** That ends the run. Use a
[tool middleware](/en/fundamentals/middleware) returning `isError` if the model
should get another try.

**Letting a driver's error message become the observation.** It is verbose, it is
written for a human, and it may carry internal detail. Catch it and write your
own.

**Assuming a tool error killed the run.** It almost certainly did not — check for
a `FatalToolError`, or an error thrown outside a tool.

## Related

- [Tools](/en/fundamentals/tools)
- [Troubleshooting](/en/help/troubleshooting)
