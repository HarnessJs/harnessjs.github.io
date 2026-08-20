# Providers

Um provider é quem conversa com o modelo. O ThenaJS traz Ollama e OpenAI;
qualquer outro é uma classe que você escreve.

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

O agente aponta para a **classe**, então as credenciais ficam num lugar só:

```ts
@Agent({ provider: LocalOllamaProvider, prompt: "./a.agent.md" })
export class MeuAgente {}
```

## Determinismo primeiro

Agente não é chat. Você quer que a mesma entrada produza a mesma decisão — senão
não dá para saber se uma mudança melhorou o agente ou se foi sorte.

```ts
sampling: { temperature: 0, seed: 42 }
```

Medimos num `qwen2.5-coder:1.5b`: a mesma pergunta 3 vezes deu **3 respostas
diferentes** sem `sampling`, e **3 idênticas** com esse par. O `seed` só tem
efeito junto da temperatura baixa.

Depois que o agente estiver estável, suba a temperatura onde quiser variedade —
inclusive por agente:

```ts
@Agent({ provider: LocalOllamaProvider, prompt: "./escritor.agent.md",
         sampling: { temperature: 0.8 } })
export class EscritorAgent {}
```

O `sampling` do agente sobrescreve o do provider chave a chave.

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

O `costPer1kTokens` é opcional e é o que faz o report calcular custo e o
`budget.maxCostUsd` funcionar. Não há tabela de preços embutida, justamente para
não envelhecer em silêncio.

## Falhas de rede

**Retry vem ligado**: um `429` ou um `503` momentâneo são reexecutados até 3
vezes, com espera crescente. Para ajustar:

```ts
super({
  host,
  model,
  retry: { maxAttempts: 5, timeoutMs: 120_000 },
});
```

`retry: false` desliga.

::: tip Timeout é opt-in
`timeoutMs` não tem default, de propósito: um teto arbitrário abortaria um modelo
local lento que hoje funciona. Ligue quando quiser que um travamento vire falha
recuperável em vez de uma execução pendurada.
:::

Uma execução que morre com `fetch failed` depois de uns 300 segundos bateu no
limite do próprio runtime — a requisição ficou pendurada e o retry nunca disparou,
porque nada rejeitou. É para esse caso que o `timeoutMs` existe.

## As três formas de o agente resolver um provider

```ts
provider: instanciaCompartilhada; // configurada uma vez, compartilhada
provider: LocalOllamaProvider; // `new`, sem argumentos
provider: () => new OpenAIProvider({ apiKey: chaveDe(context().data) });
```

A factory é chamada **uma vez por execução**, dentro do escopo dela, então pode
ler `context()`. É como chave, modelo e endpoint saem dos dados daquela execução
— a base do multi-tenancy.

## Embeddings

O `embed()` é público. Use direto, ou deixe a memória vetorial cuidar disso:

```ts
super({
  host,
  model,
  embedModel: "nomic-embed-text", // modelo dedicado a embeddings
});

const vetor = await new LocalOllamaProvider().embed("texto");
```

Sem `embedModel`, o Ollama usa o modelo do chat — e a maioria dos modelos de chat
não serve para isso.

## Tool calls emitidas como texto

Modelos pequenos às vezes escrevem a tool call no corpo da mensagem, em vez de
usar o campo estruturado. O framework recupera essas chamadas, em vários
formatos, e você nunca vê acontecer.

Dá para medir: o `toolCallSource` nos nós `chat` do report é `"native"` ou
`"rescued"`. Muito `rescued` significa que o modelo está no limite do que dá
conta.

## Escrevendo o seu

Qualquer API vira provider. Você implementa a tradução; a classe base cuida do
resto — inclusive de detectar tool calls, que é a parte chata.

```ts
export class MeuProvider extends Providers {
  constructor(c: ProviderCredentials & { apiKey: string }) {
    super();
    this.configure(c); // absorve sampling, retry, custo…
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
        /* traduza messages e tools */
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

Use `this.request()` em vez de `fetch` para herdar retry e timeout.

## Relacionado

- [Agentes](/pt/fundamentals/agents)
- [A execução](/pt/fundamentals/the-run)
- [Erros](/pt/fundamentals/errors)
