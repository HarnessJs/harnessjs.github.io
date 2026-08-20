# Escrever plugins

Um plugin é um objeto com um `name` e ao menos uma de quatro capacidades. Não há
registro, nem classe base, nem etapa de build.

```ts
import type { ThenaPlugin } from "@thenajs/core";

export function meuPlugin(options: MinhasOpcoes = {}): ThenaPlugin {
  return {
    name: "meu-plugin",
    async setup() {},
    onEvent(evento) {},
    tool: async (inv, next) => next(),
    chat: async (inv, next) => next(),
    async dispose() {},
  };
}
```

```ts
await app.use(meuPlugin());
```

O formato de função-fábrica é convenção, não exigência — é só como se recebe
opções.

## Observar ou interceptar

| | `onEvent` | `tool` / `chat` |
| --- | --- | --- |
| Participa da execução | não | **sim** |
| Se lançar | engolido; execução intacta | a execução falha |
| Pode mudar o resultado | não | sim |
| Custo | uma chamada por fronteira de passo | envolve cada execução |

Prefira `onEvent` a menos que precise mudar alguma coisa. Ele não consegue
quebrar uma execução, e essa garantia vale muito em produção.

## Plugin de observabilidade

```ts
export const metricas: ThenaPlugin = {
  name: "metricas",
  onEvent(evento) {
    if (evento.phase !== "end") return;
    statsd.timing(`agent.${evento.kind}`, evento.durationMs!);
  },
};
```

O evento carrega `kind`, `name`, `durationMs`, `status`, `error` e os ids. Isso
basta para métrica, para uma linha de log, ou para um webhook.

**Tracing precisa de mais uma coisa: estado entre as duas fases.** Abra um span
no `"start"`, feche no `"end"`, e indexe o que os guarda por `event.id` — o
`parentId` é o que aninha, o `runId` é o que mantém execuções concorrentes
separadas.

Seja lá o que você use para guardar os spans abertos, remova cada entrada ao
fechar. Um processo de vida longa que só acrescenta vaza memória.

## Interceptadores

Um cache de `chat`:

```ts
chat: async (inv, next) => {
  const chave = hash(inv.messages);
  const guardado = await cache.get(chave);
  if (guardado) {
    inv.meta({ cacheHit: true }); // aparece no report e no Flow
    return guardado; // sem next() — a chamada nunca acontece
  }
  const resultado = await next();
  await cache.set(chave, resultado);
  return resultado;
};
```

Uma guarda de tool da qual o modelo se recupera:

```ts
tool: async (inv, next) => {
  if (inv.name === "deploy" && !permitido(inv.run)) {
    return { content: "Deploy não é permitido nesta execução.", isError: true };
  }
  return next();
};
```

Devolver `isError` em vez de lançar é a diferença entre "tente outra coisa" e
"esta execução acabou".

## Regras que mordem

**`next()` exatamente uma vez.** Duas vezes rejeita com
`next() was called more than once in the same middleware` — melhor que cobrar duas
vezes em silêncio. Zero vezes é legítimo: substitui a execução.

**Devolva o que o `next()` devolveu**, a menos que substituir seja o ponto. Um
middleware que chama `next()` e retorna outra coisa trocou a saída em silêncio.

**Repasse `inv.signal` e `inv.onToken`** se você chamar o provider por conta
própria num middleware `chat`. Derrubá-los quebra cancelamento e streaming
naquela chamada.

**`meta()` é no-op quando nada está observando.** Chame à vontade; não custa nada
no caminho de custo zero.

## Ciclo de vida

O `setup()` roda uma vez, dentro do `use()`. Um throw ali rejeita o `use()` —
falha de configuração deve aparecer antes da execução, não no meio de uma.

```ts
async setup() {
  this.client = await conectar(this.url);   // falha agora, não no meio da run
}

async dispose() {
  await this.client?.close();
}
```

O `dispose()` é chamado pelo `app.dispose()`. Tudo que o `setup` abriu fecha aqui
— e um plugin segurando um servidor ou socket aberto é por que um script não
termina.

## Ordem

Plugins envolvem na ordem de registro: o primeiro registrado é a camada mais
externa.

```ts
await app.use(metricas()); // enxerga os tempos do cache
await app.use(cache()); // enxerga os tempos da chamada de verdade
```

Registre as camadas de medição antes das de cache, senão as suas métricas
excluem o que o cache economizou.

## Comportamento por execução

Plugins são de nível de app e não podem ser acrescentados por execução. Um plugin
que só deve agir às vezes consulta a execução:

```ts
tool: async (inv, next) => {
  if (!inv.run.data.auditando) return next();
  return auditado(inv, next);
};
```

O `inv.run` é o `RunContext`; o `inv.ctx` é o contexto do passo.

## Testando

Middleware é uma função comum de uma invocação e um `next`:

```ts
const inv = { name: "deploy", args: {}, run: runFalso, ctx: ctxFalso, meta: () => {} };
const resultado = await guarda.tool!(inv, async () => "não deveria chegar aqui");
expect(resultado).toEqual({ content: expect.any(String), isError: true });
```

## Relacionado

- [Middleware e plugins](/pt/fundamentals/middleware) — o conceito
- [Flow](/pt/devtools/flow) — um plugin que dá para ler
- [Modelo de execução](/pt/advanced/execution-model)
- [Observabilidade](/pt/best-practices/observability)
