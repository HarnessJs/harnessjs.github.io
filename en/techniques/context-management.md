# Context management

Every turn resends the whole history. A loop that runs twelve rounds with a tool
that returns 4KB each time is sending ~50KB of stale file contents on the last
call — paying for it, and pushing the actual question further from the model's
attention.

`contextWindow()` is a shipped `chat` middleware that trims it.

```ts
import { contextWindow } from "@thenajs/core";

await app.use({
  name: "window",
  chat: contextWindow({
    maxTurns: 12,
    maxChars: 60_000,
    maxCharsPerTool: 4_000,
  }),
});
```

## Measure before you trim

::: warning It has no defaults, on purpose
Trimming history changes agent behaviour — it can lose what it needed to
remember, silently. A default here would trade a loud, expensive failure for a
mute degradation, which is much worse to diagnose.
:::

The number to look at is `promptTokens` on the `chat` nodes in the report. If it
grows turn over turn and approaches your model's window, trim. If it does not,
this page is not your problem.

Once the window is on, its own `chat` nodes carry `windowTrimmed`,
`messagesSent`, `messagesOriginal` and `windowOrphansDropped`. The last one is
separate from the others on purpose: "I cut to fit the ceiling" and "I cut one
more to keep a tool pair whole" are different causes, and a
`windowOrphansDropped` that is never zero means the window is tight enough to be
landing inside tool turns.

## The options

| Option | What it does |
| --- | --- |
| `maxTurns` | how many messages from the end to keep |
| `maxChars` | character ceiling for the history; trims from the start until it fits |
| `maxCharsPerTool` | ceiling per tool observation |
| `notice` | the note left in place of what was cut; `false` cuts silently |

::: tip `maxTurns` counts messages, not round trips
A turn with a tool takes two messages (`assistant` + `tool`), so `maxTurns: 12`
keeps about 6 exchanges.

It is a **ceiling, not a quota**: if the cut would land between an `assistant`
that called a tool and the `tool` answering it, the window walks forward past the
orphan and sends one message fewer. Providers reject a split pair with a `400`,
and a `400` is a contract error the retry will not retry — so a window that
saved the pair is the only useful kind.
:::

`maxCharsPerTool` is usually the highest-value one. Tool output is what inflates
a history fastest and what ages worst — the model rarely needs a whole file ten
turns later.

## What is never cut

The leading `system` messages. They are the agent's prompt and the projection of
`ctx.state.memory`, and cutting them would break the agent rather than save
anything.

Preserving the head has a second benefit: it keeps the prefix stable for the
provider's prompt cache. Trimming from the top would invalidate the discount
every turn.

## Say that you cut

```ts
contextWindow({
  maxTurns: 12,
  notice: "[…previous history omitted to fit the window…]",
});
```

An explicit note beats a silent jump. Without it the model sees the conversation
start in the middle and may repeat work it already did.

`false` cuts silently. Use it only when you have measured that the note itself is
confusing the model.

::: tip It used to be called `warnIndexFailure`
Renamed to `notice` in **0.12.0**. The old name held the notice text without its
name suggesting anything of the sort — it came from an automated rename that
walked across files, and `warnIndexFailure` is really the handler for a failure
to write the report index, elsewhere in the codebase.

`warnIndexFailure` still works, marked `@deprecated`, so nothing breaks on
upgrade. When both are given, `notice` wins.
:::

## Trimming at the source

Middleware is the general answer, but the cheapest fix is often in the tool:

```ts
const MAX = 4000;
return text.length <= MAX ? text : `${text.slice(0, MAX)}\n… [truncated]`;
```

A tool that returns a budget rather than everything it found keeps the history
small in the first place — and it can truncate intelligently, which a generic
character cut cannot. See [Tool design](/en/techniques/tool-design).

## Summarising instead of dropping

For a long-running conversation, dropping loses information a summary would keep.
There is no built-in summariser; the shape is a `chat` middleware or an
`afterResponse` hook that folds old turns into `ctx.state.memory`:

```ts
export class WorkerAgent {
  async afterResponse(response: string, ctx: Context) {
    if (ctx.state.history.length < 20) return;

    const old = ctx.state.history.slice(0, -8);
    ctx.state.set("history", ctx.state.history.slice(-8));
    ctx.state.append("memory", `Earlier: ${await summarise(old)}`);
  }
}
```

Because `memory` becomes a `system` message at the top, it survives any later
trimming.

## Other levers

**`numCtx`** (Ollama only) sets the model's window itself. Raising it costs
memory and time; it does not make a bloated history a good idea.

**Isolate the noisy part.** A subtask that takes ten rounds to produce one line
belongs in a [nested run](/en/techniques/nested-runs) — the parent sees one
string instead of ten turns. Often this beats trimming entirely.

## Related

- [Middleware and plugins](/en/fundamentals/middleware)
- [Tool design](/en/techniques/tool-design)
- [Nested runs](/en/techniques/nested-runs)
- [Performance](/en/best-practices/performance)
