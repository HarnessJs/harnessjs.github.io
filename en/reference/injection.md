# Injection

Parameter decorators that say what each argument should receive. Because each one
declares itself, **order does not matter** — and two parameters of the same type
stop being ambiguous.

```ts
import { input, context, state, memory } from "@thenajs/core";
```

| Decorator | Where | What it delivers |
| --- | --- | --- |
| `@input()` | a tool's `execute` | the arguments, validated by the schema |
| `@context()` | a tool's `execute` | the run's `Context` |
| `@state()` | an agent constructor, a tool's `execute` | the `@Workflow({ state })` instance |
| `@memory(Store?)` | an agent constructor | a `VectorMemory` |

## In tools

```ts
@Tool({ name: "read", description: "…", schema: z.object({ path: z.string() }) })
export class ReadTool {
  async execute(
    @input() { path }: { path: string },
    @context() ctx: Context,
    @state() s: ReviewState,
  ) {
    s.filesRead.push(path);
    return readFile(path, "utf8", { signal: ctx.signal });
  }
}
```

With no decorators, `execute` receives just the arguments — the common case:

```ts
async execute({ path }: { path: string }) { … }
```

## In agents

```ts
@Agent({ provider: MyProvider, prompt: "./a.agent.md" })
export class MyAgent {
  constructor(
    @state() private readonly s: ReviewState,
    @memory(QdrantOpenAI) private readonly vectors: VectorMemory,
  ) {}
}
```

`@memory(Store)` identifies the memory by the store's class, removing the
dependency on the order of `ThenaConfig.memory`. With no argument it delivers the
first registered one.

Without the decorator the positional contract applies — which is why reordering
that array silently changes behaviour.

::: warning `@context()` does not work in a constructor
The agent is instantiated before the run begins, so the context does not exist
yet. The runtime fails with that explanation instead of injecting `undefined`.
Use it in a tool's `execute`, or take `ctx` as a hook parameter.
:::

## `context()` as a function

```ts
provider: () => new OpenAIProvider({ apiKey: keyFor(context().data) });
```

Same object, different timing: inside a step you get the step's context, with
`state` and `turn`; outside one you get the run's, and touching `state` throws
with an explanation.

## Tool constructors

Tools are instantiated by the framework, so their constructors take dependencies
too — most usefully `WorkflowRuntime`:

```ts
export class ResearchTool {
  constructor(private readonly runtime: WorkflowRuntime) {}
}
```

## Why not by type

`reflect-metadata` reads parameter **types** and would make these decorators
unnecessary. It is not used because esbuild — which `tsx` uses in dev — does not
emit `design:paramtypes`: type-based injection would compile and then break
silently under `npm start`.

Decorator calls are emitted on both paths.

This is also why `experimentalDecorators` is required rather than the Stage 3
proposal, which has no parameter decorators at all.

## If you do not declare state

| Situation | What happens |
| --- | --- |
| nobody asks for state | works normally |
| an agent asks with `@state()` | error naming the class and the parameter |
| a tool asks with `@state()` | error naming the method and the parameter |
| an `until` declares a 2nd parameter | error saying to add `state` |

The last is detected **before running**, from the arity of `until`. Without that
check the state would arrive `undefined` and surface as a `TypeError` on the
first field read, never saying what was missing.

A one-parameter `until` (`untilAnswered`, or `(ctx) => …`) never triggers it.

## Errors

```
[thena] @state() in ReviewerAgent (parameter 0): no state declared.
        Add `state: MyClass` to @Workflow.

[thena] @memory(QdrantOpenAI) in MyAgent: that store is not registered in
        ThenaConfig.memory.
```

## Related

- [Dependency injection](/en/fundamentals/dependency-injection) — the concept
- [Context](/en/reference/context)
- [Vector store](/en/reference/vector-store)
