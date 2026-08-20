# Environment variables

**ThenaJS reads none.** There is no `THENA_*` to learn, no `.env` convention, no
implicit fallback to `OPENAI_API_KEY`.

That is deliberate. The framework never reaches for a global, which is what lets
two providers in one process use two different keys — and what makes
[multi-tenancy](/en/deployment/multi-tenancy) work at all.

## Where configuration actually comes from

| Setting | Where |
| --- | --- |
| API key, host, model | your provider class or factory |
| log, report, redaction, vector stores | `ThenaConfig` |
| budget, cancellation, per-run overrides | `app.run({ … })` |

Environment variables are your application's business, and you read them where
you want:

```ts
export class GptProvider extends OpenAIProvider {
  constructor() {
    super({
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    });
  }
}
```

## Fail at startup, not mid-run

`process.env.X!` silently becomes `undefined` and fails on the first model call —
one turn into a run that has already spent money.

Validate once, at boot:

```ts
// src/env.ts
import { z } from "zod";

export const env = z
  .object({
    OPENAI_API_KEY: z.string().min(1),
    OLLAMA_HOST: z.string().url().default("http://localhost:11434"),
    QDRANT_URL: z.string().url().optional(),
  })
  .parse(process.env);
```

```ts
import { env } from "../env";

super({ apiKey: env.OPENAI_API_KEY, model: "gpt-4o-mini" });
```

Zod is already a dependency, since tool schemas use it.

## What belongs in the environment

- credentials — API keys, vector store keys
- endpoints — the Ollama host, an internal gateway
- the model name, when it differs between environments
- your own feature flags

## What does not

**Prompts.** They belong in `.md` files next to the agent, which is the whole
point of the split. A prompt in an environment variable cannot be diffed,
reviewed or read as prose.

**Budgets and limits.** They belong to the run, and are usually derived from the
tenant or plan rather than from the deployment.

**Secrets you pass to the model.** An API key that reaches a prompt reaches the
report too. Redaction catches the well-known shapes as a safety net, but the fix
is not putting it there — use
[`run({ data })`](/en/fundamentals/state-and-context#memory-vs-data).

## In containers

Provide them as real environment variables rather than a baked-in `.env` file:

```yaml
services:
  agent:
    image: my-agent
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OLLAMA_HOST: http://ollama:11434
```

`localhost` inside a container is the container. A local Ollama is a separate
service and needs its service name, or the host's address.

## Local development

The framework has no `.env` loader. Node 20.6+ has one built in:

```bash
node --env-file=.env dist/main.js
```

Or `tsx --env-file=.env src/main.ts` in development. Either way, `.env` goes in
`.gitignore` — the CLI's generated project already ignores it.

## Related

- [Configuration](/en/get-started/configuration)
- [Production](/en/deployment/production)
- [Security](/en/best-practices/security)
- [Multi-tenancy](/en/deployment/multi-tenancy)
