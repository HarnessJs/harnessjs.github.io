# Redaction

Secret masking on captured content — prompt, response, tool I/O and error
messages — before any of it reaches the report, the log or a plugin.

**It is on by default.** A file on disk, with no retention policy and no access
control, is the worst place for a secret to surface by accident.

## What the default catches

`redactSecrets` knows a set of well-known patterns:

- `Bearer …` authorization headers
- connection strings with a password
- OpenAI-style keys (`sk-…`)
- GitHub tokens (`ghp_…`)
- JWTs
- fields named like `api_key`, `password`

```ts
export const config: ThenaConfig = { redact: true }; // the default
```

## Configuring it

```ts
type RedactConfig = false | ((field: string, value: string) => string);
```

| Value | Effect |
| --- | --- |
| absent | `redactSecrets`, the known patterns |
| `false` | **off** — only if the report never leaves your machine |
| function | replaces the default entirely |

The `field` argument tells you what is being masked (`"prompt"`, `"response"`,
tool I/O, error), so a rule can apply to one kind of content and not others.

## Adding patterns without losing the defaults

A function **replaces** the default rather than extending it. Compose explicitly:

```ts
import { redactSecrets } from "@thenajs/core";

const INTERNAL_ID = /\bACC-\d{8}\b/g;

export const config: ThenaConfig = {
  redact: (field, value) => redactSecrets(value).replace(INTERNAL_ID, "ACC-********"),
};
```

Forgetting to call `redactSecrets` inside your own function silently turns off
everything it covered — the single most likely mistake on this page.

## What it cannot do

Redaction is regex over text. It catches things with a **recognisable shape**.

It does not catch a customer's name, an address, a free-form note, an internal
URL, or a secret with no distinguishing format. There is no regex for "personal
data".

For runs over real personal data, the tool is not a better pattern — it is not
writing the text at all:

```ts
await app.run({ input, report: { content: false } });
```

That keeps the tree, the durations and the telemetry, and drops every prompt,
response and tool payload. You still get the shape of the run, the cost and the
timings; you just cannot read what was said.

## Where it applies

| Sink | Redacted |
| --- | --- |
| `report` (HTML and JSON) | yes |
| `log`, including `"verbose"` | yes |
| plugin `onEvent` payloads | yes |
| the model's own context | **no** |
| `run({ data })` | not applicable — never captured |

That third row matters for a plugin author: what reaches `onEvent` is already
masked, so you cannot un-redact it, and you should not build a second masking
layer on top.

The fourth is the important one: redaction protects **what is recorded**, not
what is sent. A secret you put in a prompt still goes to the model. Keeping
things away from the model is what
[`run({ data })`](/en/fundamentals/state-and-context#memory-vs-data) is for.

## Using it outside the framework

`redactSecrets` is exported and is a plain `string => string`:

```ts
import { redactSecrets } from "@thenajs/core";

logger.info(redactSecrets(someText));
```

Useful when your tool logs something itself, on a path the framework never sees.

## Cost

Masking runs per captured field, on the recording path only. On a run with no
`report`, `log` or plugin, nothing is captured and nothing is masked.

If you have a very hot path and have measured that this matters, `false` turns it
off — but read the sentence at the top of this page again first.

## Related

- [`ThenaConfig`](/en/reference/thena-config)
- [Security](/en/best-practices/security)
- [Report](/en/devtools/report)
