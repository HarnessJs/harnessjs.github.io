# Dependency injection

Parameter decorators that say what each argument should receive. Because each one
declares itself, **order does not matter** — and two parameters of the same type
stop being ambiguous.

```ts
import { input, context, state, memory } from "@thenajs/core";
```

| Decorator | Where | What it delivers |
| --- | --- | --- |
| `@input()` | a tool's `execute` | the arguments, already validated by the schema |
| `@context()` | a tool's `execute` | the run's `Context` |
| `@state()` | an agent constructor, a tool's `execute` | the state declared in `@Workflow({ state })` |
| `@memory(Store?)` | an agent constructor | a `VectorMemory`; with a class, the matching store's |

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

With no decorators at all, `execute` receives just the arguments — which remains
the common case, and the simplest:

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

`@memory(Store)` identifies the memory by the store's class, which removes the
dependency on the order of `ThenaConfig.memory`. With no argument it delivers the
first registered one.

Without the decorator the positional contract applies: memories arrive in the
order the stores were registered — which is why reordering that array silently
changes behaviour, and why naming the store is better.

::: warning `@context()` does not work in a constructor
The agent is instantiated before the run begins — the context does not exist yet.
The runtime fails with that explanation rather than silently injecting
`undefined`. Use it in a tool's `execute`, or take `ctx` as a hook parameter.
:::

## `context()` as a function

The same name is also callable, and returns the context from wherever you are:

```ts
provider: () => new OpenAIProvider({ apiKey: keyFor(context().data) });
```

Both give you the same object. The difference is **when**: inside a step you get
the step's context, with `state` and `turn`; outside one — in a provider factory,
which runs during compilation — you get the run's, and touching `state` throws
with an explanation.

## Why not by type

`reflect-metadata` reads parameter **types** and would make the decorators
unnecessary. It is not used because esbuild — which `tsx` uses in dev — does not
emit `design:paramtypes`: type-based injection would compile and then break
silently under `npm start`.

Decorator calls, by contrast, are emitted on both paths.

## Tool constructors

Tools are instantiated by the framework, so their constructors can take
dependencies too — most usefully `WorkflowRuntime`, which is how a tool starts
its own workflow:

```ts
export class ResearchTool {
  constructor(private readonly runtime: WorkflowRuntime) {}
}
```

## If you do not declare state

Declaring `state` on `@Workflow` is optional, and whoever does not use it pays
nothing:

| Situation | What happens |
| --- | --- |
| nobody asks for state | works normally |
| an agent asks with `@state()` | error naming the class and the parameter |
| a tool asks with `@state()` | error naming the method and the parameter |
| an `until` declares a 2nd parameter | error saying to add `state` |

The last is detected **before running**, from the number of parameters `until`
declares. Without that check the state would arrive `undefined` and the error
would surface as a `TypeError` on the first field read — never saying what was
missing.

A one-parameter `until` (`untilAnswered`, or `(ctx) => …`) never triggers it.

## Errors

Injection that cannot be satisfied fails immediately, naming the class and the
parameter index:

```
[thena] @state() in ReviewerAgent (parameter 0): no state declared.
        Add `state: MyClass` to @Workflow.

[thena] @memory(QdrantOpenAI) in MyAgent: that store is not registered in
        ThenaConfig.memory.
```

## Related

- [State and context](/en/fundamentals/state-and-context)
- [Memory](/en/fundamentals/memory)
