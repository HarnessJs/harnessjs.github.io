# Execution model

What happens between `app.run()` and the result, one layer below
[The run](/en/fundamentals/the-run).

## Two phases

**Compile**, once, at `Thena.create`. The workflow's metadata is read, steps are
resolved into executable units, tool schemas are converted to the provider's
format and memoised. `Thena.create` is synchronous because none of this does
I/O.

**Execute**, per `app.run()`. A `RunContext` is opened, the state class is
instantiated, and the compiled steps run against it.

The split is why the workflow shape cannot change per run, and why two apps are
cheap to build.

## `RunContext`

The unit of isolation. Every run gets exactly one, holding the run id, the data
channel, the abort controller, the budget tracker, the recorder and the cleanup
list.

It is propagated through `AsyncLocalStorage`, not passed as an argument. That is
what makes `context()` work as a bare function inside a provider factory, and
what keeps concurrent runs from seeing each other without threading a parameter
through every layer.

```ts
provider: () => new OpenAIProvider({ apiKey: keyFor(context().data) });
```

The consequence worth knowing: a callback that escapes the async context — a bare
`setTimeout`, a listener registered elsewhere — loses it. `context()` there
throws rather than returning the wrong run's data.

## The step pipeline

An agent step is a small pipeline of middleware, in onion order:

```
plugin middleware → hooks → recording → [the model call]
```

Both `tool` and `chat` chains are built the same way, with `compose()`. The
framework's own concerns — recording, hook dispatch, budget counting — are
layers in that chain rather than special cases, which is why a plugin can wrap
them without a hook of its own.

Calling `next()` twice rejects rather than double-billing you.

## The turn

One agent step is one turn:

1. build the messages from `ctx.state` (`system` from the prompt plus `memory`
   and `tasks`, then `history`)
2. `beforePrompt`
3. call the provider with the tool schemas
4. decide: final answer, or tool call?
5. if a tool: validate against the Zod schema, `beforeTool`, `execute`,
   `afterTool`, append the result as a `tool` message
6. `afterResponse`
7. write `ctx.turn` and `ctx.output`

Step 4 is the closed part. It handles native tool-call fields and rescues calls
the model wrote as text, in several formats. `toolCallSource` on the `chat` node
records which path was taken.

A `loop` repeats the whole of that; a `parallel` runs several of them at once,
each in its own step context, over one frozen read of the history.

## Observation is conditional

Before the first step, the runtime asks: is anyone watching? `report`, `log`, a
plugin with `onEvent`, or `observe: true`.

If not, the recorder is never built, no events are published, and the provider is
not asked to stream. The instrumentation calls become no-ops rather than
branches at every call site.

That is worth about **2× in CPU time per run**, and it is why `onEvent` on an
unobserved run warns instead of silently yielding nothing.

## Budget accounting

Counters live on the `RunContext`, and the check happens **between** units of
work — after a model call resolves, not during it. A call only counts once it has
answered, because before that there is no usage to add.

Hence the documented imprecision: a run can overshoot by one model call, plus one
per level of nesting.

A nested run gets a **chained** tracker: it counts into its own limits and into
its parent's, and whichever blows first stops it. Without chaining, starting a
sub-workflow would be a way around any ceiling.

## Cancellation

The run's `AbortSignal` is the combination of yours (`run({ signal })`) and the
handle's `abort()`. It is exposed as `ctx.signal` and passed to the provider's
`fetch`.

Aborting rejects the run and then runs the cleanups. `stop()` sets a flag the
step loop checks between steps, so the run resolves normally with the output it
already had — no exception involved.

`onDispose` callbacks run in reverse registration order, on every ending: success,
error, abort.

## Where extension points actually live

| You want to | Layer |
| --- | --- |
| change one agent's behaviour | hooks |
| wrap every tool or model call | plugin `tool` / `chat` middleware |
| replace the whole step | `run(input, ctx)` on the agent class |
| speak to a different backend | a `Providers` subclass |
| observe without participating | plugin `onEvent` |

There is deliberately no hook between "the provider answered" and "we decided it
was a tool call". That is the layer whose stability lets you swap models without
touching your code.

## Related

- [The run](/en/fundamentals/the-run)
- [What's automatic](/en/fundamentals/whats-automatic)
- [Writing plugins](/en/advanced/writing-plugins)
