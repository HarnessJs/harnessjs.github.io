# Execução paralela

```ts
import { parallel } from "@thenajs/core";

@Workflow({
  steps: [parallel([SegurancaAgent, PerformanceAgent, EstiloAgent])],
})
export class RevisaoWorkflow {}
```

Os três rodam ao mesmo tempo, e o bloco é determinístico: todo ramo lê o mesmo
histórico, e as escritas entram na ordem em que você os declarou.

## Quando compensa

Paralelo ajuda quando os ramos são **independentes** e cada um é lento — três
analistas olhando a mesma entrada por ângulos diferentes. Três chamadas ao modelo
que levariam 6 segundos em sequência levam cerca de 2.

Não ajuda quando um ramo posterior precisa do que um anterior descobriu. Isso é
sequência, e escrever como `parallel` produz agentes raciocinando sobre um
histórico incompleto.

## O que o bloco garante

Três coisas, e elas valem independentemente da latência do modelo:

| | |
| --- | --- |
| **Uma leitura** | Todo ramo vê o histórico como ele estava quando o bloco abriu. Um ramo que espera antes de ler continua sem enxergar o irmão. |
| **Escritas ordenadas** | `parallel([A, B, C])` anexa `A`, `B`, `C` ao histórico nessa ordem, mesmo que `C` responda primeiro. |
| **Tudo ou nada** | Um ramo que lança cancela os irmãos, e nada do bloco é anexado. |

`ctx.output` e `ctx.turn` são os do **último ramo declarado** — o `C` do exemplo.
É estável, mas ainda é a resposta de um ramo só entre três, então raramente é o
que você quer.

## Coletando os resultados

Duas formas, e as duas são melhores que ler `ctx.output`.

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

::: warning O objeto de estado é compartilhado, e é escrito na ordem de conclusão
A garantia de ordem cobre o **histórico**, não o seu objeto de estado. Os ramos
continuam concorrentes, então `this.s.achados.seguranca = …` numa chave distinta
é seguro, enquanto dar `push` no mesmo array a partir de três ramos continua
dando ordem não determinística. Atribua a chaves; não anexe a uma lista.
:::

## Histórico

Todos os ramos anexam ao mesmo `history`, e o bloco coloca os turnos deles na
**ordem de declaração**. Com `parallel([Seguranca, Performance, Estilo])`, a
conversa do pai lê `Seguranca`, `Performance`, `Estilo` em toda execução — então
um prompt que diga "o primeiro parecer é o de segurança" se sustenta, e a
execução é reproduzível em `temperature: 0`.

Se você preferir manter os ramos fora do transcript e promover as saídas a
contexto:

```ts
afterResponse(resposta: string, ctx: Context) {
  ctx.state.set("history", ctx.state.history.slice(0, -1));
  ctx.seguranca = resposta;
}
```

O ramo então não contribui com nada para o histórico do pai — ele corta a própria
cópia, e só o que um ramo acrescenta é fundido de volta.

Para um ramo que também precise do próprio `ctx` e da própria linha de
orçamento, use uma [execução aninhada](/pt/techniques/nested-runs).

## Falha

Um ramo que lança derruba o bloco, e portanto a execução. Os irmãos são
**cancelados** — uma chamada ao modelo em andamento é abortada em vez de terminar
e cobrar por uma resposta que ninguém vai ler — e nada do bloco chega ao
histórico.

Não existe "continue com os que funcionaram". Se você quer isso, capture dentro
do agente, o que impede o ramo de falhar:

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

**Ler `ctx.output` depois do bloco.** É o do último ramo declarado, e as outras
N-1 respostas se perderam. Colete em chaves.

**Usar `parallel` para um pipeline.** Se B precisa do achado de A, é sequência —
e aqui a garantia joga contra você: B está lendo o histórico de antes do bloco,
então não consegue ver A nem por acidente.

**Dar `push` num array compartilhado a partir de todo ramo.** O histórico é
ordenado; o seu objeto de estado não é.

## Relacionado

- [Workflows](/pt/fundamentals/workflows)
- [Sistemas multiagente](/pt/techniques/multi-agent-systems)
- [Passos](/pt/reference/steps)
