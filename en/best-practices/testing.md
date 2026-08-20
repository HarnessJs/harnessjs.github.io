# Testing

The model is non-deterministic, slow and costs money. Good agent tests are the
ones that do not involve it.

Three layers, cheapest first.

## 1. Tools, as plain functions

A tool taking only `@input()` needs nothing from the framework:

```ts
import { ReadFileTool } from "../src/tools/read-file.tool";

test("truncates long files", async () => {
  const tool = new ReadFileTool();
  const out = await tool.execute({ path: "fixtures/large.txt" });
  expect(out).toContain("[truncated]");
});
```

This is where most of your logic should live, and it is the main practical
argument for keeping tools pure — see
[Tool design](/en/techniques/tool-design).

Test the schema too, since it is a real boundary:

```ts
test("rejects a path outside the project", () => {
  const schema = getToolMetadata(ReadFileTool).schema;
  expect(schema.safeParse({ path: "../../etc/passwd" }).success).toBe(false);
});
```

## 2. Workflow shape, with stubbed agents

An agent class with a `run(input, ctx)` method takes over the step entirely — no
model call, no hooks. That makes workflow structure testable:

```ts
const rounds: number[] = [];

class StubReviewer {
  constructor(@state() private readonly s: ReviewState) {}
  async run() {
    this.s.approved = ++this.s.rounds >= 3;
    rounds.push(this.s.rounds);
    return "reviewed";
  }
}

@Workflow({
  state: ReviewState,
  steps: [loop({ steps: [StubReviewer], until: (_c, s: ReviewState) => s.approved })],
})
class TestWorkflow {}

test("stops as soon as it is approved", async () => {
  await Thena.create(TestWorkflow).run({ input: { message: "go" } });
  expect(rounds).toEqual([1, 2, 3]); // stopped on its own, not at the ceiling
});
```

This is how you test the thing most likely to be wrong — the stopping condition —
without a model.

## 3. The model layer, faked

A `chat` middleware replaces the provider call entirely:

```ts
await app.use({
  name: "fake-model",
  chat: async () => ({ content: "APPROVED", toolCalls: [] }),
});
```

That is enough for most tests: the agent runs, the tools run, the loop runs, and
nothing touches the network.

When you need the model to say something *different* on each turn — to test that
the agent recovers from a tool error, say — return the answers in order:

```ts
const answers = [
  { content: "", toolCalls: [{ name: "read_file", arguments: { path: "nope" } }] },
  { content: "", toolCalls: [{ name: "read_file", arguments: { path: "README.md" } }] },
  { content: "It is a framework.", toolCalls: [] },
];

let turn = 0;
await app.use({ name: "scripted", chat: async () => answers[turn++] });
```

No network, deterministic, fast — and it tests the loop, the tool, the error
recovery and the wiring together.

## Assert on the report, not on prose

Asserting `expect(answer).toContain("...")` against real model output is a flaky
test. The structured data is stable:

```ts
const events: ExecutionEvent[] = [];
await app.run({ input, log: (e) => events.push(e) });

const toolCalls = events.filter((e) => e.kind === "tool" && e.phase === "end");
expect(toolCalls).toHaveLength(2);
expect(toolCalls[0].status).toBe("error"); // it recovered from a failure
```

"Did it call the right tools, in the right order, and converge?" is a real
question with a stable answer. "Did it use the word 'framework'?" is not.

## Fake the vector store

The `VectorStore` contract is four methods, so an in-memory implementation makes
memory tests offline and deterministic:

```ts
export class MemoryStore extends VectorStore {
  private points: VectorDocument[] = [];
  async ensureCollection() {}
  async upsert(docs: VectorDocument[]) { this.points.push(...docs); }
  async search({ vector, limit = 5 }: VectorSearch) { … }
  async remove() { this.points = []; }
}
```

See [Custom vector stores](/en/advanced/custom-vector-stores).

## When you do test against a real model

Sometimes you have to — that is where prompt quality actually shows. Keep those
separate from your unit tests:

```ts
test.skipIf(!process.env.RUN_MODEL_TESTS)("finds the entry point", async () => {
  …
});
```

Pin sampling, or the test is a coin flip:

```ts
sampling: { temperature: 0, seed: 42 }
```

And give every such test a `budget` — a test suite is exactly where a runaway
loop goes unnoticed until the bill.

## Isolation makes parallel tests safe

Each run opens its own context, so test files run in parallel without
contaminating each other — the framework's own suite is configured that way
deliberately.

The exception is your own module-level state. A `let` at module scope in a tool
will interleave across parallel tests, in the same way it does under load in
production.

## Always `dispose()`

```ts
afterEach(() => app.dispose());
```

A plugin that opened a server keeps the test runner alive. `thenaFlow()` in a
test is the usual culprit.

## Related

- [Debugging](/en/devtools/debugging)
- [Tool design](/en/techniques/tool-design)
- [Writing plugins](/en/advanced/writing-plugins)
- [Architecture](/en/best-practices/architecture)
