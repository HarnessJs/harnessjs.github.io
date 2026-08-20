# What's automatic

Every framework hides something. The problem is not hiding it — it is you not
knowing **what**, and finding out at the wrong moment.

This page is the complete list. If something happens without you asking, it is
here.

## Done for you

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
| masking known secrets in captured content | `redact` in the config |
| recording the execution tree | `report` and `log` in the config |

## The deliberately closed part

Three rows are in bold. They are the core of the framework and have **no
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

::: tip Why this is good
Swapping `qwen2.5-coder` for `gpt-4o-mini` should not require changing your code.
Because that layer belongs to the framework, it does not.
:::

If you genuinely need to intervene there, the right extension point is
writing a provider — the answer to "my backend
speaks differently".

## What is *not* automatic

Equally important: the framework does **not** decide for you.

- **When to stop.** A loop's `until` is yours. There is no hidden "I think we're
  done" heuristic — see Loops.
- **When to search memory.** Nothing is injected into the prompt on its own. If
  you want vector context, you call `recall` where it makes sense.
- **How much to spend.** Without a `budget`, nothing is measured or limited.
- **How to format recalled context.** You build the string.
- **When a tool failure should be fatal.** Everything is recoverable unless you
  throw `FatalToolError`.

The rule we follow: **the framework provides the mechanism, you choose the
policy.**

## What changes behaviour by default

One honest exception to the rule above. **Retry is on**: a `429` or a momentary
`503` is retried up to 3 times, with growing backoff.

That was deliberate — a transient network failure taking down a whole run is
almost never wanted. To turn it off:

```ts
super({ host, model, retry: false });
```

Timeout, by contrast, has **no default**: an arbitrary ceiling would abort a slow
local model that works today. Turn it on when you want to
([Providers](/en/fundamentals/providers)).

The second is **redaction**, also on: known secret patterns are masked in
everything captured, before it reaches the report, the log or a plugin. A file on
disk with no retention policy is the worst place for a secret to surface by
accident. See [Redaction](/en/advanced/redaction).

## What is *conditionally* automatic

Observation. A run builds its execution tree, emits events and asks the provider
to stream **only when someone is watching** — `report`, `log`, a plugin with
`onEvent`, or an explicit `observe: true`.

With none of those, the run takes the zero-cost path: no tree, no events, no
streaming. It is worth roughly 2× in CPU time per run, and it is the reason
`onEvent` can appear to do nothing.

## Where you can get in

From lightest to most invasive:

| Precision | Tool |
| --- | --- |
| adjust the final prompt | `beforePrompt` hook |
| inspect or block a tool | `beforeTool` hook (a `throw` cancels) |
| transform a tool's result | `afterTool` hook |
| transform the agent's response | `afterResponse` hook |
| handle an error without dying | `onError` hook |
| receive the context or state in a tool | `@context()`, `@state()` on parameters |
| choose which vector memory | `@memory(Store)` in the constructor |
| touch the history and context | `ctx.state`, public |
| control the loop | a `loop`'s `until` |
| wrap every tool run or model call | `app.use({ tool, chat })` |
| talk to another backend | write a provider |
| take over the whole turn | a `run(input, ctx)` method on the agent class |

That last one is the total escape hatch: if the agent class defines `run`, it owns
the step and **no hook fires**.

## Related

- [The run](/en/fundamentals/the-run) — the exact order all of this happens in
- [Hooks](/en/fundamentals/hooks)
- [Middleware and plugins](/en/fundamentals/middleware)
