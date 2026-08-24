# Prompt design

The prompt is a markdown file next to the agent. It is the highest-leverage file
in the project, and the one most likely to be treated casually.

```md
<!-- src/agents/explorer/explorer.agent.md -->

You explore software projects.

Use the tools to investigate before answering. Prefer reading over guessing.

Answer in one short paragraph. If you are not sure, say so.
```

## Say what to do, not what not to do

Models follow positive instructions far better than prohibitions.

```md
✗ Do not answer without reading the files.
✓ Before answering, read the relevant files.
```

A prompt that is a list of things not to do also tends to grow forever, because
every new failure adds a line.

## Tell it to act

The single most common cause of "it described what it would do instead of doing
it" is a prompt that never told it to act. The tools being present is not an
instruction.

```md
Before answering, read the relevant files with `read_file`.
```

The second most common cause is the tool's `description` — see
[Tool design](/en/techniques/tool-design).

## Give the stopping condition a shape

When a loop's `until` reads a decision out of the response, the prompt must make
that decision unambiguous:

```md
If the work meets all the criteria, reply exactly `APPROVED` and nothing else.
Otherwise, list what is missing.
```

```ts
this.state.approved = /\bAPPROVED\b/.test(response);
```

::: tip Give a critic a way to say yes
A reviewer prompted only to find problems will always find one, and the loop
never converges. State the passing condition explicitly.
:::

## Structure with headings

Markdown is not decoration — it is structure the model uses:

```md
You review pull requests for security problems.

## What to check

- input validation on anything reaching a query
- secrets in code or config

## How to answer

Reply `APPROVED`, or a numbered list of problems with file and line.
```

Short sections beat one paragraph. A wall of text buries the instruction that
matters.

## Put examples in, but few

One or two concrete examples of the *output format* is usually worth more than
three paragraphs describing it. Beyond that you are spending context on every
turn for diminishing returns — and examples are what a `contextWindow()` cannot
trim, because they are in the `system` message.

## What does not belong in the prompt

**Control flow.** "After three attempts, stop" belongs in `until` and
`maxIterations`, where it is enforced rather than hoped for.

**Secrets.** Everything in the prompt goes to the model and into the report. Use
[`run({ data })`](/en/fundamentals/state-and-context#memory-vs-data).

**Per-run facts.** A user's name, a plan, an account — those go in
`run({ state })`, which becomes a `system` message. The `.md` is the same for
every run.

**Tool descriptions.** Describe the tool in its `@Tool({ description })`. Saying
it twice means keeping two copies in sync.

## Iterating

Pin sampling first, or you cannot tell a real improvement from luck:

```ts
sampling: { temperature: 0, seed: 42 }
```

Then change **one thing at a time**, and read the actual prompt the model
received:

```ts
log: "verbose";
```

That prints the final prompt — after `beforePrompt`, after the state projection.
Most surprises turn out to be something appended that you forgot about, not the
`.md`.

## Per-agent sampling

Prompt and sampling work together. A prompt asking for careful analysis fights a
`temperature: 0.9`:

```ts
@Agent({ provider: Shared, prompt: "./planner.agent.md",
         sampling: { temperature: 0 } })
export class PlannerAgent {}

@Agent({ provider: Shared, prompt: "./writer.agent.md",
         sampling: { temperature: 0.8 } })
export class WriterAgent {}
```

Determinism where a decision is made, variety where prose is written.

## Length

Shorter is usually better, but the real rule is that **every line should earn its
place**. A prompt that has grown to 200 lines through incident-driven patches is
a prompt nobody understands any more, and the model probably does not either.

When a prompt gets long because it is holding two jobs, that is the signal to
split the agent — see [Architecture](/en/best-practices/architecture).

## Model differences are real

A prompt tuned on `gpt-4o` will not behave identically on `qwen2.5-coder:7b`.
Smaller models need more explicit instruction, fewer simultaneous constraints,
and fewer tools to choose between.

`toolCallSource: "rescued"` in the report is the measurable version of "this
model is at its limit for this task".

## Related

- [Agents](/en/fundamentals/agents)
- [Tool design](/en/techniques/tool-design)
- [Loops](/en/techniques/loops)
- [Debugging](/en/devtools/debugging)
