# Custom providers

Any API becomes a provider. You implement the translation; the base class handles
the rest — including tool-call detection, which is the tedious part.

```ts
import { Providers } from "@thenajs/core";
import type {
  ProviderCredentials,
  RawAssistant,
  ToolType,
  Message,
  SamplingParams,
} from "@thenajs/core";

type Creds = ProviderCredentials & { apiKey: string };

export class MyProvider extends Providers {
  private readonly apiKey: string;

  constructor(c: Creds) {
    super();
    this.configure(c); // absorbs sampling, retry, cost, raw…
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
        messages: messages.map(toTheirShape),
        tools: tools.map(toTheirToolShape),
        ...this.toTheirSampling(sampling),
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

## Three rules

**Call `this.configure(credentials)` in the constructor.** It absorbs `sampling`,
`retry`, `costPer1kTokens`, `raw` and `rescueToolCalls`. Forgetting it silently
loses the retry policy — which is exactly the failure it exists to prevent.

**Use `this.request()`, not `fetch`.** `Providers` extends `HttpTransport`, so
`request()` gives you retry, backoff, `Retry-After` and timeout for free, and
returns the `attempts` count you should pass back.

**Return `attempts`.** It reaches the `chat` node in the report, and it is how
anyone measures whether your backend is unstable.

## `RawAssistant`

What the framework needs back:

| Field | Notes |
| --- | --- |
| `content` | the text. Empty string if the model only called a tool |
| `toolCalls` | the provider's own shape; the framework normalises it |
| `usage` | `{ promptTokens, completionTokens }`, when reported |
| `attempts` | from `this.request()` |

::: tip Two different `ToolCall` types
`ProviderToolCall` is the provider-side shape (`{ id, name, arguments, source }`).
The `ToolCall` that hooks receive is `{ name, args }`. Do not mix them up.
:::

If your backend wraps tool calls in an unusual envelope,
`normalizeToolCallEnvelope` handles the common shapes. If it emits them as text,
`parser` has the extractors the built-in rescue uses.

## Sampling

`SamplingParams` is a neutral shape; you translate it. `pruneUndefined` keeps you
from sending keys the user never set:

```ts
private toTheirSampling(s: SamplingParams = {}) {
  return pruneUndefined({
    temperature: s.temperature,
    top_p: s.topP,
    seed: s.seed,
    max_tokens: s.maxTokens,
    stop: s.stop,
  });
}
```

Ignore what your backend does not support rather than throwing — `topK`,
`numCtx` and `repeatPenalty` are Ollama-only, and an agent that sets one should
not break on another provider.

`this.raw` is merged into the body afterwards, which is how a user reaches a
parameter your neutral mapping does not cover.

## Embeddings

Override `embed()` if the backend supports them:

```ts
async embed(text: string): Promise<number[]> {
  const { response } = await this.request(`${this.host}/embeddings`, {
    method: "POST",
    headers: { "x-api-key": this.apiKey },
    body: JSON.stringify({ model: this.embedModel, input: text }),
  });
  const data = await response.json();
  return data.embedding;
}
```

This is what [vector memory](/en/techniques/vector-memory) calls. Without it, a
store backed by this provider cannot index anything.

## Streaming

Streaming is optional. A provider that ignores the token sink still works — the
text simply arrives whole in the result, and `textStream` stays empty.

To support it, emit each chunk as it arrives while still returning the complete
`RawAssistant` at the end. The framework is responsible for the channel and the
replay buffer; you are only responsible for calling the sink.

## An OpenAI-compatible endpoint needs no code

Before writing a provider, check whether the API speaks OpenAI's protocol —
vLLM, LM Studio, Together, Groq and most gateways do:

```ts
export class MyGateway extends OpenAIProvider {
  constructor() {
    super({
      apiKey: process.env.GATEWAY_KEY!,
      host: "https://my-gateway.internal/v1",
      model: "llama-3.3-70b",
    });
  }
}
```

## Testing it

A provider is a class with one method, so it tests without the framework:

```ts
const p = new MyProvider({ apiKey: "test" });
const out = await p.chat([], [{ role: "user", content: "hi" }]);
expect(out.content).toBe("hello");
```

And in an agent, a bad translation shows up as `toolCallSource: "rescued"` on
every `chat` node — a sign your tool-call mapping is wrong, not that the model is
weak.

## Related

- [Providers](/en/fundamentals/providers) — the concept
- [Providers reference](/en/reference/providers) — full credential shapes
- [HTTP transport](/en/advanced/http-transport)
