# Transporte HTTP

O `HttpTransport` é a classe base sob tudo que fala com um serviço externo no
ThenaJS. `Providers` e `VectorStore` estendem os dois, então uma implementação
própria de qualquer um deles herda retry e timeout sem escrever nenhum.

```ts
import { HttpTransport } from "@thenajs/core";
```

## O que ele oferece

```ts
protected configureTransport(credentials?: TransportCredentials): void;
protected request(url: string, init?: RequestInit): Promise<{
  response: Response;
  attempts: number;
}>;
```

É essa a superfície inteira. O `request()` envolve o `fetch` com:

- **retry** em falhas transitórias, até `maxAttempts` (default 3)
- **backoff exponencial** a partir de `initialDelayMs`, vezes `factor`, limitado
  por `maxDelayMs`
- **`Retry-After`** honrado quando o servidor envia
- **timeout por tentativa**, via `AbortSignal.timeout`, quando `timeoutMs` é
  definido
- uma contagem de **`attempts`** devolvida junto com a resposta

## Usando

```ts
export class MeuCliente extends HttpTransport {
  constructor(credentials: TransportCredentials & { url: string }) {
    super();
    this.configureTransport(credentials); // ← não pule isto
    this.url = credentials.url;
  }

  async buscarCoisa(id: string) {
    const { response, attempts } = await this.request(`${this.url}/coisas/${id}`);
    if (!response.ok) throw new Error(`falhou (${response.status})`);
    return { coisa: await response.json(), attempts };
  }
}
```

::: warning O `configureTransport` é fácil de esquecer
Sem ele a instância mantém a política padrão em vez da que veio nas credentials —
então um `retry: false` ou um `timeoutMs` que o usuário configurou é ignorado em
silêncio. O método existe para tornar essa omissão explícita.
:::

## `TransportCredentials`

```ts
interface TransportCredentials {
  retry?: RetryPolicy | boolean; // default: ligado
}
```

Todo tipo de credentials do framework estende isso, que é por que o `retry`
funciona igual no `OllamaProvider`, no `OpenAIProvider` e no `QdrantStore`.

Veja [Retry e timeout](/pt/techniques/retries) para a política completa.

## Devolva `attempts`

```ts
return { content, toolCalls, usage, attempts };
```

Ele chega ao nó `chat` do report e é o único sinal de que uma execução levou três
tentativas em silêncio. Um provider que o descarta torna a instabilidade do
backend invisível.

## Timeouts diferentes para serviços diferentes

O teto certo depende inteiramente do que está do outro lado:

| Serviço | `timeoutMs` razoável |
| --- | --- |
| API de modelo hospedada | 60_000 |
| modelo local em CPU | 300_000, ou nenhum |
| banco vetorial | 5_000 |
| a sua própria API interna | o SLO dela |

O default é **sem timeout**, deliberadamente — um teto arbitrário abortaria um
modelo local lento que hoje funciona. O custo dessa escolha é a execução que
morre com `fetch failed` depois de uns 300 segundos, sem nunca ter retentado
porque nada rejeitou.

## Cancelamento

O `request()` não recebe o `AbortSignal` da execução. O timeout dele é por
tentativa e independente da execução.

Num provider, o signal da execução chega à chamada do modelo pelo encanamento do
próprio framework. Na sua tool ou no seu cliente, repasse o `ctx.signal`:

```ts
async execute(@input() { id }: { id: string }, @context() ctx: Context) {
  const res = await fetch(`${this.url}/coisas/${id}`, { signal: ctx.signal });
  return res.text();
}
```

Uma tool que não faz isso é o motivo mais comum de "o abort não funciona".

## Idempotência

O retry repete a requisição. Isso é seguro para leituras e para gravações com id
estável, e inseguro no resto. Para um endpoint não idempotente, estreite a
política:

```ts
retry: {
  isRetryable: (info) => info.status === 429 || info.status === 503,
}
```

Ou desligue para aquele cliente inteiro com `retry: false`.

## Quando não usar

O `HttpTransport` é para os pontos de extensão do framework — providers e bancos
vetoriais. Dentro de uma tool, `fetch` puro mais `ctx.signal` é mais simples e não
puxa uma hierarquia de classes para o que é, no fundo, uma função.

## Relacionado

- [Retry e timeout](/pt/techniques/retries)
- [Providers próprios](/pt/advanced/custom-providers)
- [Bancos vetoriais próprios](/pt/advanced/custom-vector-stores)
