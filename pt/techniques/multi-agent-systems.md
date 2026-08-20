# Sistemas multiagente

Mais agentes não é melhor. Cada um é mais um prompt para manter e pelo menos mais
uma chamada ao modelo para pagar. O motivo para dividir é que **um prompt só está
tentando segurar dois trabalhos incompatíveis**.

Bons motivos para dividir:

- os trabalhos precisam de **tools** diferentes (um leitor que só lê, um executor
  que age)
- precisam de **sampling** diferente (um planejador em `temperature: 0`, um
  escritor em `0.8`)
- precisam de **modelos** diferentes (um classificador barato, um raciocinador
  caro)
- um precisa **julgar** o outro, e não pode ser a mesma voz

Maus motivos: "parece mais organizado", ou porque o prompt ficou longo. Prompt
longo normalmente é problema de prompt.

## Os três formatos

### Pipeline

Cada passo refina o anterior, compartilhando histórico.

```ts
@Workflow({ steps: [PesquisadorAgent, EscritorAgent, EditorAgent] })
export class ArtigoWorkflow {}
```

A pegadinha: a saída de um passo entra no próximo como **fala do próprio
assistente**. Se a saída do pesquisador é *contexto* e não *fala*, promova-a —
senão o escritor lê e conclui que já respondeu. Veja
[Estado e contexto](/pt/fundamentals/state-and-context).

### Fan-out

Perspectivas independentes sobre a mesma entrada.

```ts
@Workflow({ steps: [parallel([SegurancaAgent, PerfAgent]), ResumidorAgent] })
```

O resumidor não é opcional: alguém precisa combinar os ramos, porque o
`ctx.output` depois de um `parallel` é o do ramo que terminou por último. Veja
[Execução paralela](/pt/techniques/parallel-execution).

### Laço com crítico

O que mais muda resultado, e o que as pessoas mais erram.

```ts
export class RevisaoState {
  aprovado = false;
  rodadas = 0;
}

@Workflow({
  state: RevisaoState,
  steps: [
    PlannerAgent,
    loop({
      steps: [ExecutorAgent, RevisorAgent],
      until: (_ctx, s: RevisaoState) => s.aprovado,
      maxIterations: 5,
      onExhausted: (_ctx, n) => console.warn(`sem aprovação em ${n} rodadas`),
    }),
  ],
})
export class RevisaoWorkflow {}
```

```ts
export class RevisorAgent {
  constructor(@state() private readonly s: RevisaoState) {}

  async afterResponse(resposta: string) {
    this.s.rodadas++;
    this.s.aprovado = /\bAPROVADO\b/.test(resposta);
  }
}
```

O revisor precisa **gravar** o que o `until` lê. Sem isso, o laço roda até o teto
toda vez — o bug mais comum deste formato.

::: tip Dê ao crítico um jeito de dizer sim
Um revisor instruído apenas a achar problemas sempre acha um. Diga
explicitamente: *"Se o trabalho atende aos critérios, responda exatamente
APROVADO e nada mais."*
:::

## Coordenação é estado compartilhado, não mensagem

Não existe mensagem de agente para agente. Os agentes se coordenam por dois
canais:

| Canal | Quem vê | Use para |
| --- | --- | --- |
| `ctx.state.history` | o modelo, a cada turno | a conversa em si |
| `@Workflow({ state })` | só o seu código | decisões, contadores, flags |

O estado tipado é onde mora o controle de fluxo. O histórico é onde mora o
raciocínio. Manter os dois separados é o que impede "o revisor aprovou?" de virar
um regex sobre prosa em três lugares.

## Isolando um especialista ruidoso

Quando uma subtarefa leva dez voltas para produzir uma linha, rodar isso no
histórico do pai envenena o contexto dele. Rode como tool:

```ts
export class DeployTool {
  constructor(private readonly runtime: WorkflowRuntime) {}

  async execute(@input() { repo }: { repo: string }) {
    return this.runtime.run(DeployWorkflow, {
      input: { message: `Faça o deploy de ${repo}` },
    });
  }
}
```

O pai vê uma string; o report continua aninhando a execução inteira do filho
dentro do nó da tool. Veja
[Execuções aninhadas](/pt/techniques/nested-runs).

A decisão, numa linha: **histórico compartilhado quando o pai precisa ver o
caminho, execução isolada quando só o resultado importa.**

## O custo cresce mais rápido do que parece

Um laço com crítico e `maxIterations: 5` sobre dois agentes são até 10 chamadas
ao modelo, mais as tools. Aninhado dentro de um `parallel` de três, 30.

Multiagente é onde um `budget` de execução deixa de ser opcional:

```ts
await app.run({ input, budget: { maxChatCalls: 30, maxCostUsd: 0.5 } });
```

## Construindo aos poucos

Comece com um agente e um laço. Divida só quando conseguir nomear qual dos quatro
motivos do começo se aplica. Toda divisão deveria deixar algum prompt mais curto
— se todos ficaram mais longos, o corte foi no lugar errado.

## Relacionado

- [Workflows](/pt/fundamentals/workflows)
- [Laços](/pt/techniques/loops)
- [Execuções aninhadas](/pt/techniques/nested-runs)
- [Arquitetura](/pt/best-practices/architecture)
