# Migration

## From 0.11 to 0.12

### `run({ input: { message } })` is now `run({ prompt })`

```ts
- await app.run({ input: { message: "Review src/" } });
+ await app.run({ prompt: "Review src/" });
```

The wrapper never earned its place. `input` was declared as an open bag, but
nothing in the framework ever handed that object to your code — `@input()` is a
different thing, the schema-validated arguments of a **tool**. The only consumer
reduced it to a string before the run started. What was left was one level of
nesting and a name suggesting the input/output pair of IO, on a method that by
definition only takes input.

Mechanical to migrate: drop the wrapper. It applies to nested runs through
`WorkflowRuntime` too.

### An `input` without `message` is no longer serialised

Passing `{ input: { userId: 7 } }` used to JSON-serialise the whole object and
make that the prompt. It was the only reason the type was open, and it turned a
misspelled field into a silent success rather than an error.

```ts
- await app.run({ input: { userId: 7, action: "review" } });
+ await app.run({ prompt: JSON.stringify({ userId: 7, action: "review" }) });
```

Usually the better move is not to serialise at all. Structured payloads have two
doors, and which one you want is decided by what the model may see:
[`data`](/en/get-started/configuration#state-memory-vs-data) for what it must
**not** read, `state.memory` for what it must.

### `WorkflowInput` is gone from the package

The type is no longer exported. `WorkflowRunOptions` still is, with `prompt` in
place of `input`.

### Two things are now called `prompt`

`@Agent({ prompt })` is the agent's markdown system prompt, fixed per class.
`run({ prompt })` is the user's turn, one per run. The docs always say which —
see the [glossary](/en/help/glossary).

## From 0.10 to 0.11

### `@thenajs/tools` is back, without the shell tool

The package was removed in `0.10` because it existed to ship a shell tool, and
handing arbitrary command execution to a model is the application's decision, not
the framework's. **That has not changed — there is no shell tool.**

What it ships now is [`ParallelTool`](/en/techniques/batched-tool-calls), which
depends on framework internals a copied snippet cannot reach.

```bash
npm install @thenajs/tools
```

Nothing to migrate: if you were not using the package, ignore it.

### `@tools()` is new

A tool can now reach the other tools of the same agent — see
[Injection](/en/reference/injection). Additive; nothing you wrote changes.

### Packages now carry their `LICENSE`

Every manifest declared MIT, but no license file shipped in the tarballs. `0.11`
fixes that. Nothing to do — it only matters if a license scanner flagged the
package.


ThenaJS is at **0.12.x**. In `0.x`, a caret range does not move the minor version —
`^0.11.0` in your `package.json` will not pull 0.12 on its own. These notes matter
when you install fresh, or bump on purpose.

## From 0.6 to 0.9

Five breaking changes.

### `app.run()` rejects instead of swallowing the error

Before, a failing run went quiet. Now the rejection reaches you.

```ts
// handle it
try {
  await app.run({ prompt });
} catch (err) {
  // the error is yours now
}
```

This is the one most likely to change behaviour you did not know you had.

### `app.run()` returns a `RunHandle`, not a `Promise`

`await` keeps working exactly as before. What broke is treating the return value
as a real `Promise` beyond `then`/`catch`/`finally`:

```ts
await app.run({ prompt }); // fine
app.run({ prompt }).catch(handle); // fine
Promise.all([app.run({ prompt })]); // use .result
```

The handle exists because a `Promise` cannot express three real needs: cancelling,
observing while it happens, and holding the run to find it again later.

```ts
const exec = app.run({ prompt });
exec.runId; // available synchronously
exec.abort(); // cancel
exec.result; // a plain Promise, if you need one
```

### The report goes to `<dir>/<runId>/`, not `<dir>/`

Adjust any script or CI job that read a fixed path. `report/index.html` still
exists and now lists every run; the individual run is at
`report/<runId>/index.html`.

### The budget applies **inside** nested runs

A sub-workflow started by a tool now counts against its parent's budget. Without
this, inheriting was a way to escape: a `maxCostUsd` of $1 at the top could be
walked around by any tool that started a sub-workflow.

Pass an explicit `budget` to `runtime.run()` if you want that nested run to have a
ceiling of its own — it gets a chained tracker, and whichever limit blows first
wins.

### A run is only observed when someone observes it

`onEvent`, `onToken`, `eventStream` and `textStream` receive nothing unless the
run is being observed. A run with no observer does not build the execution tree,
emit events or ask the provider to stream — it is the zero-cost path, and it is
worth about 2× in CPU time per run.

Observation turns on by itself when `report`, `log`, or a plugin with `onEvent` is
present. If you use none of those:

```ts
const exec = app.run({ prompt, observe: true });
```

You will get a one-time console warning if you subscribe to a run that is not
being observed, rather than silence.

## Still supported, as aliases

| Old | New | Status |
| --- | --- | --- |
| `bootstrapWorkflow(W, config)` | `Thena.create(W, config)` | deprecated, works |
| `AgentContext` | `Context` | alias, same type |

`Thena.create` is **not async**, which is the point of the change:

```ts
const app = Thena.create(MyWorkflow, config); // no await
```

## Other 0.9 changes worth knowing

- **`thena create` now generates a CommonJS project**, matching the `nest new`
  default. Only affects newly created projects.
- **All packages require Node ≥ 20.19** — the version where `require()` of an ESM
  module from CommonJS landed.

## Language of identifiers

0.9 renamed every internal identifier to English. Thirty-four of them had leaked
into published `.d.ts` files, which made them contract. If you were reaching into
internals — you should not have been, but it happens — that is where the breakage
is. The public API named in these docs is unaffected.

## Full changelog

Every version, with detail, in
[CHANGELOG.md](https://github.com/thenajs/ThenaJS/blob/main/CHANGELOG.md).
