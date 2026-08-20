# Providers

A provider is what talks to the model. ThenaJS ships Ollama and OpenAI; anything
else is a class you write.

```ts
// src/providers/ollama.provider.ts
import { OllamaProvider } from "@thenajs/core";

export class LocalOllamaProvider extends OllamaProvider {
  constructor() {
    super({
      host: "http://localhost:11434",
      model: "qwen2.5-coder:7b",
      sampling: { temperature: 0, seed: 42 },
    });
  }
}
```

The agent points at the **class**, so credentials live in exactly one place:

```ts
@Agent({ provider: LocalOllamaProvider, prompt: "./a.agent.md" })
export class MyAgent {}
```

## Determinism first

An agent is not a chat. You want the same input to produce the same decision —
otherwise you cannot tell whether a change improved the agent or you got lucky.

```ts
sampling: { temperature: 0, seed: 42 }
```

Measured on `qwen2.5-coder:1.5b`: the same question three times gave **three
different answers** with no `sampling`, and **three identical ones** with that
pair. `seed` only has an effect alongside a low temperature.

Once the agent is stable, raise the temperature where you want variety — per
agent, if you like:

```ts
@Agent({ provider: LocalOllamaProvider, prompt: "./writer.agent.md",
         sampling: { temperature: 0.8 } })
export class WriterAgent {}
```

The agent's `sampling` overrides the provider's key by key.

## OpenAI

```ts
import { OpenAIProvider } from "@thenajs/core";

export class GptProvider extends OpenAIProvider {
  constructor() {
    super({
      apiKey: process.env.OPENAI_API_KEY!,
      model: "gpt-4o-mini",
      sampling: { temperature: 0 },
      costPer1kTokens: { input: 0.00015, output: 0.0006 },
    });
  }
}
```

`costPer1kTokens` is optional and is what lets the report compute cost and
`budget.maxCostUsd` work. There is no built-in price table, deliberately — it
would go stale silently.

## Network failures

**Retry is on by default**: a `429` or a momentary `503` is retried up to 3
times with growing backoff. To adjust:

```ts
super({
  host,
  model,
  retry: { maxAttempts: 5, timeoutMs: 120_000 },
});
```

`retry: false` turns it off.

::: tip Timeout is opt-in
`timeoutMs` has no default, on purpose: an arbitrary ceiling would abort a slow
local model that works fine today. Turn it on when you want a hang to become a
recoverable failure instead of a suspended run.
:::

A run that dies with `fetch failed` after roughly 300 seconds hit the runtime's
own limit — the request hung and retry never fired, because nothing rejected.
That is the case `timeoutMs` exists for.

## The three ways an agent resolves a provider

```ts
provider: sharedInstance;      // configured once, shared by every run
provider: LocalOllamaProvider; // `new`ed with no arguments
provider: () => new OpenAIProvider({ apiKey: keyFor(context().data) });
```

The factory form is called **once per run**, inside the run's scope, so it can
read `context()`. That is how the key, model or endpoint comes from that run's
own data — the basis of multi-tenancy.

## Embeddings

`embed()` is public. Use it directly, or let
vector memory do it:

```ts
super({
  host,
  model,
  embedModel: "nomic-embed-text", // a model dedicated to embeddings
});

const vector = await new LocalOllamaProvider().embed("text");
```

Without `embedModel`, Ollama uses the chat model — and most chat models are not
good at this.

## Tool calls emitted as text

Small models sometimes write the tool call into the message body instead of the
structured field. The framework recovers those, in several formats, and you never
see it happen.

You can measure it: `toolCallSource` on the `chat` nodes in the report is
`"native"` or `"rescued"`. A lot of `rescued` means the model is at the edge of
what it can do.

## Writing your own

Any API becomes a provider. You implement the translation; the base class handles
the rest — including tool-call detection, which is the tedious part.

```ts
export class MyProvider extends Providers {
  constructor(c: ProviderCredentials & { apiKey: string }) {
    super();
    this.configure(c); // absorbs sampling, retry, cost…
    this.apiKey = c.apiKey;
  }

  protected async chatInternal(
    tools: ToolType[],
    messages: Message[],
    sampling?: SamplingParams,
  ): Promise<RawAssistant> {
    const { response, attempts } = await this.request("https://api.example/chat", {
      method: "POST",
      headers: { "x-api-key": this.apiKey },
      body: JSON.stringify({
        /* translate messages and tools */
      }),
    });

    if (!response.ok) throw new Error(`failed (${response.status})`);
    const data = await response.json();

    return {
      content: data.text ?? "",
      toolCalls: data.tool_calls,
      usage: { promptTokens: data.usage?.in, completionTokens: data.usage?.out },
      attempts,
    };
  }
}
```

Use `this.request()` rather than `fetch` to inherit retry and timeout.
