# Providers

```ts
import { OllamaProvider, OpenAIProvider, Providers } from "@thenajs/core";
```

## Credenciais comuns

Todo provider estende `ProviderCredentials`:

```ts
interface ProviderCredentials extends TransportCredentials {
  sampling?: SamplingParams;
  raw?: Record<string, unknown>;
  rescueToolCalls?: boolean; // default true
  costPer1kTokens?: TokenCost;
}

interface TransportCredentials {
  retry?: RetryPolicy | boolean; // default: ligado
}
```

| Chave | Observações |
| --- | --- |
| `sampling` | o sampling padrão deste provider |
| `raw` | chaves cruas mescladas no body do request, para o que o `sampling` não cobre (`keep_alive`, `format`, `response_format`, `user`…) |
| `rescueToolCalls` | resgatar tool calls emitidas como texto. **Desligue** para diagnosticar: sem o resgate, o texto permanece resposta final e fica evidente que o modelo não usou o formato nativo |
| `costPer1kTokens` | `{ input, output }`. Necessário para o `costUsd` no report e para o `budget.maxCostUsd` |
| `retry` | veja [`RetryPolicy`](#retrypolicy) |

Não há tabela de preços embutida, de propósito — ela envelheceria em silêncio.

## `OllamaProvider`

```ts
type OllamaCredentials = ProviderCredentials & {
  host: string;
  model: string;
  embedModel?: string; // default: o `model`
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

O default de `host` torna qualquer endpoint compatível com a OpenAI utilizável,
apontando para outro lugar.

## `SamplingParams`

Um shape neutro, traduzido para as chaves de cada provider.

| Chave | Observações |
| --- | --- |
| `temperature` | `0` é o ponto de partida usual para tool calling determinístico |
| `topP` | nucleus sampling |
| `topK` | **Ollama apenas** |
| `seed` | com `temperature: 0`, o par que dá repetibilidade |
| `maxTokens` | `num_predict` no Ollama, `max_tokens` na OpenAI |
| `numCtx` | tamanho da janela de contexto. **Ollama apenas** |
| `stop` | sequências que interrompem a geração |
| `repeatPenalty` | **Ollama apenas** |

Defina no provider, no `@Agent({ sampling })`, ou nos dois — o do agente
sobrescreve o do provider **chave a chave**.

## `RetryPolicy`

```ts
interface RetryPolicy {
  maxAttempts?: number; // default 3, incluindo a primeira
  timeoutMs?: number; // SEM default
  initialDelayMs?: number; // default 500
  maxDelayMs?: number; // default 8000
  factor?: number; // default 2
  respectRetryAfter?: boolean; // default true
  isRetryable?: (info: RetryAttempt) => boolean;
  onRetry?: (info: RetryAttempt) => void;
}
```

**O retry vem ligado.** `retry: false` desliga.

::: warning O `timeoutMs` não tem default
Um teto arbitrário abortaria um modelo local lento que hoje funciona. Sem ele,
uma requisição pendurada nunca rejeita, então o retry nunca dispara — que é a
execução que morre com `fetch failed` depois de uns 300 segundos. Defina acima do
pior caso do seu modelo.
:::

## Embeddings

O `embed()` é público:

```ts
const vetor = await new LocalOllamaProvider().embed("texto");
```

Sem `embedModel`, o Ollama usa o modelo do chat — e a maioria dos modelos de chat
é ruim em embeddings.

## Escrevendo o seu

```ts
export class MeuProvider extends Providers {
  constructor(c: ProviderCredentials & { apiKey: string }) {
    super();
    this.configure(c); // absorve sampling, retry, custo, raw…
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

Use `this.request()` em vez de `fetch` para herdar retry e timeout. `Providers`
estende `HttpTransport`, então a política vem de graça.

::: tip Dois tipos `ToolCall` diferentes
`ProviderToolCall` é o formato do provider (`{ id, name, arguments, source }`). O
`ToolCall` que os hooks recebem é `{ name, args }`. Não são o mesmo tipo.
:::

Helpers para um provider próprio: `parser`, `normalizeToolCallEnvelope`,
`pruneUndefined`.

Veja [Providers próprios](/pt/advanced/custom-providers).

## Relacionado

- [Providers](/pt/fundamentals/providers) — o conceito
- [Retry e timeout](/pt/techniques/retries)
- [Transporte HTTP](/pt/advanced/http-transport)
