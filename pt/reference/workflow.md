# `@Workflow`

Declara a ordem dos passos. Todos compartilham o mesmo estado.

```ts
import { Workflow, loop, parallel, untilAnswered } from "@thenajs/core";

@Workflow({
  state: RevisaoState,
  steps: [
    PlannerAgent,
    parallel([SegurancaAgent, PerfAgent]),
    loop({ steps: [ExecutorAgent], until: untilAnswered, maxIterations: 8 }),
  ],
})
export class RevisaoWorkflow {}
```

## `WorkflowConfig`

| Chave | Tipo | Obrigatória |
| --- | --- | --- |
| `steps` | `WorkflowStep[]` | sim |
| `state` | `new () => object` | não |

### `steps`

```ts
type WorkflowStep = AgentClass | ParallelStep | LoopStep;
```

Rodam em ordem. Blocos `parallel` e `loop` se aninham à vontade. Veja
[Passos](/pt/reference/steps).

### `state`

```ts
export class RevisaoState {
  aprovado = false;
  rodadas = 0;
}
```

Os valores iniciais são as inicializações de campo — sem schema, sem factory. O
framework instancia **uma por execução** e entrega o mesmo objeto a quem pedir:

| Quem | Como |
| --- | --- |
| um agente | `constructor(@state() private s: RevisaoState)` |
| uma tool | `execute(@input() a, @state() s: RevisaoState)` |
| o `until` de um laço | o segundo parâmetro |

Omitir o `state` está ok enquanto ninguém pedir. Se alguém pedir, a falha nomeia
a classe e o parâmetro em vez de injetar `undefined` — e para um `until` que
declara segundo parâmetro, isso é pego **antes de a execução começar**, pela
aridade da função.

## `WorkflowMetadata`

Legível com `getWorkflowMetadata(ClasseDoWorkflow)`:

```ts
interface WorkflowMetadata {
  steps: WorkflowStep[];
  state?: StateCtor;
}
```

## Executando

```ts
const app = Thena.create(RevisaoWorkflow, config);
```

O `Thena.create` não é async. Veja [Run e RunHandle](/pt/reference/run).

Um agente sozinho ainda precisa de workflow — o contexto da execução, o
orçamento, o cancelamento e o gravador pertencem a ele:

```ts
@Workflow({ steps: [MeuAgent] })
export class MeuWorkflow {}
```

## Relacionado

- [Workflows](/pt/fundamentals/workflows) — o conceito
- [Passos](/pt/reference/steps) — `parallel`, `loop` e os helpers de `until`
- [Run e RunHandle](/pt/reference/run)
