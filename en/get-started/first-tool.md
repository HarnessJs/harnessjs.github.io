# Your first tool

Your agent can talk. It cannot read a file, call an API or run a command — so
when you ask about `README.md`, it guesses.

A tool is how you hand it a capability.

## A tool is a class

```ts
// src/tools/read-file.tool.ts
import { Tool } from "@thenajs/core";
import { readFile } from "node:fs/promises";
import { z } from "zod";

@Tool({
  name: "read_file",
  description: "Reads a file and returns its contents.",
  schema: z.object({ path: z.string() }),
})
export class ReadFileTool {
  async execute({ path }: { path: string }) {
    return readFile(path, "utf8");
  }
}
```

Three things describe it, and the model sees all three: the `name` it calls, the
`description` it decides from, and the `schema` that says what arguments are
valid.

Hand it to the agent:

```ts
@Agent({
  provider: LocalOllamaProvider,
  tools: [ReadFileTool],
  prompt: "./explorer.agent.md",
})
export class ExplorerAgent {}
```

Ask again:

```
[thena] ▸ agent ExplorerAgent
[thena]   ▸ chat
[thena]     ▸ tool read_file
[thena]     ◂ tool read_file  3ms ✓
[thena]   ◂ chat  1.81s ✓

It is a TypeScript framework for building LLM agents, published as @thenajs/*.
```

It read the file. You wrote no `if` to detect the call, no `JSON.parse` of the
arguments, no validation.

## What the framework did for you

Between your question and that answer:

| | |
| --- | --- |
| Turned the schema into the format the provider expects | your Zod object, converted once and memoised |
| Noticed the model wanted `read_file` | native tool call, or rescued from text if the model emitted JSON instead |
| Validated the arguments against your schema | invalid input never reaches your `execute` |
| Ran your `execute` and fed the result back | as a `tool` message, in the right shape for the next turn |

That last row is why `execute` receives `{ path }` already typed. If the model
sends `{ file: "README.md" }`, your code is not called at all — the model gets
told what it got wrong, and tries again.

## Only what you hand over

The agent can do exactly what its `tools` array allows, and nothing else. That
is not a limitation to work around — it is the security boundary. An agent that
reads untrusted content and holds a tool with side effects is an attack surface;
see [SECURITY.md](https://github.com/thenajs/ThenaJS/blob/main/SECURITY.md).

ThenaJS ships no tool package — a tool is small enough that you own it. Ready-made
ones to copy, including a shell tool and its warning, are in
[Tool recipes](/en/techniques/tool-recipes).

## When a tool fails

Try asking about a file that does not exist. Your tool throws `ENOENT` — and in
ThenaJS that does **not** end the run. The error goes back to the model as the
tool's result, and it gets another turn:

```
[thena]   ▸ tool read_file
[thena]   ◂ tool read_file  2ms ✗   ENOENT: no such file or directory, 'READMEE.md'
[thena]   ▸ chat
[thena]     ▸ tool read_file
[thena]     ◂ tool read_file  3ms ✓

It is a TypeScript framework for building LLM agents.
```

It misspelled the name, was told, and fixed it. **Tool failure is an
observation, not an exception** — and that single decision is what makes the
investigate-act-look-again loop work at all.

Returning an error beats throwing one, because you choose the words the model
reads:

```ts
async execute({ path }: { path: string }) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return { content: `No file at "${path}". Check the path.`, isError: true };
  }
}
```

The difference is not cosmetic. `ENOENT: no such file or directory, open
'READMEE.md'` describes a syscall. `No file at "READMEE.md". Check the path.`
tells the model what to do next.

## The problem

One agent with one tool answers one question. Real work has stages — plan, then
investigate, then check the result — and often has to go around more than once.

That is what a workflow is for.

**Next: [your first workflow](/en/get-started/first-workflow).**
