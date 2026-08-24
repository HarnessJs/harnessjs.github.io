# Streaming

`app.run()` returns a `RunHandle`, not a `Promise`. The rule: **with `await` you
ask for the result; without it, you ask for the run.**

```ts
const text = await app.run({ prompt }); // the result
const exec = app.run({ prompt }); // the run
```

It is *thenable*, so both work without `run` splitting into two methods.

## Why a handle

A `Promise` cannot express three real needs: cancelling, watching what is
happening, and **holding** the run to find it again later — the pattern of
answering a POST with a `runId` and following by SSE.

```ts
const exec = app.run({ prompt, observe: true });

exec.runId; // available synchronously, before the first turn
exec.result; // a plain Promise — composes with Promise.all
exec.signal; // yours, combined with this handle's abort()
exec.abort(reason); // cancel
```

## Two streams

Tokens and steps are separate channels, on purpose: a token is not a step of the
run — it has no start, no end and no status.

```ts
// text, as the model writes it
for await (const token of exec.textStream) process.stdout.write(token);

// steps, as they happen
for await (const event of exec.eventStream) console.log(event.kind);
```

Or with callbacks, each returning its own unsubscribe:

```ts
const off = exec.onToken((t) => process.stdout.write(t));
exec.onEvent((e) => metrics.record(e));
```

### Late subscribers get the backlog

Whoever subscribes after the run started **receives what already happened**
before the new items. Without that, an SSE connecting three seconds after the
POST would see the run starting from the middle — and a `for await` over text
would begin mid-sentence.

The event buffer is capped at 500 events. With `report` on, each event carries
prompt and response, and the POST+SSE pattern keeps several handles alive at once
— the cap trades the start of a very long run for a predictable memory ceiling.

::: warning Streaming only happens if the provider supports it
A provider that ignores `onToken` still works; the text simply arrives whole in
`result`.
:::

## Observation is opt-in

This is the part that surprises people:

```
[thena] onEvent() will receive nothing: this run is not being observed.
Use `run({ observe: true })`, or turn on `report`, `log` or a plugin with `onEvent`.
```

A run with no observer does not build the execution tree, does not emit events
and does not ask the provider to stream. That is the zero-cost path and it is
worth about **2× in CPU time per run**.

Observation turns on by itself when there is a `report`, a `log`, or a plugin
with `onEvent`. When the only consumer is the handle, say so:

```ts
const exec = app.run({ prompt, observe: true });
```

You get the warning once, rather than a `for await` that never yields.

## The POST + SSE pattern

The reason the handle exists:

```ts
app.post("/runs", (req, res) => {
  const exec = agent.run({
    prompt: req.body.message,
    observe: true,
    signal: req.signal,
  });
  res.json({ runId: exec.runId }); // answered before the first turn
  runs.set(exec.runId, exec);
});

app.get("/runs/:id/stream", async (req, res) => {
  const exec = runs.get(req.params.id);
  res.setHeader("Content-Type", "text/event-stream");
  for await (const event of exec.eventStream) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
});
```

`runId` is synchronous, so the POST answers immediately. The client connects
whenever it likes and still sees the whole run, because of the replay above.

`eventStream` as an `AsyncIterable` gives backpressure on a slow socket, which
the callback form does not.

## Errors do not go unhandled

A handle whose run fails does not crash the process with an
`unhandledRejection`, even when nobody has `await`ed yet — which is exactly the
POST+SSE situation. The error stays available on `.result`; it simply stops being
"unhandled".
