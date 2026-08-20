# Retry e timeout

**O retry vem ligado.** Um `429` ou um `503` momentâneo são reexecutados até 3
vezes, com espera crescente.

É uma exceção deliberada à regra usual do framework de "mecanismo, não política":
uma falha transitória de rede derrubando uma execução inteira quase nunca é o que
alguém quer.

```ts
super({
  host,
  model,
  retry: {
    maxAttempts: 5,
    timeoutMs: 120_000,
  },
});
```

`retry: false` desliga.

## A política

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

O backoff é exponencial a partir de `initialDelayMs`, multiplicado por `factor`,
limitado por `maxDelayMs`. Com os defaults: 500ms, 1s, 2s.

`respectRetryAfter` significa obedecer um provider que diz quando voltar — o que
importa mais que a sua curva de backoff numa API com rate limit.

## Timeout é opt-in, e essa é a armadilha

::: warning O `timeoutMs` não tem default
Um teto arbitrário abortaria um modelo local lento que hoje funciona.
:::

A falha que isso causa vale reconhecer: **uma execução que morre com
`fetch failed` depois de uns 300 segundos**. A requisição ficou pendurada, nada
rejeitou, então o retry nunca disparou — o limite de socket do próprio runtime
acabou matando.

```ts
retry: { maxAttempts: 3, timeoutMs: 120_000 }
```

Escolha um valor acima do que seu modelo leva no pior caso. Um teto curto demais
aborta trabalho legítimo, e cada abort custa uma tentativa inteira.

Pontos de partida grosseiros: uma API hospedada costuma ficar bem abaixo de 60s;
um modelo 7B local em CPU pode levar minutos numa geração longa.

## Vendo acontecer

```ts
retry: {
  maxAttempts: 5,
  onRetry: (info) => console.warn(`[retry] tentativa ${info.attempt}`),
}
```

Sem `onRetry`, os retries são invisíveis — uma execução que silenciosamente levou
três tentativas é idêntica a uma que funcionou de primeira, exceto pela duração.

O provider também reporta `attempts` na resposta, que chega ao nó `chat` do
report.

## Decidindo o que é retentável

O default cobre os casos HTTP transitórios. Sobrescreva quando o seu backend
sinaliza diferente:

```ts
retry: {
  isRetryable: (info) =>
    info.status === 429 ||
    info.status === 503 ||
    info.error?.name === "AbortError",
}
```

Cuidado ao tornar retentável algo não idempotente. Esta política vale para a
chamada ao modelo, que é segura de repetir — mas o mesmo `HttpTransport` está por
trás de um banco vetorial próprio, onde uma
gravação retentada pode não ser.

## Vale para bancos vetoriais também

`Providers` e `VectorStore` estendem `HttpTransport`, então um store herda a
política sem código:

```ts
export class MemoriaDoProjeto extends QdrantStore {
  constructor() {
    super({
      url: "http://localhost:6333",
      collection: "projeto",
      retry: { maxAttempts: 3, timeoutMs: 5_000 },
    });
  }
}
```

Um banco vetorial merece um timeout **muito** mais curto que um modelo — ele
deveria responder em milissegundos, então um teto de 5 segundos já é generoso.

## Retry não é o modelo tentando de novo

Duas coisas diferentes que ambas são chamadas de "retry":

| | Política de retry | O laço do agente |
| --- | --- | --- |
| Repete | a chamada HTTP | o raciocínio do modelo |
| Porque | a rede falhou | uma tool devolveu erro |
| Configurado por | `retry` no provider | `loop({ maxIterations })` |
| Custa | uma tentativa, mesmos tokens | um turno inteiro a mais |

Uma tool que falha **não** dispara a política de retry — aquela falha é uma
observação que o modelo lê, e a próxima tentativa é um turno novo. Veja
[Erros](/pt/fundamentals/errors).

## Nas suas próprias tools

O framework retenta as chamadas HTTP dele, não as suas. Uma tool que chama uma
API externa é dona da própria política — e deve repassar o signal da execução,
para que retentar não sobreviva a um cancelamento:

```ts
async execute(@input() { url }: { url: string }, @context() ctx: Context) {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const res = await fetch(url, { signal: ctx.signal });
      if (res.ok) return res.text();
    } catch (err) {
      if (ctx.signal.aborted) throw err;      // não retente um cancelamento
      if (tentativa === 3) {
        return { content: `Serviço indisponível após 3 tentativas.`, isError: true };
      }
    }
  }
}
```

## Relacionado

- [Providers](/pt/fundamentals/providers)
- [Referência de Providers](/pt/reference/providers) — o `RetryPolicy` completo
- [Transporte HTTP](/pt/advanced/http-transport)
- [Erros](/pt/fundamentals/errors)
