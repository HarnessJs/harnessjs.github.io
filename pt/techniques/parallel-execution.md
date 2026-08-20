# Execução paralela

```ts
import { parallel } from "@thenajs/core";

@Workflow({
  steps: [parallel([SegurancaAgent, PerformanceAgent, EstiloAgent])],
})
export class RevisaoWorkflow {}
```

Os três rodam ao mesmo tempo, sobre o **mesmo estado**.

## Quando compensa

Paralelo ajuda quando os ramos são **independentes** e cada um é lento — três
analistas olhando a mesma entrada por ângulos diferentes. Três chamadas ao modelo
que levariam 6 segundos em sequência levam cerca de 2.

Não ajuda quando um ramo posterior precisa do que um anterior descobriu. Isso é
sequência, e escrever como `parallel` produz agentes raciocinando sobre um
histórico incompleto.

## A pegadinha do estado compartilhado

Todo ramo escreve em `ctx.output`, então **a última escrita vence** — e qual é a
última é uma corrida. Nunca leia `ctx.output` depois de um bloco `parallel`
esperando a resposta de um ramo específico.

Duas formas de coletar resultados direito.

**Cada agente grava num campo próprio:**

```ts
export class SegurancaAgent {
  afterResponse(resposta: string, ctx: Context) {
    ctx.seguranca = resposta;
  }
}
```

```ts
export class ResumidorAgent {
  async beforePrompt(prompt: string, ctx: Context) {
    return `${prompt}

## Segurança
${ctx.seguranca}

## Performance
${ctx.performance}`;
  }
}
```

**Ou use o estado tipado do workflow**, melhor quando o formato importa:

```ts
export class RevisaoState {
  achados: Record<string, string> = {};
}
```

```ts
export class SegurancaAgent {
  constructor(@state() private readonly s: RevisaoState) {}
  afterResponse(resposta: string) {
    this.s.achados.seguranca = resposta;
  }
}
```

::: warning O objeto de estado é compartilhado, não copiado
Ramos mutando o mesmo array ou objeto podem se intercalar. Atribuir a chaves
distintas é seguro; dar `push` no mesmo array a partir de três ramos dá uma ordem
não determinística.
:::

## O histórico também é compartilhado

Todos os ramos anexam ao mesmo `history`. Com três agentes, a conversa do pai
termina com três turnos de assistente cuja ordem varia entre execuções — o que
torna a execução não reproduzível mesmo em `temperature: 0`.

Se isso importa, mantenha os ramos fora do transcript e promova as saídas a
contexto:

```ts
afterResponse(resposta: string, ctx: Context) {
  ctx.state.set("history", ctx.state.history.slice(0, -1));
  ctx.seguranca = resposta;
}
```

Ou isole cada ramo como uma [execução aninhada](/pt/techniques/nested-runs), que
dá a cada um o próprio histórico e devolve uma string.

## Falha

Um ramo que lança derruba o bloco, e portanto a execução. Não existe "continue
com os que funcionaram" — se você quer isso, capture dentro do agente:

```ts
async onError(error: Error, ctx: Context) {
  ctx.meta({ falhou: error.name });
  return "Esta análise não pôde ser concluída.";
}
```

## Custo

Paralelo não reduz o número de chamadas ao modelo; reduz o tempo de parede. Três
ramos custam três chamadas, e contra um provider com rate limit podem serializar
mesmo assim — ou disparar um `429`, sobre o qual o retry embutido vai fazer
backoff.

Um `budget` conta todas:

```ts
budget: { maxChatCalls: 10, maxCostUsd: 0.25 }
```

## Aninhamento

`parallel` e `loop` compõem nas duas direções:

```ts
loop({
  steps: [parallel([ExplorerA, ExplorerB]), RevisorAgent],
  until: (_ctx, s: RevisaoState) => s.aprovado,
  maxIterations: 3,
});
```

Olho na multiplicação — 3 iterações × 2 ramos + 3 revisões são 9 chamadas ao
modelo.

## Erros comuns

**Ler `ctx.output` depois do bloco.** É o ramo que terminou por último.

**Usar `parallel` para um pipeline.** Se B precisa do achado de A, é sequência.

**Esperar isolamento.** Estado e histórico são compartilhados. Isolamento é
execução aninhada.

## Relacionado

- [Workflows](/pt/fundamentals/workflows)
- [Sistemas multiagente](/pt/techniques/multi-agent-systems)
- [Passos](/pt/reference/steps)
