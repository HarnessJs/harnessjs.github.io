# Tool recipes

A tool is a class with three fields and one method. Copy it, change the body,
done.

ThenaJS ships no tool package — there would be nothing to ship.

## Shell

```ts
import { Tool } from "@thenajs/core";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const run = promisify(exec);

@Tool({
  name: "shell",
  description: "Runs a shell command and returns its output.",
  schema: z.object({ command: z.string() }),
})
export class ShellTool {
  async execute({ command }: { command: string }) {
    const { stdout } = await run(command);
    return stdout;
  }
}
```

::: danger This gives the model command execution
Fine on your machine. Not in a service that reads third-party input — see
[hardening](#hardening-for-production).
:::

## Fetch a web page

```ts
import { Tool } from "@thenajs/core";
import { z } from "zod";

@Tool({
  name: "fetch_page",
  description: "Fetches a web page and returns its text.",
  schema: z.object({ url: z.string() }),
})
export class FetchPageTool {
  async execute({ url }: { url: string }) {
    const html = await (await fetch(url)).text();
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}
```

## Read a file

```ts
import { Tool } from "@thenajs/core";
import { readFile } from "node:fs/promises";
import { z } from "zod";

@Tool({
  name: "read_file",
  description: "Reads a project file. Use before answering about code.",
  schema: z.object({ path: z.string() }),
})
export class ReadFileTool {
  execute({ path }: { path: string }) {
    return readFile(path, "utf8");
  }
}
```

## Call your own API

```ts
import { Tool } from "@thenajs/core";
import { z } from "zod";

@Tool({
  name: "find_order",
  description: "Looks up an order by id and returns its status.",
  schema: z.object({ orderId: z.string() }),
})
export class FindOrderTool {
  async execute({ orderId }: { orderId: string }) {
    const order = await (await fetch(`${API}/orders/${orderId}`)).json();
    return `Order ${orderId}: ${order.status}.`;
  }
}
```

## Hardening for production

Everything above works. What follows is what you add **when** the case calls for
it — each item solves a concrete problem, none of it is ceremony.

### Truncate the output

The biggest hidden cost. A tool returning 4 KB twelve times sends ~50 KB of stale
content on the last call, and you pay for it every turn.

```ts
const MAX = 4_000;
return text.length <= MAX ? text : `${text.slice(0, MAX)}\n… [truncated]`;
```

### Write the error the model reads

Without a `try`, the raw `ENOENT` becomes the observation — and it describes a
syscall, not what to do next.

```ts
catch {
  return { content: `No file at "${path}". Check the path.`, isError: true };
}
```

This does **not** end the run: the model reads it and tries something else. For
what it cannot fix — a database down, an expired credential — use
`throw new FatalToolError("…")`.

### Pass the `signal` through

Without it, cancelling the run does not interrupt your tool; it only takes effect
between steps.

```ts
async execute(@input() { url }: { url: string }, @context() ctx: Context) {
  const res = await fetch(url, { signal: ctx.signal });
}
```

### Put a timeout on anything that can hang

```ts
await run(command, { timeout: 30_000 });
```

### Narrow the schema

Every constraint is a class of error the model cannot produce:

```ts
schema: z.object({
  url: z.string().url(),
  service: z.enum(["api", "worker", "web"]),
});
```

### Allowlist, if it is shell with untrusted input

```ts
const ALLOWED = new Set(["git", "ls", "cat"]);

const program = command.trim().split(/\s+/)[0] ?? "";
if (!ALLOWED.has(program)) return { content: "not allowed", isError: true };

// Without this line the list is worthless: `git status; rm -rf /` starts with `git`.
if (/[;&|`$><]/.test(command)) return { content: "no chaining", isError: true };
```

This bounds **which programs** run, not what a permitted one does — `cat` reads
any file the process can read. For genuinely untrusted input, the boundary is a
container, not a regex.

## Related

- [Tool design](/en/techniques/tool-design) — why the `description` decides
  whether a tool gets used
- [Errors](/en/fundamentals/errors) — observation vs `FatalToolError`
- [Security](/en/best-practices/security) — least privilege
