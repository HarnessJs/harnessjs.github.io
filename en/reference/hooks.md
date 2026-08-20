# Hooks

Optional methods on the agent class. The runtime calls only what exists.

```ts
import type { AgentHooks } from "@thenajs/core";

export class ReviewerAgent implements AgentHooks {
  async afterResponse(response: string, ctx: Context) {
    ctx.approved = response.includes("APPROVED");
  }
}
```

`implements AgentHooks` is optional and only checks the signatures.

## The contract

**Returning a value replaces. Returning `undefined` keeps the original.** That is
why a hook that only observes can simply return nothing.

All five may be `async`.

## Order

```
beforePrompt → model call → beforeTool → execute → afterTool → afterResponse
                                   any throw → onError
```

See [The run](/en/fundamentals/the-run#one-agent-turn-in-detail).

## `beforePrompt(prompt, ctx)`

```ts
beforePrompt?(prompt: string, ctx: Context): string | void | Promise<string | void>;
```

Transforms the final prompt before it goes to the provider.

## `beforeTool(call, ctx)`

```ts
beforeTool?(call: ToolCall, ctx: Context): ToolCall | void | Promise<ToolCall | void>;

interface ToolCall {
  name: string;
  args: unknown;
}
```

Return a new `ToolCall` to swap the arguments. **A `throw` cancels the run.**

To deny in a way the model can recover from, use a
[tool middleware](/en/fundamentals/middleware) returning
`{ content, isError: true }` instead.

## `afterTool(result, ctx)`

```ts
afterTool?(result: ToolResult, ctx: Context):
  string | ToolOutput | void | Promise<string | ToolOutput | void>;

interface ToolResult {
  name: string;
  args: unknown;
  output: string;
  isError?: boolean;
}
```

Returning a **string** swaps only the text and **preserves** `isError`. To change
the error mark, return a full `ToolOutput`.

## `afterResponse(response, ctx)`

```ts
afterResponse?(response: string, ctx: Context): string | void | Promise<string | void>;
```

The most common use returns nothing and exists purely for its side effect —
recording a decision a later `until` will read:

```ts
async afterResponse(response: string) {
  this.state.approved = /\bAPPROVED\b/.test(response);
}
```

## `onError(error, ctx)`

```ts
onError?(error: Error, ctx: Context): string | void | Promise<string | void>;
```

Catches anything thrown in the turn. Returning a value makes it the agent's
output — a crash becomes a degraded answer. Returning nothing lets the error keep
propagating.

## Not called when the agent defines `run`

An agent class with a `run(input, ctx)` method owns the whole step. No hook fires.

## Hooks vs middleware

| | Hooks | Middleware |
| --- | --- | --- |
| Scope | one agent class | every agent in the app |
| Registered | a method on the class | `app.use({ tool, chat })` |
| Sees | the turn's stages | the whole execution, with `next()` |

A hook copied into every agent wants to be a
[middleware](/en/fundamentals/middleware).

## Related

- [Hooks](/en/fundamentals/hooks) — the concept
- [Context](/en/reference/context)
- [`@Agent`](/en/reference/agent)
