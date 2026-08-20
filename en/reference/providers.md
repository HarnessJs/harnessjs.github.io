# Providers

```ts
import { OllamaProvider, OpenAIProvider, Providers } from "@thenajs/core";
```

## Common credentials

Every provider extends `ProviderCredentials`:

```ts
interface ProviderCredentials extends TransportCredentials {
  sampling?: SamplingParams;
  raw?: Record<string, unknown>;
  rescueToolCalls?: boolean; // default true
  costPer1kTokens?: TokenCost;
}

interface TransportCredentials {
  retry?: RetryPolicy | boolean; // default: on
}
```

| Key | Notes |
| --- | --- |
| `sampling` | this provider's default sampling |
| `raw` | raw keys merged into the request body, for what `sampling` does not cover (`keep_alive`, `format`, `response_format`, `user`…) |
| `rescueToolCalls` | recover tool calls emitted as text. Turn **off** to diagnose: without the rescue, the text stays a final answer and it becomes obvious the model did not use the native format |
| `costPer1kTokens` | `{ input, output }`. Required for `costUsd` in the report and for `budget.maxCostUsd` |
| `retry` | see [`RetryPolicy`](#retrypolicy) |

There is no built-in price table, deliberately — it would go stale silently.

## `OllamaProvider`

```ts
type OllamaCredentials = ProviderCredentials & {
  host: string;
  model: string;
  embedModel?: string; // defaults to `model`
};
```

```ts
export class LocalOllamaProvider extends OllamaProvider {
  constructor() {
    super({
      host: "http://localhost:11434",
      model: "qwen2.5-coder:7b",
      embedModel: "nomic-embed-text",
      sampling: { temperature: 0, seed: 42 },
    });
  }
}
```

## `OpenAIProvider`

```ts
type OpenAICredentials = ProviderCredentials & {
  apiKey: string;
  host?: string; // default "https://api.openai.com/v1"
  model?: string; // default "gpt-4o-mini"
  embedModel?: string; // default "text-embedding-3-small"
};
```

The `host` default makes any OpenAI-compatible endpoint usable by pointing it
elsewhere.

## `SamplingParams`

A neutral shape, translated to each provider's own keys.

| Key | Notes |
| --- | --- |
| `temperature` | `0` is the usual starting point for deterministic tool calling |
| `topP` | nucleus sampling |
| `topK` | **Ollama only** |
| `seed` | with `temperature: 0`, the pair that gives repeatability |
| `maxTokens` | `num_predict` on Ollama, `max_tokens` on OpenAI |
| `numCtx` | context window size. **Ollama only** |
| `stop` | sequences that halt generation |
| `repeatPenalty` | **Ollama only** |

Set on the provider, on `@Agent({ sampling })`, or both — the agent's overrides
the provider's **key by key**.

## `RetryPolicy`

```ts
interface RetryPolicy {
  maxAttempts?: number; // default 3, including the first
  timeoutMs?: number; // NO default
  initialDelayMs?: number; // default 500
  maxDelayMs?: number; // default 8000
  factor?: number; // default 2
  respectRetryAfter?: boolean; // default true
  isRetryable?: (info: RetryAttempt) => boolean;
  onRetry?: (info: RetryAttempt) => void;
}
```

**Retry is on by default.** `retry: false` turns it off.

::: warning `timeoutMs` has no default
An arbitrary ceiling would abort a slow local model that works today. Without it,
a hung request never rejects, so retry never fires — which is the run that dies
with `fetch failed` after ~300 seconds. Set it above your model's worst case.
:::

## Embeddings

`embed()` is public:

```ts
const vector = await new LocalOllamaProvider().embed("text");
```

Without `embedModel`, Ollama uses the chat model — and most chat models are poor
at embeddings.

## Writing your own

```ts
export class MyProvider extends Providers {
  constructor(c: ProviderCredentials & { apiKey: string }) {
    super();
    this.configure(c); // absorbs sampling, retry, cost, raw…
    this.apiKey = c.apiKey;
  }

  protected async chatInternal(
    tools: ToolType[],
    messages: Message[],
    sampling?: SamplingParams,
  ): Promise<RawAssistant> {
    const { response, attempts } = await this.request(url, { … });
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

Use `this.request()` rather than `fetch` to inherit retry and timeout. `Providers`
extends `HttpTransport`, so the policy comes for free.

::: tip Two different `ToolCall` types
`ProviderToolCall` is the provider's shape (`{ id, name, arguments, source }`).
The `ToolCall` that hooks receive is `{ name, args }`. They are not the same type.
:::

Helpers for a custom provider: `parser`, `normalizeToolCallEnvelope`,
`pruneUndefined`.

See [Custom providers](/en/advanced/custom-providers).

## Related

- [Providers](/en/fundamentals/providers) — the concept
- [Retries and timeouts](/en/techniques/retries)
- [HTTP transport](/en/advanced/http-transport)
