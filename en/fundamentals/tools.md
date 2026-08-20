# Tools

A tool is an action the model may ask for. You describe what it does and what
arguments it takes; the framework handles everything between the model's request
and your code running.

```ts
@Tool({
  name: "read_file",
  description: "Reads a project file. Use before answering about code.",
  schema: z.object({
    path: z.string().describe("relative path, e.g. src/main.ts"),
  }),
})
export class ReadFileTool {
  async execute({ path }: { path: string }) {
    return readFile(path, "utf8");
  }
}
```

## The three things the model sees

| Field | What it is for |
| --- | --- |
| `name` | what the model writes to call it |
| `description` | how the model decides *whether* to call it |
| `schema` | a Zod object saying what arguments are valid |

All three are prompt. The `description` especially: it is the single biggest
lever on whether the tool gets used at all, and `.describe()` on a schema field
is read too.

## What happens around your `execute`

```
model asks for read_file
  → schema validates the arguments        ← invalid never reaches you
  → beforeTool hook (if any)
  → your execute(args)
  → afterTool hook (if any)
  → result goes back as a `tool` message
  → the model gets another turn
```

Your `execute` receives arguments that are already parsed and typed. If the model
sends `{ file: "x" }` against a schema wanting `{ path: string }`, your code is
never called — the model is told what was wrong and tries again.

## Return values

Return a string, and it becomes the observation the model reads. Return a
`ToolOutput` for more control:

```ts
return {
  content: "text the model reads",
  isError: true, // marks the node `status: "error"` and sets ctx.turn.toolError
  data: { rows: 42 }, // structured, ignored by the model, visible to hooks
};
```

`data` is the channel for telemetry and hooks — something you want in the report
or in an `afterTool` without spending the model's context on it.

## Failure is an observation

A tool that throws does **not** end the run. The error text goes back as the
tool's result and the model gets another turn to fix it. That single decision is
what makes an investigate-act-look-again loop work.

Prefer returning an error over throwing one, because then you choose the words:

```ts
return { content: `No file at "${path}". Check the path.`, isError: true };
```

For failures the model cannot fix — a bug, an expired credential, a database that
is down — throw `FatalToolError`. It crosses the agent and ends the run, and the
original message never reaches the model's context or the report:

```ts
throw new FatalToolError("database unavailable", { cause: err });
```

See [Errors](/en/fundamentals/errors).

## Reaching the run from a tool

By default `execute` gets only the validated arguments, which keeps the tool a
pure function and trivial to test. When it needs more, parameters say what they
want:

```ts
async execute(
  @input() { path }: { path: string },
  @context() ctx: Context,
  @state() s: ReviewState,
) {
  s.filesRead.push(path);
  return readFile(path, "utf8", { signal: ctx.signal });
}
```

Because each parameter declares itself, **order does not matter**. See
[Dependency injection](/en/fundamentals/dependency-injection).

Use it sparingly: a tool that reads the context stops being testable in
isolation.

## Cancellation

A long-running tool should pass the run's signal down, or `abort()` will only
take effect between steps rather than inside your work:

```ts
async execute(@input() { url }: { url: string }, @context() ctx: Context) {
  const res = await fetch(url, { signal: ctx.signal });
  return res.text();
}
```

## Constructor injection

A tool is instantiated by the framework, so its constructor can take
dependencies — including `WorkflowRuntime`, which is how a tool starts its own
workflow:

```ts
export class ResearchTool {
  constructor(private readonly runtime: WorkflowRuntime) {}
}
```

## Common mistakes

**A vague `description`.** `"File operations."` tells the model nothing about
when to reach for it. Say when to use it.

**Returning enormous output.** Tool output is the fastest way to fill the context
window. Truncate, and say that you did:

```ts
return text.length <= MAX ? text : `${text.slice(0, MAX)}\n… [truncated]`;
```

**Naming the method `run`.** It is `execute`. The framework fails loudly on this,
but it is a common first mistake.

**Assuming a missing decorator is caught by types.** A class without `@Tool()`
fails at compile time only in the sense that the framework rejects it at startup:

```
[thena] The class "MyTool" is not decorated with @Tool().
```

## Related

- [Errors](/en/fundamentals/errors) — recoverable vs fatal
