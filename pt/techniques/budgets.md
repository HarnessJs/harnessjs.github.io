# Orçamentos

O `maxIterations` limita um laço. O `budget` limita a **execução inteira** —
tempo de parede, chamadas ao modelo, execuções de tool, tokens e dinheiro.

```ts
await app.run({
  input: { message: "Revise src/" },
  budget: {
    maxDurationMs: 60_000,
    maxChatCalls: 20,
    maxCostUsd: 0.5,
  },
});
```

**Sem `budget`, nada é medido nem checado.** Não existe teto padrão, porque um
teto arbitrário cortaria trabalho legítimo.

## Os limites

| Chave | Conta |
| --- | --- |
| `maxDurationMs` | tempo de parede da execução inteira |
| `maxChatCalls` | chamadas ao modelo |
| `maxToolCalls` | execuções de tool |
| `maxTokens` | prompt + completion, **só o que o provider reporta** |
| `maxCostUsd` | exige `costPer1kTokens` no provider |

O `maxCostUsd` mede zero em silêncio se o provider não tem preço:

```ts
super({
  apiKey,
  model: "gpt-4o-mini",
  costPer1kTokens: { input: 0.00015, output: 0.0006 },
});
```

## Parar ou lançar

```ts
budget: { maxChatCalls: 20, mode: "stop" }   // default
```

| Modo | O que acontece |
| --- | --- |
| `"stop"` | encerra **graciosamente** — passos seguintes pulados, devolve a saída que já havia, sem lançar |
| `"throw"` | lança `BudgetExceededError` |

`"stop"` é o default porque uma resposta parcial normalmente é melhor que resposta
nenhuma. Escolha `"throw"` quando um resultado truncado é pior que uma falha
visível — uma operação de cobrança, uma migração.

```ts
import { BudgetExceededError } from "@thenajs/core";

try {
  await app.run({ input, budget: { maxCostUsd: 1, mode: "throw" } });
} catch (err) {
  if (err instanceof BudgetExceededError) {
    console.warn(`${err.info.reason}: ${err.info.value} de ${err.info.limit}`);
  }
}
```

## Saber que aconteceu

O `mode: "stop"` retorna normalmente, então uma execução que bateu no teto e uma
que terminou são iguais do lado de quem chamou. O `onExceeded` é como você
distingue:

```ts
budget: {
  maxCostUsd: 0.5,
  onExceeded: (info) => metricas.incrementar(`budget.${info.reason}`),
}
```

É chamado **uma vez**, no momento em que o orçamento estoura.

```ts
interface BudgetExceeded {
  reason: "maxDurationMs" | "maxChatCalls" | "maxToolCalls" | "maxTokens" | "maxCostUsd";
  limit: number;
  value: number;
  usage: BudgetUsage;
}
```

## Lendo o consumo no meio

```ts
interface BudgetUsage {
  chatCalls: number;
  toolCalls: number;
  tokens: number;
  costUsd: number;
  elapsedMs: number;
}
```

Disponível como `ctx.budget` e `ctx.usage()`, e só populado quando a execução tem
orçamento. É aqui que você escreve a política que o framework deliberadamente não
escreve:

```ts
// parar o laço mais cedo quando estiver ficando caro
until: (ctx, s: MeuState) => s.terminou || (ctx.budget?.costUsd ?? 0) > 0.25;
```

```ts
// recusar uma tool cara no fim de uma execução cara
async beforeTool(call: ToolCall, ctx: Context) {
  if (call.name === "busca_profunda" && ctx.usage().costUsd > 0.4) {
    throw new Error("caro demais para fazer uma busca profunda agora");
  }
}
```

O framework conta; você decide o que é demais.

## Precisão

::: warning O teto é uma barreira, não um corte no meio da frase
A parada é checada **entre** unidades de trabalho, e uma chamada ao modelo só é
contabilizada depois de responder — antes disso não existe `usage` para somar. A
execução pode gastar mais uma chamada além do limite antes de parar, e uma tool
que dispara sub-workflow permite mais uma por nível de aninhamento.

É um limite superior conhecido e constante, não vazamento proporcional.
:::

Defina o teto onde uma chamada a mais seja aceitável. Se realmente não for, o
limite que você quer é `maxDurationMs` combinado com um `signal`.

## Execuções aninhadas

Um sub-workflow disparado por uma tool **conta no orçamento do pai**. Sem
orçamento próprio ele usa o tracker do pai; com um, ganha um encadeado, e corta
quem estourar primeiro.

```ts
await this.runtime.run(DeployWorkflow, {
  input: { message: "deploy" },
  budget: { maxChatCalls: 5 },
});
```

É isso que impede um `maxCostUsd` no topo de ser contornado por qualquer tool que
dispare um sub-workflow. Documentação antiga diz que o orçamento não atravessa;
ele atravessa, desde a 0.9.

## Orçamento e cancelamento

São ferramentas diferentes:

| | Orçamento | `signal` / `abort()` |
| --- | --- | --- |
| Gatilho | consumo | tempo, uma desconexão, a sua decisão |
| Granularidade | entre unidades de trabalho | chega dentro das suas tools |
| Fim padrão | `stop` gracioso | rejeição |

Para um limite duro de tempo de parede, o `signal` é mais preciso:

```ts
app.run({ input, signal: AbortSignal.timeout(30_000) });
```

Veja [Cancelamento](/pt/techniques/cancellation).

## Relacionado

- [Run e RunHandle](/pt/reference/run) — o `RunBudget` completo
- [Laços](/pt/techniques/loops) — o outro tipo de teto
- [Cancelamento](/pt/techniques/cancellation)
