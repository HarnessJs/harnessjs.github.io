# Batching tool calls

The provider honours one tool call per turn. Reading three files costs three
round-trips to the model, and you pay for every one of them.

`ParallelTool` packs several calls into a single turn:

```bash
npm install @thenajs/tools
```

```ts
import { ParallelTool } from "@thenajs/tools";

@Agent({
  provider: GPT,
  tools: [ReadFileTool, ListDirTool, ParallelTool],
  prompt: "./explorer.agent.md",
})
export class ExplorerAgent {}
```

That is the whole setup. It takes no arguments — it dispatches the **other tools
of the same agent**, and it finds them through [`@tools()`](/en/reference/injection).

## What it saves

Round-trips, not CPU. Three reads become one model call instead of three. The
tools do run concurrently, because that is free once you are already in one turn,
but the concurrency is not where the money is.

```
without parallel        with parallel
─────────────────       ─────────────────
model → read a          model → parallel([a, b, c])
model → read b          model → answer
model → read c
model → answer          2 calls instead of 4
```

## It is opt-in, and that matters

Registering it is the whole switch. Leave it out and the agent behaves exactly as
before, one tool per turn.

That switch exists because **weaker models are worse at it**. Filling a nested
`calls` array is harder than emitting a plain tool call: the model has to pick
the tool by name and build its arguments without the per-tool schema in front of
it. A frontier model handles it comfortably; a small local one may not.

If your provider runs a model that struggles, do not register the tool. Nothing
else changes.

## What it does not cost you

This is why the tool lives in the framework instead of being a snippet you copy.

Every tool your agent registers is wrapped by the runtime in five layers: the
report node, the agent's `beforeTool`/`afterTool` hooks, the middlewares from
`app.use({ tool })` — where authorisation lives — budget accounting, and the
tool error policy.

`ParallelTool` receives the **wrapped** tools, so each inner call still goes
through all five. In the report you see this:

```
▸ tool parallel
  ▸ tool read_file
  ▸ tool read_file
  ◂ tool read_file  4ms ✓
  ◂ tool read_file  6ms ✓
◂ tool parallel  7ms ✓
```

Three nodes, not one. A hand-rolled version that dispatched raw tools would
return the same answer and lose all of it — including the guarantee in
[Security](/en/best-practices/security) that a tool middleware sees the real name
and the final arguments. It would see `parallel` and an opaque payload.

## Failure

A call that fails does not take the batch down. The others still run, and the
model reads what worked alongside what did not:

```
[1] read_file → ok
export const config = { … }

[2] read_file → error
argumentos inválidos — path: expected string, received number
```

The batch is only marked as an error when **every** call failed. A partly good
batch is not a lost turn, and marking it as one would make a loop's `maxFails`
count a failure that did not happen.

Arguments are validated against each tool's own schema before it runs, so a
malformed call comes back as an observation the model can correct — not as an
exception.

## When not to use it

**When the calls depend on each other.** If B needs A's result, they are two
turns. The tool cannot help, and the model asking for both at once produces
nonsense from the second one.

**When there is only one call.** The schema requires at least two — a batch of
one is a plain tool call with extra steps.

## Related

- [`@tools()`](/en/reference/injection) — how a tool reaches its siblings
- [Tool design](/en/techniques/tool-design)
- [Parallel execution](/en/techniques/parallel-execution) — the `parallel` block,
  which is a different thing: concurrent **agents**, not concurrent tools
