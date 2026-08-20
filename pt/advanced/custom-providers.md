# Providers próprios

Qualquer API vira provider. Você implementa a tradução; a classe base cuida do
resto — inclusive de detectar tool calls, que é a parte chata.

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

export class MeuProvider extends Providers {
  private readonly apiKey: string;

  constructor(c: Creds) {
    super();
    this.configure(c); // absorve sampling, retry, custo, raw…
    this.apiKey = c.apiKey;
  }

  protected async chatInternal(
    tools: ToolType[],
    messages: Message[],
    sampling?: SamplingParams,
  ): Promise<RawAssistant> {
    const { response, attempts } = await this.request("https://api.exemplo/chat", {
      method: "POST",
      headers: { "x-api-key": this.apiKey },
      body: JSON.stringify({
        messages: messages.map(paraOFormatoDeles),
        tools: tools.map(paraOFormatoDeTool),
        ...this.paraOSamplingDeles(sampling),
      }),
    });

    if (!response.ok) throw new Error(`falhou (${response.status})`);
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

## Três regras

**Chame `this.configure(credentials)` no construtor.** Ele absorve `sampling`,
`retry`, `costPer1kTokens`, `raw` e `rescueToolCalls`. Esquecer isso perde a
política de retry em silêncio — que é exatamente a falha que ele existe para
evitar.

**Use `this.request()`, não `fetch`.** O `Providers` estende `HttpTransport`,
então o `request()` dá retry, backoff, `Retry-After` e timeout de graça, e
devolve a contagem de `attempts` que você deve repassar.

**Devolva `attempts`.** Ele chega ao nó `chat` do report, e é como alguém mede se
o seu backend está instável.

## `RawAssistant`

O que o framework precisa de volta:

| Campo | Observações |
| --- | --- |
| `content` | o texto. String vazia se o modelo só chamou uma tool |
| `toolCalls` | o formato do próprio provider; o framework normaliza |
| `usage` | `{ promptTokens, completionTokens }`, quando reportado |
| `attempts` | vindo do `this.request()` |

::: tip Dois tipos `ToolCall` diferentes
`ProviderToolCall` é o formato do lado do provider
(`{ id, name, arguments, source }`). O `ToolCall` que os hooks recebem é
`{ name, args }`. Não confunda.
:::

Se o seu backend embrulha tool calls num envelope incomum, o
`normalizeToolCallEnvelope` trata os formatos comuns. Se ele as emite como texto,
o `parser` tem os extratores que o resgate embutido usa.

## Sampling

O `SamplingParams` é um shape neutro; você traduz. O `pruneUndefined` evita mandar
chaves que o usuário nunca definiu:

```ts
private paraOSamplingDeles(s: SamplingParams = {}) {
  return pruneUndefined({
    temperature: s.temperature,
    top_p: s.topP,
    seed: s.seed,
    max_tokens: s.maxTokens,
    stop: s.stop,
  });
}
```

Ignore o que o seu backend não suporta, em vez de lançar — `topK`, `numCtx` e
`repeatPenalty` são só do Ollama, e um agente que define um deles não deveria
quebrar em outro provider.

O `this.raw` é mesclado no body depois, que é como um usuário alcança um
parâmetro que o seu mapeamento neutro não cobre.

## Embeddings

Sobrescreva `embed()` se o backend suportar:

```ts
async embed(texto: string): Promise<number[]> {
  const { response } = await this.request(`${this.host}/embeddings`, {
    method: "POST",
    headers: { "x-api-key": this.apiKey },
    body: JSON.stringify({ model: this.embedModel, input: texto }),
  });
  const data = await response.json();
  return data.embedding;
}
```

É o que a [memória vetorial](/pt/techniques/vector-memory) chama. Sem isso, um
store apoiado neste provider não consegue indexar nada.

## Streaming

Streaming é opcional. Um provider que ignora o sink de token continua
funcionando — o texto simplesmente chega inteiro no resultado, e o `textStream`
fica vazio.

Para suportar, emita cada pedaço conforme chega e ainda assim devolva o
`RawAssistant` completo no fim. O framework é responsável pelo canal e pelo buffer
de replay; você é responsável apenas por chamar o sink.

## Um endpoint compatível com a OpenAI não precisa de código

Antes de escrever um provider, confira se a API fala o protocolo da OpenAI —
vLLM, LM Studio, Together, Groq e a maioria dos gateways falam:

```ts
export class MeuGateway extends OpenAIProvider {
  constructor() {
    super({
      apiKey: process.env.GATEWAY_KEY!,
      host: "https://meu-gateway.interno/v1",
      model: "llama-3.3-70b",
    });
  }
}
```

## Testando

Um provider é uma classe com um método, então testa sem o framework:

```ts
const p = new MeuProvider({ apiKey: "test" });
const out = await p.chat([], [{ role: "user", content: "oi" }]);
expect(out.content).toBe("olá");
```

E num agente, uma tradução ruim aparece como `toolCallSource: "rescued"` em todo
nó `chat` — sinal de que o seu mapeamento de tool call está errado, e não de que
o modelo é fraco.

## Relacionado

- [Providers](/pt/fundamentals/providers) — o conceito
- [Referência de Providers](/pt/reference/providers) — as credenciais completas
- [Transporte HTTP](/pt/advanced/http-transport)
