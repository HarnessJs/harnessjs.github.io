# Workflows

Um workflow declara a ordem dos passos e o estado que eles compartilham. Ele
também é a unidade de execução: uma execução pertence a um workflow, não a um
agente.

```ts
@Workflow({
  state: RevisaoState,
  steps: [PlannerAgent, loop({ steps: [LeitorAgent, RevisorAgent], until })],
})
export class RevisaoWorkflow {}
```

## Por que um agente precisa de um

Mesmo para um agente só:

```ts
@Workflow({ steps: [MeuAgent] })
export class MeuWorkflow {}
```

O contexto da execução, o orçamento, o cancelamento, o estado e o gravador
pertencem todos ao workflow. Deixar o caso de um agente só pular isso
significaria dois modelos de execução em vez de um.

## Os três tipos de passo

```ts
import { parallel, loop, untilAnswered } from "@thenajs/core";

steps: [
  PlannerAgent,                              // sequência
  parallel([SegurancaAgent, PerfAgent]),     // concorrentes
  loop({ steps: [Executor], until: untilAnswered, maxIterations: 8 }),
];
```

Eles se aninham à vontade. Um `loop` pode conter um `parallel`, que pode conter
outro `loop`.

### Sequência

Os passos rodam em ordem e compartilham o mesmo histórico de conversa, então cada
um enxerga o que o anterior disse.

### Paralelo

`parallel([...])` roda os passos ao mesmo tempo, sobre o mesmo estado.

`ctx.output` acaba sendo o do último ramo declarado, então as outras respostas
se perdem. Leia os resultados
no histórico compartilhado, ou faça cada agente gravar num campo próprio:

```ts
export class SegurancaAgent {
  afterResponse(r: string, ctx: Context) {
    ctx.seguranca = r;
  }
}
```

### Laço

```ts
loop({
  steps: [ExecutorAgent],
  until: untilAnswered,
  maxIterations: 8,
  onExhausted: (ctx, n) => console.warn(`teto após ${n}`),
  maxFails: 5,
  onFail: (ctx, info) => console.warn(info.message),
});
```

O `until` devolve **`true` para parar**. Defaults: `maxIterations` é `10`,
`maxFails` é `5` — falhas de tool **consecutivas** que encerram o laço, porque o
sinal de estar preso é a repetição, não o acúmulo. `Infinity` desliga.

## Estado

```ts
export class RevisaoState {
  aprovado = false;
  rodadas = 0;
}

@Workflow({ state: RevisaoState, steps: [...] })
export class RevisaoWorkflow {}
```

Os valores iniciais são as inicializações de campo — sem schema, sem factory. O
framework instancia **uma por execução**, e todo mundo vê o mesmo objeto: agentes
por `@state()`, tools por `@state()`, e o `until` de um laço como segundo
parâmetro.

```ts
until: (ctx, s: RevisaoState) => s.aprovado;
```

O `state` é opcional. Se ninguém pede, ninguém paga — e se alguém pede e o
workflow não declarou, a falha nomeia a classe e o parâmetro, em vez de entregar
`undefined`.

Veja [Estado e contexto](/pt/fundamentals/state-and-context).

## Executando

```ts
const app = Thena.create(RevisaoWorkflow, config);
const resultado = await app.run({ input: { message: "Revise src/" } });
await app.dispose();
```

O `Thena.create` não é async. O `app.run` devolve um `RunHandle` — dê `await`
para o resultado, ou guarde para cancelar e observar.

Chamadas concorrentes ao `run` são seguras: cada uma abre o próprio contexto,
estado e orçamento.

## Erros comuns

**Inverter o `until`.** `true` significa parar. Uma condição que se lê como
"continue enquanto…" está ao contrário.

**Esperar que um passo de agente solto itere.** Um passo de agente é um turno.
Embrulhe num `loop` se a tarefa exige investigação.

**Ninguém grava o que o `until` lê.** É a causa mais comum de um laço que sempre
bate no `maxIterations`. Ponha um `onExhausted` para descobrir.

**Dar `push` num array compartilhado a partir de todo ramo do `parallel`.** O
histórico é ordenado; o seu objeto de estado ainda é escrito na ordem de
conclusão. Atribua a chaves distintas. Para isolamento de
verdade, use uma execução aninhada.

## Relacionado

- [Estado e contexto](/pt/fundamentals/state-and-context)
- [A execução](/pt/fundamentals/the-run)
- [Agentes](/pt/fundamentals/agents)
