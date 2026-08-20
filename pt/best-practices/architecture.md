# Arquitetura

Como organizar um projeto ThenaJS, e onde colocar uma decisão para ela ficar onde
você a colocou.

## O layout dos arquivos

O formato do CLI, e ele se sustenta:

```
src/
  agents/
    explorer/
      explorer.agent.ts       # a classe
      explorer.agent.md       # o prompt
  tools/
    read-file.tool.ts
  providers/
    ollama.provider.ts
  workflows/
    explorer.workflow.ts
    explorer.state.ts         # a classe de estado, ao lado do workflow
  config.ts
  main.ts
```

**Uma pasta por agente**, porque o `.ts` e o `.md` são uma unidade e o caminho em
`prompt: "./x.agent.md"` é resolvido a partir do arquivo do agente.

**O estado ao lado do workflow**, porque ele não significa nada sem ele.

**O `main.ts` só liga os fios**: cria o app, registra plugins, executa, encerra.
Qualquer coisa que decida *o que o agente faz* pertence a um agente, uma tool ou
um workflow.

## Onde uma decisão pertence

A pergunta que aparece o tempo todo: *"onde essa lógica vai?"*

| A lógica é… | Coloque em |
| --- | --- |
| como o agente deve se comportar | o prompt `.md` |
| uma ação que o modelo pode escolher | uma `@Tool` |
| a ordem dos passos | `@Workflow({ steps })` |
| quando parar de repetir | o `until` do `loop` |
| uma decisão que um passo passa a outro | `@Workflow({ state })` |
| algo que um agente faz em volta do turno dele | um hook |
| algo que *todo* agente faz | um middleware de plugin |
| o que esta execução carrega e o modelo não pode ver | `run({ data })` |
| o que o modelo precisa saber nesta execução | `run({ memory })` |

Dois modos de falha vêm de errar isso: controle de fluxo escrito dentro de
prompts ("se você já conferiu três arquivos, pare"), e conteúdo de prompt escrito
dentro do código (um `beforePrompt` que monta instruções que um `.md` deveria
guardar).

## Prompt em markdown, lógica em TypeScript

A separação é a aposta central do framework:

```ts
@Agent({ provider: P, tools: [ReadFileTool], prompt: "./explorer.agent.md" })
export class ExplorerAgent {}
```

Prompt muda o tempo todo, e por motivos diferentes dos que fazem o código mudar.
Num `.md`, um ajuste de prompt é um diff de prompt — ele é revisado como prosa,
porque é prosa.

O corolário: **não monte prompt em código.** Um `beforePrompt` que acrescenta
contexto recuperado está certo; um que monta as instruções do agente a partir de
fragmentos de string devolveu o prompt para o TypeScript, e perdeu o benefício.

## Controle de fluxo é código, não prosa

Qualquer coisa que o modelo possa errar, e que você não pode deixar que ele erre,
pertence ao workflow e não ao prompt.

```ts
// ✗ no prompt: "Depois de revisar, se estiver aprovado, pare."
// ✓ no workflow:
loop({
  steps: [ExecutorAgent, RevisorAgent],
  until: (_ctx, s: RevisaoState) => s.aprovado,
  maxIterations: 5,
});
```

O prompt pede que o revisor *diga* APROVADO. O código decide o que isso
*significa*. Um regex sobre prosa em três lugares é o que se ganha ao pular a
classe de estado.

## Comece com um agente

O instinto de dividir cedo costuma estar errado. Cada agente a mais é mais um
prompt para manter e pelo menos mais uma chamada ao modelo por execução.

Divida quando conseguir nomear o motivo: tools diferentes, sampling diferente,
modelo diferente, ou um precisa julgar o outro. Toda divisão deveria deixar algum
prompt **mais curto** — se todos ficaram mais longos, o corte foi errado. Veja
[Sistemas multiagente](/pt/techniques/multi-agent-systems).

## Histórico compartilhado ou isolamento

A outra decisão estrutural, e ela se repete em todo nível:

| | Step no workflow | Tool disparando execução aninhada |
| --- | --- | --- |
| Histórico | compartilhado com o pai | próprio |
| A saída vira | um turno `assistant` | uma observação de tool |
| Quem decide se roda | você | o modelo |
| Custo de contexto | todos os turnos | uma string |

**Compartilhado** quando o pai precisa ver o caminho. **Isolado** quando só o
resultado importa, ou a subtarefa é ruidosa. Veja
[Execuções aninhadas](/pt/techniques/nested-runs).

## Mantenha as tools puras por padrão

Uma tool que recebe só `@input()` é uma função comum — testável com `new` e uma
chamada, sem framework:

```ts
expect(await new ReadFileTool().execute({ path: "x" })).toBe("…");
```

Cada `@context()` ou `@state()` abre mão disso. Acrescente quando realmente
precisar do signal, do estado ou de uma execução aninhada.

## Dois apps são melhores que um app com desvio

O formato do workflow é compilado no `Thena.create` e não muda por execução.
Quando dois tipos de requisição precisam de formatos diferentes, monte dois:

```ts
const rapido = Thena.create(RapidoWorkflow, config);
const profundo = Thena.create(ProfundoWorkflow, config);
```

Eles são baratos — o `create` é síncrono e não faz I/O — e isso é melhor que um
workflow com um agente que não faz nada metade do tempo.

## O que pertence a fora do framework

Persistência, autenticação, rate limiting, filas, retentativas dos *seus* próprios
serviços, e a camada HTTP. O ThenaJS roda agentes; ele não é um framework de
aplicação.

O `run({ memory })` é semeado por você e não persiste. Se uma conversa precisa
sobreviver entre execuções, a sua aplicação carrega e passa.

## Relacionado

- [Sistemas multiagente](/pt/techniques/multi-agent-systems)
- [Estado e contexto](/pt/fundamentals/state-and-context)
- [Escrever prompts](/pt/best-practices/prompt-design)
- [Testes](/pt/best-practices/testing)
