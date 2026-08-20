# Hooks

Most of the time the agent class is empty. Hooks are how you get into the middle
of a turn when declaring is not enough.

They are plain optional methods on the agent class. The runtime calls whichever
exist.

```ts
@Agent({ provider: LocalOllamaProvider, prompt: "./reviewer.agent.md" })
export class ReviewerAgent {
  async afterResponse(response: string, ctx: Context) {
    ctx.approved = response.includes("APPROVED");
  }
}
```

`implements AgentHooks` is available if you want the signatures checked, but is
not required.

## The five hooks

| Hook | When | Returning a value… |
| --- | --- | --- |
| `beforePrompt(prompt, ctx)` | before the model call | replaces the prompt |
| `beforeTool(call, ctx)` | before a tool runs | replaces the `ToolCall`; `throw` cancels |
| `afterTool(result, ctx)` | after a tool runs | replaces the output |
| `afterResponse(response, ctx)` | after the turn's answer | replaces the response |
| `onError(error, ctx)` | on any throw above | becomes the agent's output |

Where they sit in the turn is on [The run](/en/fundamentals/the-run#one-agent-turn-in-detail).

::: tip The contract
Returning a value **replaces**. Returning `undefined` **keeps** the original.
That is why a hook that only wants to observe can just not return anything.
:::

## `beforePrompt`

The place to add retrieved context, a timestamp, or anything the model should
know that is not in the markdown:

```ts
async beforePrompt(prompt: string, ctx: Context) {
  const hits = await this.vectors.recall(ctx.state.history.at(-1)?.content ?? "");
  if (!hits.length) return;                       // keep the original
  return `${prompt}\n\n## Related\n${hits.map((h) => h.text).join("\n")}`;
}
```

## `beforeTool`

Inspect, rewrite, or block. Returning a new `ToolCall` swaps the arguments:

```ts
async beforeTool(call: ToolCall, ctx: Context) {
  if (call.name === "deploy" && !ctx.data.canDeploy) {
    throw new Error("this run may not deploy");   // cancels the run
  }
  return { ...call, args: { ...(call.args as object), dryRun: true } };
}
```

A `throw` here ends the run. To deny in a way the model can **recover** from —
read the refusal and try something else — use a
[tool middleware](/en/fundamentals/middleware) returning
`{ content, isError: true }` instead.

::: warning Do not use `beforeTool` for authorisation
This hook runs **above** your middleware in the chain, so a later `beforeTool`
can still rewrite the arguments after your check has passed. Security decisions
belong in a tool middleware, which sees the arguments that will really execute.
See [Where your layer sits](/en/fundamentals/middleware#where-your-layer-sits).

The example above is fine as *this agent's own behaviour*. It is not a control.
:::

## `afterTool`

Transform what the model gets to see. Returning a string swaps only the text and
**preserves** `isError`; return a full `ToolOutput` to change the error mark:

```ts
async afterTool(result: ToolResult, ctx: Context) {
  if (result.output.length > 4000) {
    return `${result.output.slice(0, 4000)}\n… [truncated]`;
  }
}
```

`result` carries `name`, `args`, `output` and `isError`.

## `afterResponse`

Where a step records its decision for a later `until` or a later step:

```ts
export class ReviewerAgent {
  constructor(@state() private readonly s: ReviewState) {}

  async afterResponse(response: string) {
    this.s.rounds++;
    this.s.approved = /\bAPPROVED\b/.test(response);
  }
}
```

Note it returns nothing — the response is unchanged, and the hook exists purely
for its side effect. That is the most common use.

It is also where you promote an output from *speech* to *context*:

```ts
afterResponse(plan: string, ctx: Context) {
  ctx.state.set("history", ctx.state.history.slice(0, -1));
  ctx.state.append("memory", `Plan to follow:\n${plan}`);
}
```

## `onError`

Catches anything thrown in the turn. Returning a value makes it the agent's
output, which turns a crash into a degraded answer:

```ts
async onError(error: Error, ctx: Context) {
  ctx.meta({ failed: error.name });
  return "I could not complete that step.";
}
```

Returning nothing lets the error keep propagating.

## Hooks vs middleware

Both intercept. The difference is scope:

| | Hooks | [Middleware](/en/fundamentals/middleware) |
| --- | --- | --- |
| Scope | one agent class | every agent in the app |
| Registered | a method on the class | `app.use({ tool, chat })` |
| Sees | the turn's stages | the whole tool run / model call, with `next()` |
| Good for | this agent's behaviour | cross-cutting concerns — cache, metrics, rate limits |

If you find yourself copying a hook into every agent, it wants to be a
middleware.

## Common mistakes

**Returning a value from a hook meant to observe.** `afterResponse` returning
something replaces the response. If you only wanted to record a decision, return
nothing.

**Expecting hooks to fire when the class defines `run`.** An agent with a
`run(input, ctx)` method owns the whole step — no hook is called.

**Throwing in `beforeTool` to deny recoverably.** That ends the run. Use a tool
middleware returning `isError` if the model should get another try.

## Related

- [The run](/en/fundamentals/the-run) — where each hook fits
- [Middleware and plugins](/en/fundamentals/middleware)
