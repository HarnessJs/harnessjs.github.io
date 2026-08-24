# Flow

The [report](/en/devtools/report) tells the story after it ends. Flow shows it
while it happens: a local site drawing the execution tree in real time, with each
step's prompt and response one click away.

```bash
npm install @thenajs/flow
```

```ts
import { Thena } from "@thenajs/core";
import { thenaFlow } from "@thenajs/flow";
import { MyWorkflow } from "./workflows/my.workflow";

const app = Thena.create(MyWorkflow, { log: true });
await app.use(thenaFlow());

await app.run({ prompt: "Hello" });
```

Open <http://127.0.0.1:4100>. Nodes appear as the run advances.

## What is on screen

Each node is a step, using the same vocabulary as the report:

| Icon | Step | What it is |
| --- | --- | --- |
| `▣` | `workflow` | the whole run |
| `↻` | `loop` | a `loop({ ... })` block |
| `⇉` | `parallel` | a `parallel([ ... ])` block |
| `◆` | `agent` | an agent step |
| `✦` | `chat` | a model call |
| `⚙` | `tool` | a tool execution |

The left border gives the status — blue pulsing while running, green at the end,
red on failure. Clicking a node opens a panel with the prompt sent, the response,
the tool's input and output, the tokens, and the error if there was one.

The side list keeps the session's runs. Flow follows the most recent one by
itself; clicking an older one freezes on it until you come back.

## Alongside everything else

Flow **does not displace your `log`**. Both receive the same stream:

```ts
const app = Thena.create(MyWorkflow, {
  log: true, // still printing to the terminal
  report: true, // still writing the HTML at the end
});
await app.use(thenaFlow());
```

One useful difference: `log: true` shows only the structure, and needs
`"verbose"` for content. Flow turns content capture on by itself — otherwise the
panels would be empty.

## Options

```ts
await app.use(
  thenaFlow({
    port: 4100, // the site's port
    host: "127.0.0.1", // listening interface
    maxRuns: 20, // runs kept in memory
    log: true, // print the URL on startup
  }),
);
```

## Know this before you use it

**Nothing is persisted.** The history lives in the process's memory — close it
and it is gone. For something that outlives the run, use the
[report](/en/devtools/report).

**The process stays open after `run`.** That is what gives you time to look at
the result. End it with `Ctrl+C`, or call `await app.dispose()` when you want the
script to finish on its own:

```ts
await app.run({ prompt: "Hello" });
await app.dispose(); // closes the site and releases the process
```

**It listens on `127.0.0.1` only.** Every step's prompt and response passes
through there, and that usually includes sensitive data. Changing `host` exposes
all of it on the network — only do that if you know why.

::: warning Development tool
Flow keeps runs in memory and serves an unauthenticated page. It belongs on your
machine, not in production. For production observability, use a
plugin that forwards events to your existing
stack.
:::

## The same stream, anywhere you want

`thenaFlow()` is not a special case: it is a `ThenaPlugin`, and the interface is
small on purpose. The same event stream can go to your observability platform, a
file, a webhook:

```ts
import type { ThenaPlugin } from "@thenajs/core";

export function myPlugin(): ThenaPlugin {
  return {
    name: "my-plugin",
    async setup() {
      await connect();
    },
    onEvent(event) {
      send(event);
    },
    async dispose() {
      await close();
    },
  };
}
```

```ts
await app.use(thenaFlow());
await app.use(myPlugin());
```

Several plugins coexist, and none displaces the config's `log`. The `event` is
the same `ExecutionEvent` a `log` function receives — with `id`, `parentId` and
`runId`, which is what makes the tree reconstructible and keeps concurrent runs
apart.

## Related

- [Report](/en/devtools/report) — the same run, after the fact
- [Logging](/en/devtools/logging)
- [Writing plugins](/en/advanced/writing-plugins)
