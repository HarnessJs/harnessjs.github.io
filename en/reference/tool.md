# `@Tool`

Registers a class as a tool. The logic goes in `execute`.

```ts
import { Tool, input, context, state } from "@thenajs/core";
import { z } from "zod";

@Tool({
  name: "read_file",
  description: "Reads a project file. Use before answering about code.",
  schema: z.object({ path: z.string().describe("relative path") }),
})
export class ReadFileTool {
  async execute({ path }: { path: string }) {
    return readFile(path, "utf8");
  }
}
```

## `ToolConfig`

| Key | Type | Required |
| --- | --- | --- |
| `name` | `string` | yes |
| `description` | `string` | yes |
| `schema` | a Zod object | yes |

All three are sent to the model. `description` and any `.describe()` on schema
fields are prompt — the model decides from them.

## `execute`

The only required member. Its parameters are resolved by decorator:

```ts
async execute(
  @input()   args: { path: string },   // validated against the schema
  @context() ctx: Context,             // the run's context
  @state()   s: MyState,               // the workflow state
) { … }
```

With no decorators, `execute` receives just the validated arguments:

```ts
async execute({ path }: { path: string }) { … }
```

Because each parameter declares itself, order does not matter. See
[Injection](/en/reference/injection).

## Return value

| Return | Effect |
| --- | --- |
| `string` | becomes the observation the model reads |
| `ToolOutput` | full control |
| anything else | serialised |

```ts
interface ToolOutput {
  /** The text that goes back to the model as the observation. */
  content: string;
  /** Marks it a failure — the `tool` node becomes `status: "error"`. */
  isError?: boolean;
  /** Free structured payload, ignored by the model — for hooks and telemetry. */
  data?: unknown;
}
```

## Failure

A throw becomes an observation the model can recover from. To end the run
instead:

```ts
import { FatalToolError } from "@thenajs/core";

throw new FatalToolError("database unavailable", { cause: err });
```

`FatalToolError` crosses the agent and ends the run, and the original message
never reaches the model's context or the report. See
[Errors](/en/fundamentals/errors).

## Constructor

Instantiated by the framework, so it can take dependencies:

```ts
export class ResearchTool {
  constructor(private readonly runtime: WorkflowRuntime) {}
}
```

See [Nested runs](/en/techniques/nested-runs).

## Registering

Listed on the agent that may use it:

```ts
@Agent({ provider: P, tools: [ReadFileTool], prompt: "./a.agent.md" })
```

`tools` also accepts a plain `ToolType` object, for a tool built without the
decorator.

## Errors

```
[thena] The class "MyTool" is not decorated with @Tool().
[thena] The class "MyTool" does not implement execute(input).
```

The first is a missing decorator; the second is the method named wrong.

## Related

- [Tools](/en/fundamentals/tools) — the concept
- [Tool design](/en/techniques/tool-design)
- [Injection](/en/reference/injection)
