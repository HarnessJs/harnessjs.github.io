# Seu primeiro workflow

Um workflow declara a ordem dos passos. Todos compartilham o mesmo estado e o
mesmo histórico de conversa, então o que um agente diz, o próximo enxerga.

Um passo é uma de exatamente três coisas:

```ts
import { Workflow, parallel, loop, untilAnswered } from "@thenajs/core";

@Workflow({
  steps: [
    PlannerAgent, // 1. um agente, em sequência
    parallel([ExplorerAgent, ReviewerAgent]), // 2. concorrentes
    loop({
      // 3. repetição
      steps: [ExecutorAgent],
      until: untilAnswered,
      maxIterations: 8,
    }),
  ],
})
export class MeuWorkflow {}
```

Eles se combinam e aninham à vontade — um `loop` pode conter um `parallel`, que
pode conter outro `loop`.

## Sequência

A forma mais simples. Cada agente roda depois do anterior e enxerga o que ele
disse, porque o histórico é compartilhado.

```ts
@Workflow({ steps: [PesquisadorAgent, EscritorAgent] })
export class ArtigoWorkflow {}
```

::: tip A saída de um passo vira fala do próximo
O turno de um agente entra no histórico como `assistant`. O próximo agente recebe
aquilo como se **ele** já tivesse falado — o que é ótimo para uma conversa
contínua, e ruim quando a saída deveria ser só contexto.
:::

## Paralelo

Para agentes independentes que olham a mesma entrada:

```ts
parallel([AnalistaDeSegurancaAgent, AnalistaDePerformanceAgent]);
```

Todos recebem o mesmo estado e rodam ao mesmo tempo. Como todos escrevem em
`ctx.output`, a última escrita vence — leia os resultados no histórico
compartilhado, ou faça cada agente gravar num campo próprio do `ctx`.

## Laço

Onde o agente trabalha em várias voltas — investigar, agir, olhar, repetir:

```ts
loop({
  steps: [ExecutorAgent],
  until: untilAnswered,
  maxIterations: 8,
  onExhausted: (ctx, n) => console.warn(`parou no teto após ${n} voltas`),
});
```

O `until` devolve **`true` para parar**. O `untilAnswered` é o pronto que
significa "pare quando o agente responder sem chamar tool" — o fim usual de um
laço de investigar e agir.

O `maxIterations` tem default `10`, e ele não é opcional no espírito: sem teto, um
modelo que não converge roda para sempre.

## Um exemplo completo

Um revisor que lê, avalia e repete até aprovar. O estado é o que amarra tudo:

```ts
// src/workflows/revisao.state.ts
export class RevisaoState {
  aprovado = false;
  rodadas = 0;
}
```

```ts
// src/workflows/revisao.workflow.ts
@Workflow({
  state: RevisaoState,
  steps: [
    PlannerAgent, // decide o que olhar
    loop({
      steps: [LeitorAgent, RevisorAgent],
      until: (_ctx, s: RevisaoState) => s.aprovado,
      maxIterations: 5,
      onExhausted: (_ctx, voltas) =>
        console.warn(`não aprovou em ${voltas} rodadas`),
    }),
  ],
})
export class RevisaoWorkflow {}
```

```ts
// o revisor grava a decisão que o `until` lê
import { state } from "@thenajs/core";

export class RevisorAgent {
  constructor(@state() private readonly s: RevisaoState) {}

  async afterResponse(resposta: string) {
    this.s.rodadas++;
    this.s.aprovado = resposta.includes("APROVADO");
  }
}
```

Repare no segundo parâmetro do `until`: é a instância de `RevisaoState` desta
execução. Sem alguém gravar `aprovado`, a condição nunca ficaria verdadeira e o
laço rodaria até o teto toda vez — o erro mais comum ao montar o primeiro laço com
critério próprio.

## Executando

```ts
// src/main.ts
import { Thena } from "@thenajs/core";
import { RevisaoWorkflow } from "./workflows/revisao.workflow";
import { config } from "./config";

const app = Thena.create(RevisaoWorkflow, config);

const parecer = await app.run({
  input: { message: "Revise o diretório src/" },
  memory: { userId: "123" }, // contexto durável, vira mensagem `system`
});

await app.dispose();
```

O `run` devolve a saída e **propaga** o erro — quem imprime é a sua aplicação, não
o framework. Chamadas concorrentes são seguras: cada uma abre o próprio contexto
de execução.

**Próximo: [configuração](/pt/get-started/configuration).**
