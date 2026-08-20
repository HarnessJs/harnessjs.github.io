# Debugging

Debugging an agent is different from debugging a program: the control flow is a
model's decision, and it changes between runs. The method below is ordered by
cost — each step tells you which of the next ones you need.

## 1. Make it repeatable

Nothing else works until the same input produces the same run:

```ts
sampling: { temperature: 0, seed: 42 }
```

Without this you cannot tell "my change helped" from "I got lucky". It is the
first thing to set and the last thing to remove.

## 2. Turn the volume up

```ts
export const config: ThenaConfig = { log: "verbose", report: true };
```

`"verbose"` prints the prompt the model **actually received** — after
`beforePrompt`, after the state projection, after any middleware. Most "why did
it do that" questions end here, because the answer is usually that the prompt did
not say what you thought it said.

## 3. Read the tree

Open `report/<runId>/index.html`. The shape of the tree answers the structural
questions before you read any text:

| What you see | What it means |
| --- | --- |
| one `chat`, no `tool` | the model never called the tool — a `description` problem |
| `tool` with error status | it called it and it failed; read the observation |
| `loop` with `exhausted: true` | `until` never became true |
| `loop` with `iterations: 1` | it stopped immediately — often an empty response |
| `attempts` on a `chat` | the network retried; the provider is unstable |
| `toolCallSource: "rescued"` | the model wrote the call as text — it is at its limit |

## 4. Isolate the layer

Once you know *where*, the question is *which layer*.

**Is it the prompt?** Copy the prompt from the report into the model directly. If
it misbehaves there too, it is a prompt problem, and no framework setting fixes
it.

**Is it the tool?** A tool with no `@context()` or `@state()` is a plain function:

```ts
const tool = new ReadFileTool();
expect(await tool.execute({ path: "README.md" })).toContain("ThenaJS");
```

**Is it the schema?** Turn off the rescue and see what the model really emits:

```ts
super({ host, model, rescueToolCalls: false });
```

Without the rescue, a call written as text stays a final answer — which makes it
obvious the model is not using the native format.

**Is it the flow?** A `run(input, ctx)` method on the agent class takes over the
step entirely, no model call involved. Temporarily stubbing one agent that way
tells you whether the problem is upstream or downstream of it.

## 5. Watch it live

When the failure is intermittent or slow, the report comes too late:

```ts
await app.use(thenaFlow());
```

[Flow](/en/devtools/flow) draws the tree as it happens, so you can see *where* a
run is stuck rather than waiting to find out that it was.

## Common shapes

**"It answers instead of acting."** The tool's `description` does not say *when*
to use it, or the prompt does not tell it to act. See
[Tool design](/en/techniques/tool-design).

**"The second agent returns nothing."** The first agent's output entered the
history as an `assistant` turn, so the second read it and concluded it had
answered. See [State and context](/en/fundamentals/state-and-context).

**"The loop never ends."** Add `onExhausted` to confirm it is the ceiling, then
check that something actually writes what `until` reads.

**"`onEvent` fires nothing."** The run is not being observed. Add
`observe: true`, or `report`/`log`/a plugin.

**"It dies with `fetch failed` after ~300s."** The request hung and retry never
fired, because nothing rejected. Set `timeoutMs`.

**"It works alone, breaks under load."** Almost never the framework — each run
has its own context and they do not share state. Look at what your tools touch:
module-level mutable state is shared, `ctx` and workflow state are not.

## Testing

The fastest feedback loop keeps the model out of it entirely. Tools are plain
classes, and a deterministic agent step can be stubbed with `run`:

```ts
export class StubPlanner {
  async run() {
    return "1. read README\n2. summarise";
  }
}

@Workflow({ steps: [StubPlanner, ExecutorAgent] })
export class TestWorkflow {}
```

For the model layer itself, a `chat` middleware can return a canned response
without a network call:

```ts
await app.use({
  name: "fake-model",
  chat: async () => ({ content: "APPROVED", toolCalls: [] }),
});
```

See [Testing](/en/best-practices/testing).

## Related

- [Report](/en/devtools/report)
- [Logging](/en/devtools/logging)
- [Flow](/en/devtools/flow)
- [Troubleshooting](/en/help/troubleshooting)
