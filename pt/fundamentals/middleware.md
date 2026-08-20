# Middleware e plugins

[Hooks](/pt/fundamentals/hooks) pertencem a uma classe de agente. Middleware
envolve **cada** execução de tool e **cada** chamada ao modelo do app — que é o
que você quer para um cache, um rate limiter, métrica, ou uma checagem de
autorização.

Os dois entram pela mesma porta:

```ts
const app = Thena.create(MeuWorkflow, config);
await app.use(meuPlugin);
```

## Um plugin

```ts
export interface ThenaPlugin {
  name: string;
  setup?(): void | Promise<void>;
  onEvent?(event: ExecutionEvent): void;
  tool?: ToolMiddleware;
  chat?: ChatMiddleware;
  dispose?(): void | Promise<void>;
}
```

Dois modos, combináveis no mesmo plugin:

- **observar** — o `onEvent` recebe o mesmo stream que o `log`. Isolado: se
  lançar, a exceção é engolida e nem a execução nem os outros plugins são
  afetados.
- **interceptar** — `tool` e `chat` envolvem cada execução e **participam**. Um
  `throw` dali derruba a execução, e devolver sem chamar `next()` substitui a
  execução.

Vários plugins coexistem, e nenhum toma o lugar do outro nem do `log` do config.
Chame `use` antes do `run`.

O `setup` roda uma vez, dentro do `use()`. Se lançar, o `use()` rejeita — falha
de configuração deve aparecer antes da execução, não no meio dela.

## A cebola

Middleware tem o formato do koa: cada camada recebe a invocação e um `next()`, e
decide o que fazer antes e depois dele.

```
registrar → hooks → contar → política de erro → [a chamada de verdade]
```

```ts
await app.use({
  name: "cache",
  chat: async (inv, next) => {
    const guardado = cache.get(chave(inv.messages));
    if (guardado) {
      inv.meta({ cacheHit: true }); // aparece no report e no Flow
      return guardado; // nunca chama next() — substitui a chamada
    }
    return cache.set(chave(inv.messages), await next());
  },
});
```

::: warning `next()` uma vez, e só uma
Chamar duas vezes rodaria o resto da cadeia — inclusive a chamada ao modelo — em
duplicidade. O framework rejeita com
`next() was called more than once in the same middleware` em vez de cobrar duas
vezes em silêncio.
:::

## Onde a sua camada entra

O seu middleware não é a camada mais externa. A cadeia de tool é:

```
recordTool             ← o nó sempre abre; o report nunca omite uma chamada
  toolHooks            ← o beforeTool / afterTool do agente
    [ seu middleware ]
      countTool        ← conta só o que foi de fato gasto
        toolErrorPolicy
          [ execute ]
```

Cada posição é deliberada:

- **abaixo do `recordTool`** — um passo que não abre o nó desaparece do grafo, e
  um report que omite chamadas é pior que report nenhum
- **abaixo do `toolHooks`** — para uma checagem enxergar os argumentos que
  **realmente** vão executar. Um `beforeTool` que reescrevesse os argumentos
  depois de uma checagem de autorização a tornaria contornável
- **acima do `countTool`** — um middleware que curto-circuita (um cache) não
  gastou nada e não pode somar no orçamento, senão o `maxCostUsd` fura

A segunda é por que **autorização pertence a um middleware de tool, e não a um
hook `beforeTool`**. Veja [Segurança](/pt/best-practices/security).

## O que vem na invocação

**`ToolInvocation`** — `name`, `args` (mutável, para poder ser reescrito),
`agent`, `ctx`, `run` e `meta()`.

**`ChatInvocation`** — `messages`, `tools`, `sampling`, `signal`, `onToken`,
`agent`, `ctx`, `run` e `meta()`.

O `meta()` grava telemetria no nó deste passo, então aparece no `report.json` e
no grafo do Flow. É como um middleware conta o que fez — sem isso, um cache que
acerta em 4ms só pode ser *deduzido* pela duração. É no-op quando nada está
observando.

::: tip Se você chamar o provider por fora num middleware `chat`
Repasse `inv.signal` e `inv.onToken`, ou você quebra cancelamento e streaming
naquela chamada.
:::

## Negar uma tool, de forma recuperável

Um `throw` de um middleware encerra a execução. Para recusar de um jeito que o
modelo leia e contorne, devolva um resultado de erro:

```ts
await app.use({
  name: "guarda",
  tool: async (inv, next) => {
    if (inv.name === "deploy" && !permitido(inv.run)) {
      return { content: "Deploy não é permitido nesta execução.", isError: true };
    }
    return next();
  },
});
```

É a diferença entre "esta execução acabou" e "tente outra coisa".

## `contextWindow()`

Um middleware `chat` pronto, que apara o histórico para caber na janela:

```ts
import { contextWindow } from "@thenajs/core";

await app.use({
  name: "janela",
  chat: contextWindow({
    maxTurns: 12, // um turno com tool ocupa duas mensagens, então ~6 idas e voltas
    maxChars: 60_000,
    maxCharsPerTool: 4_000,
  }),
});
```

Ele preserva **sempre** as mensagens `system` iniciais: elas são o prompt do
agente e a projeção do estado, e cortá-las quebraria o agente em vez de
economizar. Preservar o começo também mantém o prefixo estável para o cache de
prompt do provider.

Não tem defaults, de propósito — cortar histórico muda o comportamento do agente,
e de forma silenciosa. Meça primeiro (o `promptTokens` nos nós `chat` do report) e
ligue quando o número justificar.

## Observando

```ts
import { thenaFlow } from "@thenajs/flow";

await app.use(thenaFlow({ port: 4100 }));
```

Um observador puro: só `onEvent`.

## Limpando

O `dispose()` é chamado pelo `app.dispose()`. Feche ali o que o `setup` abriu —
um servidor, um arquivo, uma conexão. Num script dá para pular o
`app.dispose()`; num servidor, não.

## Erros comuns

**Registrar depois do `run`.** O `use` precisa vir antes.

**Lançar para negar.** Isso encerra a execução. Devolva
`{ content, isError: true }` se o modelo deve se recuperar.

**Esquecer que o `next()` devolve o resultado.** Um middleware que chama `next()`
mas retorna outra coisa substituiu a saída — às vezes de propósito, muitas vezes
não.

## Relacionado

- [Hooks](/pt/fundamentals/hooks) — o equivalente por agente
- [A execução](/pt/fundamentals/the-run)
- [Streaming](/pt/fundamentals/streaming)
