# Observabilidade

O controle de fluxo de um agente é decisão de um modelo, então "o que aconteceu"
não é dedutível do seu código. Tudo abaixo existe para torná-lo dedutível a partir
de dados.

## Três ferramentas, três momentos

| | Quando | Persiste | Use para |
| --- | --- | --- | --- |
| [`log`](/pt/devtools/logging) | ao vivo, terminal | não | desenvolvimento, e uma requisição em produção |
| [Flow](/pt/devtools/flow) | ao vivo, grafo no navegador | não | acompanhar uma execução lenta ou travada |
| [`report`](/pt/devtools/report) | depois | sim | depurar, medir, relatar bug |
| um plugin | ao vivo, onde você quiser | seu | produção |

Os quatro recebem o mesmo stream de `ExecutionEvent`.

## Meça estrutura, não prosa

O ponto dos dados estruturados nos nós é que responder "com que frequência as
tools falham" deveria ser uma contagem, não um regex:

| Pergunta | Sinal |
| --- | --- |
| os laços estão convergindo? | `exhausted` nos nós `loop` |
| com que frequência as tools falham? | nós `tool` com `status: "error"` |
| o provider está instável? | `attempts` presente nos nós `chat` |
| o modelo está no limite? | `toolCallSource: "rescued"` |
| o histórico está crescendo? | `promptTokens` por turno |
| quanto custa uma execução? | `costUsd` no nó `workflow` |

O `toolCallSource` merece atenção: `"rescued"` significa que o modelo escreveu a
tool call como texto e o framework recuperou. Funciona, mas uma taxa crescente é
aviso antecipado de que a tarefa passou do que o modelo dá conta.

## Produção: um plugin, não o report

`report: true` grava uma pasta por execução — certo em desenvolvimento, errado num
serviço movimentado. Encaminhe os eventos:

```ts
export function otelPlugin(): ThenaPlugin {
  const spans = new Map<string, Span>();

  return {
    name: "otel",
    onEvent(evento) {
      if (evento.phase === "start") {
        const pai = evento.parentId ? spans.get(evento.parentId) : undefined;
        spans.set(evento.id, tracer.startSpan(`${evento.kind}:${evento.name}`, { parent: pai }));
        return;
      }
      const span = spans.get(evento.id);
      if (!span) return;
      if (evento.status === "error") span.recordException(evento.error ?? "");
      span.end();
      spans.delete(evento.id);
    },
  };
}
```

`id`/`parentId` reconstroem a árvore; o `runId` mantém execuções concorrentes
separadas. Apagar no `end` não é opcional — um processo de vida longa que nunca
limpa esse mapa vaza memória.

Use `onEvent` em vez de middleware `tool`/`chat` para observação: uma exceção no
`onEvent` é engolida e não consegue quebrar uma execução. Essa garantia vale muito
em produção.

## Mantenha o report como opt-in por requisição

```ts
await app.run({
  input,
  log: req.header("x-debug") ? "verbose" : false,
  report: req.header("x-debug") ? { dir: `report/${req.id}` } : false,
});
```

Depurar uma requisição de produção sem redeploy, sem flag global, e sem barulho do
resto.

## Sua própria telemetria

O `ctx.meta()` numa tool, o `inv.meta()` num middleware, grava no nó daquele
passo:

```ts
async execute(@input() args, @context() ctx: Context) {
  const linhas = await db.query(args.sql);
  ctx.meta({ rowCount: linhas.length, cached: false });
  return formatar(linhas);
}
```

Sem isso, um cache que acerta em 4ms só pode ser *deduzido* pela duração. É no-op
quando nada está observando, então chame à vontade.

## Correlacione com o seu sistema

O `runId` está disponível de forma síncrona, antes do primeiro turno:

```ts
const exec = app.run({ input, data: { requestId: req.id } });
req.log.info({ runId: exec.runId }, "execução do agente iniciada");
```

Carregar o id da sua requisição no `data` e o `runId` nos seus logs é o que
permite ir de uma reclamação de usuário até a árvore de execução exata.

## A observação é opt-in

Nada é emitido a menos que alguém esteja olhando — `report`, `log`, um plugin com
`onEvent`, ou `observe: true`. Senão a execução pula a árvore, os eventos e o
pedido de streaming.

É uma economia deliberada de ~2× em CPU, e o motivo de o `onEvent` avisar uma vez
em vez de silenciosamente não render nada.

## Alertas que valem a pena

| Alerta | Por quê |
| --- | --- |
| `costUsd` por execução, p95 | primeiro sinal de um laço que parou de convergir |
| taxa de `exhausted: true` | a condição de parada está degradando |
| taxa de `toolCallSource: "rescued"` | o modelo está escorregando nesta tarefa |
| `attempts` presente | instabilidade do provider, antes de virar falha |
| execuções encerradas por orçamento | limites de plano, ou uma regressão real |

O último precisa do `onExceeded` — um orçamento no modo `"stop"` resolve
normalmente, então uma execução que bateu no teto é, de outra forma,
indistinguível de uma que terminou.

```ts
budget: {
  maxCostUsd: 0.5,
  onExceeded: (info) => metricas.incrementar(`budget.${info.reason}`),
}
```

## Privacidade

Tudo que é capturado passa antes pelo
[mascaramento](/pt/advanced/redaction), que vem ligado. É rede de proteção para
formatos conhecidos, não garantia — não existe regex para o nome de um cliente.

Para execuções sensíveis, `report: { content: false }` mantém a árvore, as
durações e a telemetria, e não grava nenhum texto. Você mantém todas as métricas
desta página e perde só a capacidade de ler a conversa.

## Relacionado

- [Report](/pt/devtools/report)
- [Log](/pt/devtools/logging)
- [Escrever plugins](/pt/advanced/writing-plugins)
- [Produção](/pt/deployment/production)
