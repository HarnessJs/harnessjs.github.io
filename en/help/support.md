# Support

## Before you ask

Two minutes here usually answers it, and always makes the question better:

1. **Turn on `log: "verbose"`.** It prints the prompt, the response and the tool
   I/O. Most "why did it do that" questions end here.
2. **Turn on `report: true`** and open `report/index.html`. The tree shows which
   step went wrong, how long it took, and what it cost.
3. **Check [Troubleshooting](/en/help/troubleshooting)** — it covers the errors
   people hit most.
4. **Check the [FAQ](/en/help/faq)** for behaviour that is working as designed.

## Where to ask

| | |
| --- | --- |
| **Bug, or something that looks like one** | [github.com/thenajs/ThenaJS/issues](https://github.com/thenajs/ThenaJS/issues) |
| **Question, idea, "is this supposed to…"** | [GitHub Discussions](https://github.com/thenajs/ThenaJS/discussions) |
| **A problem with these docs** | [thenajs/thenajs.github.io](https://github.com/thenajs/thenajs.github.io/issues) |
| **Something security-sensitive** | see [SECURITY.md](https://github.com/thenajs/ThenaJS/blob/main/SECURITY.md) — do not open a public issue |

## What makes a good report

Attach the run's `report/<runId>/report.json`. It carries the whole execution
tree — every agent, model call and tool call, with durations, token usage and
status — and it is far more useful than a description of what you saw.

::: warning Read it before you attach it
Secret redaction is on by default and catches known patterns (`Bearer …`, `sk-…`,
`ghp_…`, JWTs, connection strings, fields named like `api_key`). It does not catch
a customer's name or a private URL. If the run touched real data, use
`report: { content: false }` to reproduce it — that keeps the tree, the durations
and the telemetry, and drops the text.
:::

Also worth including:

- the **model and provider** (`qwen2.5-coder:7b` on Ollama, `gpt-4o-mini`, …) —
  a lot of agent behaviour is model behaviour;
- your **`ThenaConfig`** and the `@Workflow` declaration;
- the **versions**: `node --version` and the `@thenajs/*` version from your
  `package.json`;
- what you expected instead.

## Contributing

The framework and the docs are separate repositories:

- **Framework** — [thenajs/ThenaJS](https://github.com/thenajs/ThenaJS). Start
  with [CONTRIBUTING.md](https://github.com/thenajs/ThenaJS/blob/main/CONTRIBUTING.md).
- **Docs** —
  [thenajs/thenajs.github.io](https://github.com/thenajs/thenajs.github.io). Every
  page has a "Suggest a change to this page" link at the bottom that opens the
  right file.

A page written in one language needs its counterpart in the other; `npm run check`
in the docs repo enforces that, along with link and structure validation.

## Project status

0.9.x, pre-1.0, and moving. The API in these docs is what ships today. Expect
breaking changes between minor versions, and read the
[migration notes](/en/help/migration) when you upgrade.

Released under the MIT License.
