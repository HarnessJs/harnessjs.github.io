# Execuções aninhadas

Às vezes uma subtarefa é ruidosa: dez voltas de tentativa e erro para chegar a
uma resposta de uma linha. Se isso acontece no mesmo histórico, o agente
principal carrega todo o ruído — e com modelo pequeno, isso degrada as decisões
dele.

A saída é rodar a subtarefa num **workflow próprio**, disparado por uma tool:

```
agente pai  (histórico enxuto)
 └─ tool ──▶ workflow isolado  (estado próprio)
              ├─ 10 voltas de tentativa e erro
              └─ devolve UMA string ao pai
```

## Como se escreve

O construtor da tool recebe o `WorkflowRuntime` injetado:

```ts
import { Tool, WorkflowRuntime, input } from "@thenajs/core";
import { z } from "zod";
import { DeployWorkflow } from "../workflows/deploy.workflow";

@Tool({
  name: "deploy",
  description: "Executa o processo de deploy e devolve o resultado.",
  schema: z.object({ repositorio: z.string() }),
})
export class DeployTool {
  constructor(private readonly runtime: WorkflowRuntime) {}

  async execute(@input() { repositorio }: { repositorio: string }) {
    return this.runtime.run(DeployWorkflow, {
      input: { message: `Faça o deploy de ${repositorio}` },
      memory: { ambiente: "staging" }, // contexto explícito para o filho
    });
  }
}
```

O filho começa com estado novo: só recebe o que você passou em `input` e
`memory`.

Isso é bom — o ruído dele não polui o pai — e tem um custo: ele começa sem saber
o que foi pedido. Para repassar algo da conversa do pai, peça o contexto:

```ts
async execute(
  @input() { repositorio }: { repositorio: string },
  @context() ctx: Context,
) {
  const pedido = ctx.state.history.find((m) => m.role === "user")?.content;

  return this.runtime.run(DeployWorkflow, {
    input: { message: `Faça o deploy de ${repositorio}` },
    memory: { pedidoOriginal: pedido },
  });
}
```

É o caso de uso central do `@context()`: **você** escolhe o que atravessa o
isolamento, em vez de tudo ou nada.

## Step ou tool? O guia de decisão

É a escolha arquitetural central de um workflow, e as duas formas parecem
equivalentes até a primeira vez que a diferença morde.

| | sub-agente como **step** | sub-agente como **tool** |
| --- | --- | --- |
| Histórico | compartilhado com o pai | próprio, isolado |
| A saída vira | mensagem `assistant` | observação de tool |
| Quem decide se roda | você, na ordem dos `steps` | o modelo, chamando a tool |
| Custo de contexto no pai | todos os turnos do filho | uma string |
| Use quando | é uma conversa só e o pai precisa ver o caminho | a subtarefa é ruidosa, ou só o resultado importa |

## A visibilidade não se perde

O report aninha a execução do filho dentro do nó da tool:

```
workflow WorkflowPai
  agent AgentePai
    chat
      tool deploy
        workflow DeployWorkflow      ← o filho aparece aqui
          agent DeployAgent
            chat
```

Você abriu mão do contexto compartilhado, não da observabilidade.

## O orçamento **atravessa**

::: warning Isso mudou na 0.9
Uma execução aninhada **conta no orçamento do pai**. Versões anteriores mantinham
contadores separados, e documentação antiga ainda diz que o orçamento não
atravessa — hoje ele atravessa.
:::

Sem orçamento próprio, o filho usa o tracker do pai. Com um, ganha um tracker
encadeado, e corta quem estourar primeiro:

```ts
return this.runtime.run(DeployWorkflow, {
  input: { message: `Faça o deploy de ${repositorio}` },
  budget: { maxChatCalls: 5 }, // teto próprio, ainda dentro do do pai
});
```

O motivo é que herdar virava a forma de escapar: um `maxCostUsd` de $1 no topo
era contornável por qualquer tool que disparasse um sub-workflow.

Repare que o aninhamento relaxa um pouco a precisão do teto — a execução pode
passar por uma chamada ao modelo por nível de aninhamento, porque a parada é
checada entre unidades de trabalho.

## `WorkflowRuntime`

```ts
runtime.run<T = string>(ClasseDoWorkflow, options: WorkflowRunOptions): Promise<T>;
```

Ele não tem estado — tudo que a execução precisa vem do `RunContext` — e devolve
uma `Promise` comum, não um `RunHandle`. Uma execução aninhada não é cancelável
separadamente: ela é cancelada junto com o pai, pelo signal compartilhado.

Só `input`, `memory` e `budget` são repassados.

## Quando não usar

O isolamento custa o equivalente a uma ida e volta para montar o contexto, e o
filho não enxerga o que o pai aprendeu. Se o pai realmente precisa acompanhar o
raciocínio — uma revisão que precisa ver a investigação — faça um step e
compartilhe o histórico.

## Relacionado

- [Workflows](/pt/fundamentals/workflows)
- [Sistemas multiagente](/pt/techniques/multi-agent-systems)
- [Orçamentos](/pt/techniques/budgets)
- [`@Tool`](/pt/reference/tool)
