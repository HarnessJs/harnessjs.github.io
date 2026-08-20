# Tool design

A tool the model never calls is worse than no tool: it costs context on every
turn and does nothing. Most tool problems are description problems.

## The description is prompt

The model decides from it, literally.

```ts
description: "File operations.";                                  // vague
description: "Reads a project file. Use before answering about code."; // decidable
```

Write it as an instruction to a colleague who cannot see your code: what it does,
and **when to reach for it**. `.describe()` on schema fields is read too:

```ts
schema: z.object({
  path: z.string().describe("relative path from the project root, e.g. src/main.ts"),
});
```

## Make the schema narrow

Every constraint you express is a class of failure the model cannot produce,
caught before your code runs:

```ts
schema: z.object({
  path: z.string(),
  lines: z.number().int().min(1).max(500).default(100),
  mode: z.enum(["read", "stat"]),
});
```

An `enum` beats a free string. A `default` removes a decision. Invalid arguments
never reach `execute` — the model is told what was wrong and tries again.

## Return a budget, not a firehose

Tool output is the fastest way to fill a context window, and it is what ages
worst: the model rarely needs a whole file ten turns later.

```ts
const MAX_CHARS = 4000;

async execute({ path }: { path: string }) {
  const text = await readFile(path, "utf8");
  return text.length <= MAX_CHARS
    ? text
    : `${text.slice(0, MAX_CHARS)}\n… [truncated, ${text.length} chars total]`;
}
```

Saying you truncated matters — otherwise the model treats a partial file as the
whole file.

## Write the error the model reads

```ts
return { content: `No file at "${path}". Check the path.`, isError: true };
```

`ENOENT: no such file or directory, open 'READMEE.md'` describes a syscall. The
version above tells the model what to do next. See
[Errors](/en/fundamentals/errors).

And for what the model cannot fix, `FatalToolError` — which also keeps a driver's
message out of the model's context and off your disk.

## One tool, one verb

A `manage_files` tool with an `action` parameter forces the model to make two
decisions at once, and the second one is invisible in the tool list. Prefer:

```
read_file · write_file · list_files
```

The exception is when the operations genuinely share arguments and only one is
ever correct — a search with a `kind` filter, say.

## Keep it a pure function where you can

By default `execute` receives only the validated arguments, which makes the tool
trivial to unit-test:

```ts
expect(await new ReadFileTool().execute({ path: "x.txt" })).toBe("hello");
```

Every `@context()` and `@state()` you add trades that away. Add them when you
need them — passing a signal, recording into the flow's state, starting a
[nested run](/en/techniques/nested-runs) — not by default.

## Pass the signal

Anything that takes time:

```ts
async execute(@input() { url }: { url: string }, @context() ctx: Context) {
  const res = await fetch(url, { signal: ctx.signal });
  return res.text();
}
```

Without it, cancellation only takes effect between steps.

## `data` for what the model should not read

```ts
return {
  content: `Found 42 matches.`, // what the model sees
  data: { matches, queryMs: 18 }, // for hooks, the report, telemetry
};
```

Structured detail belongs here rather than serialised into the observation.

## Only hand over what is needed

The `tools` array is the security boundary — the agent can do exactly what is in
it and nothing else. An agent that reads untrusted content and holds a tool with
side effects is an attack surface. A shell tool is the clearest example — see the
warning on it in [Tool recipes](/en/techniques/tool-recipes).

Prefer a narrow tool over a general one: `restart_service(name)` with an enum of
known services beats `run_shell(command)`.

## Diagnosing "it did not use my tool"

1. **Read the `description` as the model does.** Does it say *when*?
2. **Check the prompt tells it to act.** *"Before answering, read the relevant
   files."*
3. **Check `toolCallSource` on the `chat` nodes in the report.** `"rescued"`
   means the model wrote the call as text and the framework recovered it — it
   works, but you are at the edge of the model's ability.
4. **Count the tools.** Twenty tools is a hard choice for a small model.

## Related

- [Tools](/en/fundamentals/tools) — the mechanics
- [`@Tool`](/en/reference/tool)
- [Errors](/en/fundamentals/errors)
- [Security](/en/best-practices/security)
