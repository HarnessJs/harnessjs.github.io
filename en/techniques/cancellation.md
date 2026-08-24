# Cancellation

Three ways to end a run early, and they are not interchangeable.

| | Ends how | Reaches inside tools |
| --- | --- | --- |
| `signal` / `abort()` | rejects | yes, via `ctx.signal` |
| `ctx.stop()` | resolves with the output so far | no — the turn finishes |
| `budget` | `"stop"` or `"throw"` | no |

## From outside: `signal`

```ts
app.run({ prompt, signal: req.signal });                 // client disconnected
app.run({ prompt, signal: AbortSignal.timeout(30_000) }); // hard deadline
```

Combines with the handle's `abort()` — whichever fires first wins.

## From the handle: `abort()`

```ts
const exec = app.run({ prompt });
exec.abort(new Error("user cancelled"));
```

The reason arrives whole at the caller's `catch`, so use your own error type when
you want to tell causes apart:

```ts
class UserCancelled extends Error {}

try {
  await exec;
} catch (err) {
  if (err instanceof UserCancelled) return res.status(499).end();
  throw err;
}
```

## From inside: `ctx.abort()`

Available in tools and hooks:

```ts
async execute(@input() args, @context() ctx: Context) {
  if (await isForbidden(args)) ctx.abort(new Error("forbidden target"));
}
```

## Cancellation only reaches as far as you pass it

This is the part people miss. `abort()` interrupts the framework's own work, but
a tool blocked on a `fetch` keeps going unless you hand it the signal:

```ts
async execute(@input() { url }: { url: string }, @context() ctx: Context) {
  const res = await fetch(url, { signal: ctx.signal });   // ← the whole point
  return res.text();
}
```

Everything that takes time should receive `ctx.signal`: `fetch`, a database
driver, `readFile`, a child process. Without it, `abort()` takes effect only
*between* steps.

The provider already does this — an abort reaches the model call's `fetch`, not
just the next step.

## Cleaning up

`ctx.onDispose(fn)` runs at the end of the run — success, error **or** abort — in
reverse registration order, like `defer`:

```ts
const conn = await pool.acquire();
ctx.onDispose(() => conn.release());
```

This is the only reliable place for cleanup, because an aborted run does not
reach the rest of your function.

## `stop()` — the graceful one

```ts
async execute(@input() args, @context() ctx: Context) {
  const cached = await lookup(args);
  if (cached) {
    ctx.stop();          // we already have a good answer
    return cached;
  }
}
```

`stop()` skips the remaining steps and lets the run **resolve** with the output it
already had. Nothing throws, and the caller cannot tell it from a normal finish —
which is the intent.

It is the same behaviour as a budget in `"stop"` mode.

| | `abort(reason)` | `stop()` |
| --- | --- | --- |
| The run | rejects | resolves |
| The in-flight turn | interrupted | finishes |
| Later steps | interrupted | skipped |
| Use for | a failure, a cancellation | "we are done early" |

## Shutting the app down

```ts
await app.dispose();
```

Aborts in-flight runs, waits for them to let go, and shuts down plugins. In a
script you can skip it; in a server, wire it to your shutdown signal:

```ts
process.on("SIGTERM", async () => {
  await app.dispose();
  process.exit(0);
});
```

## In an HTTP server

The two together are what makes a run behave under a real client:

```ts
app.post("/runs", async (req, res) => {
  const exec = agent.run({
    prompt: req.body.message,
    signal: req.signal, // the client hung up
    budget: { maxDurationMs: 120_000 }, // it is taking too long
  });

  try {
    res.json({ answer: await exec });
  } catch (err) {
    if (exec.signal.aborted) return; // the client is gone; nobody to answer
    res.status(500).json({ error: String(err) });
  }
});
```

## Common mistakes

**Not passing `ctx.signal` to a slow tool.** The most common reason "abort does
not work".

**Using `abort()` for "we are finished".** It rejects. You want `stop()`.

**Cleaning up after `await run()` instead of in `onDispose`.** An aborted run
never reaches that line.

**Forgetting `app.dispose()` in a server.** Plugins keep the process alive —
`thenaFlow()` holds a server open.

## Related

- [Streaming](/en/fundamentals/streaming) — `RunHandle`
- [Budgets](/en/techniques/budgets)
- [Context](/en/reference/context) — `signal`, `abort`, `stop`, `onDispose`
