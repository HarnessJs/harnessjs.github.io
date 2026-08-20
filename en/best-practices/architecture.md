# Architecture

How to lay out a ThenaJS project, and where to put a decision so it stays where
you put it.

## The file layout

The CLI's shape, and it holds up:

```
src/
  agents/
    explorer/
      explorer.agent.ts       # the class
      explorer.agent.md       # the prompt
  tools/
    read-file.tool.ts
  providers/
    ollama.provider.ts
  workflows/
    explorer.workflow.ts
    explorer.state.ts         # the state class, next to its workflow
  config.ts
  main.ts
```

**One folder per agent**, because the `.ts` and `.md` are one unit and the path
in `prompt: "./x.agent.md"` resolves from the agent's file.

**State next to its workflow**, because it is meaningless without it.

**`main.ts` only wires**: create the app, register plugins, run, dispose.
Anything that decides *what the agent does* belongs in an agent, a tool or a
workflow.

## Where a decision belongs

The question that comes up constantly: *"where does this logic go?"*

| The logic is… | Put it in |
| --- | --- |
| how the agent should behave | the `.md` prompt |
| an action the model may choose | a `@Tool` |
| the order of the steps | `@Workflow({ steps })` |
| when to stop repeating | the `loop`'s `until` |
| a decision one step passes to another | `@Workflow({ state })` |
| something one agent does around its turn | a hook |
| something *every* agent does | a plugin middleware |
| what this run carries but the model must not see | `run({ data })` |
| what the model must know for this run | `run({ memory })` |

Two failure modes come from getting this wrong: control flow written into prompts
("if you have already checked three files, stop"), and prompt content written
into code (a `beforePrompt` that assembles instructions a `.md` should hold).

## Prompt in markdown, logic in TypeScript

The split is the framework's central bet:

```ts
@Agent({ provider: P, tools: [ReadFileTool], prompt: "./explorer.agent.md" })
export class ExplorerAgent {}
```

Prompts change constantly and for different reasons than code does. In a `.md`,
a prompt tweak is a prompt diff — it reviews as prose, because it is prose.

The corollary: **do not build prompts in code.** A `beforePrompt` that appends
retrieved context is right; one that assembles the agent's instructions from
string fragments has moved the prompt back into TypeScript, and lost the benefit.

## Control flow is code, not prose

Anything the model could get wrong, and that you cannot afford it to get wrong,
belongs in the workflow rather than in the prompt.

```ts
// ✗ in the prompt: "After reviewing, if approved, stop."
// ✓ in the workflow:
loop({
  steps: [ExecutorAgent, ReviewerAgent],
  until: (_ctx, s: ReviewState) => s.approved,
  maxIterations: 5,
});
```

The prompt asks the reviewer to *say* APPROVED. The code decides what that
*means*. A regex over prose in three places is what you get for skipping the
state class.

## Start with one agent

The instinct to split early is usually wrong. Every extra agent is another prompt
to maintain and at least one more model call per run.

Split when you can name the reason: different tools, different sampling,
different model, or one must judge the other. Every split should make some prompt
**shorter** — if they all got longer, it was the wrong cut. See
[Multi-agent systems](/en/techniques/multi-agent-systems).

## Shared history or isolation

The other structural decision, and it repeats at every level:

| | Step in the workflow | Tool starting a nested run |
| --- | --- | --- |
| History | shared with the parent | its own |
| Output becomes | an `assistant` turn | a tool observation |
| Who decides it runs | you | the model |
| Context cost | every turn | one string |

**Shared** when the parent must see the path. **Isolated** when only the result
matters, or the subtask is noisy. See
[Nested runs](/en/techniques/nested-runs).

## Keep tools pure by default

A tool that takes only `@input()` is a plain function — testable with `new` and a
call, no framework involved:

```ts
expect(await new ReadFileTool().execute({ path: "x" })).toBe("…");
```

Each `@context()` or `@state()` trades that away. Add them when you actually need
the signal, the state or a nested run.

## Two apps beat one branching app

The workflow shape is compiled at `Thena.create` and cannot change per run. When
two request types need different shapes, build two:

```ts
const quick = Thena.create(QuickWorkflow, config);
const deep = Thena.create(DeepWorkflow, config);
```

They are cheap — `create` is synchronous and does no I/O — and this beats one
workflow with an agent that does nothing half the time.

## What belongs outside the framework

Persistence, authentication, rate limiting, queueing, retries of your *own*
services, and the HTTP layer. ThenaJS runs agents; it is not an application
framework.

`run({ memory })` is seeded by you and does not persist. If a conversation must
survive between runs, your application loads it and passes it in.

## Related

- [Multi-agent systems](/en/techniques/multi-agent-systems)
- [State and context](/en/fundamentals/state-and-context)
- [Prompt design](/en/best-practices/prompt-design)
- [Testing](/en/best-practices/testing)
