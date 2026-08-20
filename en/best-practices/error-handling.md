# Error handling

The framework's position: **a tool failure is an observation, everything else is
an exception.** Most good practice here is deciding, per failure, which of the
two it is.

## The question to ask

*Could a different next action succeed?*

| Failure | Answer | Do |
| --- | --- | --- |
| wrong path, 404, malformed query | yes | return `{ content, isError: true }` |
| bad credential, dead database, a bug | no | `throw new FatalToolError(…)` |
| the model asked for a tool that does not exist | yes | nothing — handled |
| a hook or middleware failed | no | let it propagate |

Getting this wrong is expensive in one direction and confusing in the other: a
fatal failure treated as recoverable burns turns retrying something that cannot
work, and a recoverable failure treated as fatal kills a run the model would have
fixed on its own.

## Write the observation, do not leak the exception

```ts
// ✗ the model reads a syscall
async execute({ path }: { path: string }) {
  return readFile(path, "utf8");
}

// ✓ the model reads an instruction
async execute({ path }: { path: string }) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return { content: `No file at "${path}". Check the path.`, isError: true };
  }
}
```

A driver's error message is written for a human, is verbose enough to crowd the
context, and may carry a connection string or an internal hostname — which then
goes to the model **and** into the report on disk.

## `FatalToolError` keeps the original message out

```ts
try {
  return await db.query(sql);
} catch (err) {
  throw new FatalToolError("database unavailable", { cause: err });
}
```

The run ends with your message. The `cause` is preserved for your own logs, so
you lose nothing operationally while the model's context stays clean.

## Degrade instead of dying

`onError` turns a crash into a partial answer:

```ts
async onError(error: Error, ctx: Context) {
  ctx.meta({ failed: error.name });      // still visible in the report
  return "I could not complete that step.";
}
```

Good for one branch of a `parallel` that must not take down the others. Bad as a
blanket catch — an agent that swallows everything reports success while producing
nothing.

Note `ctx.meta()`: a handled error that leaves no trace is how a silent
degradation becomes a mystery.

## Deny recoverably, not fatally

A `throw` in `beforeTool` ends the run. When the model should be able to try
something else, use a tool middleware:

```ts
tool: async (inv, next) => {
  if (inv.name === "deploy" && !allowed(inv.run)) {
    return { content: "Deploy is not allowed in this run.", isError: true };
  }
  return next();
};
```

The difference is "this run is over" versus "try something else".

## Always clean up in `onDispose`

```ts
const conn = await pool.acquire();
ctx.onDispose(() => conn.release());
```

Code after `await app.run()` does not execute when the run is aborted.
`onDispose` runs on every ending — success, error, abort — in reverse order.

This is the only correct place for anything that must be released.

## Handle the rejection

Since 0.9, `app.run()` rejects rather than swallowing:

```ts
try {
  await app.run({ input, budget: { maxCostUsd: 1, mode: "throw" } });
} catch (err) {
  if (err instanceof BudgetExceededError) {
    metrics.increment(`budget.${err.info.reason}`);
    return partialResponse();
  }
  if (exec.signal.aborted) return; // client left; nobody to answer
  throw err;
}
```

Three distinct outcomes worth separating: a budget stop, a cancellation, and a
real failure. Treating all three as 500s is a monitoring problem.

## Stopping is not failing

`ctx.stop()` and `mode: "stop"` **resolve**. A run that hit its ceiling looks
identical to one that finished, which is intentional — and means you need
`onExceeded` if you want to know:

```ts
budget: {
  maxCostUsd: 0.5,
  onExceeded: (info) => logger.warn({ reason: info.reason }, "budget hit"),
}
```

Same for loops: `onExhausted` is what distinguishes "converged" from "ran out of
turns".

## Retry the network, not the reasoning

Two different mechanisms, easily confused:

| | Provider `retry` | The agent loop |
| --- | --- | --- |
| Repeats | the HTTP call | the model's reasoning |
| Because | the network failed | a tool returned an error |
| Costs | one attempt, same tokens | a whole extra turn |

A tool failure does **not** trigger the retry policy. And set `timeoutMs` — a
hung request never rejects, so retry never fires, which is the run that dies with
`fetch failed` after ~300 seconds.

## Common mistakes

**Catching everything in `onError` and returning a string.** The run "succeeds"
with a useless answer.

**Letting `err.message` become the observation.** Verbose, human-oriented, and
sometimes sensitive.

**Throwing to deny a tool.** Ends the run; usually you wanted `isError`.

**Cleaning up after `await run()`.** Never runs on abort.

**Assuming a tool error killed the run.** It almost certainly did not — look for
`FatalToolError`, or an error thrown outside a tool.

## Related

- [Errors](/en/fundamentals/errors)
- [Tool design](/en/techniques/tool-design)
- [Cancellation](/en/techniques/cancellation)
- [Budgets](/en/techniques/budgets)
