# FAQ

## What runs without me writing it?

Every framework hides something. The problem is not hiding it — it is not knowing
**what**, and finding out at the wrong moment. This is the list.

| Happens on its own | Where you get in |
| --- | --- |
| assembling the messages (`system`, `user`, `assistant`, `tool`) | the `beforePrompt` hook changes the system prompt |
| calling the model with the declared tools | `sampling` on the provider or on `@Agent` |
| **detecting that the model asked for a tool** | *(closed — see below)* |
| **validating the arguments against the Zod schema** | you write the schema |
| **running the tool and feeding the result back** | the `beforeTool` / `afterTool` hooks |
| appending each turn to the history | `ctx.state` is public and editable |
| repeating while a loop's `until` is not true | you write the `until` |
| creating the workflow state, one per run | you declare the class in `@Workflow({ state })` |
| retrying a transient network failure | `retry` on the provider |
| recording the execution tree | `report` and `log` in the config |

## Why can't I customise tool-call detection?

Three rows above are in bold. They are the core of the framework and have **no
customisation hook**, on purpose.

When the model answers, something has to decide: is this a final answer, or a
request for a tool? Hand-rolled, that code becomes a pile of conditionals that
changes with every model:

```ts
// what you do NOT write
if (response.tool_calls?.length) { … }
else if (response.content?.startsWith("{")) { …try to parse… }
else if (response.content?.includes("<tool_call>")) { …another format… }
```

That is where the nastiest agent bugs live: a small model emits the call as text
instead of using the structured field, and the agent finishes thinking it
answered. The framework handles it — including rescuing calls written as text, in
several formats — and you never see it.

Swapping `qwen2.5-coder` for `gpt-4o-mini` should not require changing your code.
Because that layer belongs to the framework, it does not.

If you genuinely need to intervene there, the right extension point is writing
your own provider.

## What does the framework *not* decide for me?

- **When to stop.** A loop's `until` is yours. There is no hidden "I think we're
  done" heuristic.
- **When to search memory.** Nothing is injected into the prompt on its own. If
  you want vector context, you call `recall` where it makes sense.
- **How much to spend.** Without a `budget`, nothing is measured or limited.
- **How to format recalled context.** You build the string.

The rule: **the framework provides the mechanism, you choose the policy.**

The one honest exception is **retry, which is on by default** — a `429` or a
momentary `503` is retried up to 3 times with growing backoff, because a
transient network failure taking down a whole run is almost never what anyone
wants. Turn it off with `retry: false` on the provider.

Timeout, by contrast, has **no default**: an arbitrary ceiling would abort a slow
local model that works fine today.

## What happens when a tool fails?

It becomes an observation, not an exception. The error text goes back to the
model as the tool's result, and it gets another turn to fix it.

That covers the recoverable cases — a wrong path, a 404, a timeout. For failures
the model cannot fix (a bug in your code, an expired credential, a database that
is down), throw `FatalToolError`: it crosses the agent and ends the run, and the
original message never reaches the model's context or the report on disk.

```ts
import { FatalToolError } from "@thenajs/core";

throw new FatalToolError("database unavailable", { cause: err });
```

## Do I have to use a workflow for a single agent?

Yes, and it is one line:

```ts
@Workflow({ steps: [MyAgent] })
export class MyWorkflow {}
```

The run — its context, budget, cancellation and recorder — belongs to the
workflow, not to the agent. Making the single-agent case skip it would mean two
different execution models.

## Is `Thena.create` async?

No. Building the app waits for nothing. What you wait for is `app.run`.

`bootstrapWorkflow` is the older, `async` form and is **deprecated**; it still
works so 0.6 code does not break.

## Can I run several agents concurrently in one process?

Yes. Each `app.run(...)` opens its own run context — its own state, budget,
cancellation and recorder. Two concurrent requests never see each other's data.

## Which models work?

Anything Ollama or OpenAI serve, plus anything you write a provider for. In
practice, tool calling is what separates them: a model that cannot emit a
structured tool call will lean on the framework's text rescue, which works but is
a sign you are at the edge of what the model can do. Check `toolCallSource` on
the `chat` nodes in the report — `"rescued"` means exactly that.

## Why do I get a different answer every run?

Expected without `sampling`. To iterate on agent behaviour, pin it:

```ts
sampling: { temperature: 0, seed: 42 }
```

`seed` only has an effect alongside a low temperature. Without this you cannot
tell "my change helped" from "I got lucky".

## Does ThenaJS read environment variables?

No. There is no `THENA_*` to learn. Credentials go where you put them —
`process.env.OPENAI_API_KEY` in your own provider class. The framework never
reaches for a global, so two providers in one process can use two different keys.

## Where do I report a bug?

[github.com/thenajs/ThenaJS/issues](https://github.com/thenajs/ThenaJS/issues),
with the `report/<runId>/report.json` from the run — it has the full tree and is what
helps most. See [Support](/en/help/support).
