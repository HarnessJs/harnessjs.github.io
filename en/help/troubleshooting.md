# Troubleshooting

Real symptoms and what usually causes them. If yours is not here, turning on
`report: true` and opening `report/index.html` almost always shows where the run
left the rails. That page lists every run; each one also writes its own
`report/<runId>/index.html` and `report/<runId>/report.json`.

## The agent answers in text instead of using the tool

Symptom: you asked for something that needs the tool, and it described what it
would do.

**Most common cause: the `description` does not say when to use it.** It is
prompt, and the model reads it literally.

```ts
description: "File operations."                    // vague
description: "Reads a project file. Use before answering about code."
```

**Second cause: the prompt does not tell it to act.** Say so explicitly in the
markdown: *"Before answering, read the relevant files."*

**Third: the model is too small for the task.** Open the report and look at
`toolCallSource` on the `chat` nodes. If it says `rescued`, the model is emitting
the call as text and the framework is recovering it — that works, but it means
you are at the edge of what the model can do.

## The loop ends on the first turn

Symptom: the agent calls a tool and the run finishes without it interpreting the
result.

Almost always `untilAnswered` with a model that returned an **empty response** —
which counts as "answered". Be stricter:

```ts
import { turnOf } from "@thenajs/core";

until: (ctx) => {
  const t = turnOf(ctx);
  return !!t && !t.calledTool && !!t.response?.trim();
};
```

The other case is the model writing the call in prose, with no JSON at all — the
rescue cannot recover that, because there is no call there. See the item above.

## The loop never ends

Symptom: it hits `maxIterations` every time.

Confirm that is what is happening, rather than assuming:

```ts
loop({
  steps: [MyAgent],
  until: myCondition,
  maxIterations: 8,
  onExhausted: (ctx, n) => console.warn(`hit the ceiling after ${n}`),
});
```

If it fires, `until` never became true. The usual reasons: the field `until` reads
is never written (a typo, or the hook that writes it does not run), or the
condition is inverted — remember that **`true` means stop**.

## The second agent answers with nothing

Symptom: `steps: [PlannerAgent, ExecutorAgent]`, and the executor returns nothing
or finishes immediately.

The first agent's output entered the history as the **assistant's** turn. The
second one reads the same history and concludes it already answered.

If the first one's output is *context* and not *speech*, promote it:

```ts
export class PlannerAgent {
  afterResponse(plan: string, ctx: AgentContext) {
    ctx.state.set("history", ctx.state.history.slice(0, -1));
    ctx.state.append("memory", `Plan to follow:\n${plan}`);
  }
}
```

## `recall` comes back empty

Check in this order:

1. **Did you write to the same dataset you are searching?** `remember` with no
   `dataset` writes to `"default"`; `recall` with `{ dataset: "persistent" }` will
   not find it. To search all of them: `{ dataset: null }`.
2. **Is `scoreThreshold` too high?** Start without it and look at the real scores.
3. **Does the collection exist?** It is created on the first write, not on a read.

## Dimension error in the vector store

```
This store was prepared with 768 dimensions, but received embeddings of 1536.
```

Two agents with different embedding models pointing at the same store. One
collection holds one size — each model needs its own:

```ts
stores: [QdrantNomic, QdrantOpenAI];
```

The 1536 agent takes the second constructor parameter. Injection from
`ThenaConfig.stores` is **positional**, so reordering that array silently changes
which store each agent gets. Use `@memory(QdrantOpenAI)` to name it instead of
depending on the order.

## The run dies with `fetch failed`

If it took around 300 seconds before failing, that was the runtime's limit — the
request hung and the retry never fired, because nothing rejected.

Turn on the per-attempt timeout:

```ts
super({ host, model, retry: { maxAttempts: 3, timeoutMs: 120_000 } });
```

Pick a value above what your model takes in the worst case: too short a ceiling
aborts legitimate work.

## A tool error took down the whole run

That is not the default — a tool error normally becomes an observation the model
reads and recovers from. A run that actually dies means one of:

- your `execute` threw `FatalToolError`, which is designed to end the run;
- the error escaped somewhere that is not a tool — a hook, a middleware or the
  provider.

To pick the message the model reads instead of throwing, return an error result:

```ts
return { content: `No file at "${path}". Check the path.`, isError: true };
```

## The prompt was not found

```
[@Agent] Prompt markdown not found: /path/…
```

The relative path resolves from the **agent's file**. Moving the `.ts` without
moving the `.md` breaks it. In a compiled build, confirm the `.md` files are
copied into `dist/` — the CLI's project template already does this.

## A tool is not recognised

```
[thena] The class "MyTool" is not decorated with @Tool().
[thena] The class "MyTool" does not implement execute(input).
```

The first is a missing decorator; the second is the method named wrong (`run`
instead of `execute`, for example).

## Nothing compiles, and the errors mention decorators

`experimentalDecorators` is off. ThenaJS uses TypeScript's legacy decorators
because it needs **parameter** decorators, which the Stage 3 proposal does not
have.

```json
{ "compilerOptions": { "experimentalDecorators": true } }
```

## `onEvent` / `textStream` never fire

You will have seen this warning:

```
[thena] onEvent() will receive nothing: this run is not being observed.
```

A run without an observer does not build the execution tree, does not emit events
and does not ask the provider to stream — it is the zero-cost path, and it is
about twice as fast per run. Turn observation on explicitly:

```ts
const exec = app.run({ input, observe: true });
```

Or turn on `report`, `log`, or a plugin with `onEvent`, any of which enables it
implicitly.

## Different results on every run

Expected without `sampling`. Pin it while you iterate:

```ts
sampling: { temperature: 0, seed: 42 };
```

## Still stuck

Open an issue on [GitHub](https://github.com/thenajs/ThenaJS/issues) with the
run's `report/<runId>/report.json` — it has the complete tree and is what helps
most. See
[Support](/en/help/support).
