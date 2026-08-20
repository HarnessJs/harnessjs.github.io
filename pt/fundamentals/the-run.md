# A execução

Uma execução tem três camadas encaixadas. Entender a ordem resolve a maior parte
das dúvidas de "por que isso aconteceu antes daquilo".

## A visão de cima

```
app.run()
 └─ workflow
     └─ passo 1, passo 2, passo 3…        ← a ordem que você declarou em `steps`
         └─ cada passo é um agente, um `parallel` ou um `loop`
             └─ turno do agente
                 ├─ monta as mensagens
                 ├─ chama o modelo
                 ├─ se pediu tool: valida, executa, guarda o resultado
                 └─ devolve a resposta
```

O `loop` repete o bloco interno até o `until` ser verdadeiro. O `parallel` roda
os passos ao mesmo tempo, sobre o mesmo estado.

## Um turno de agente, em detalhe

É aqui que os hooks entram. A ordem exata:

```
beforePrompt(prompt, ctx)          ← altera o system prompt
        ↓
   chamada ao modelo
        ↓
   pediu tool?
   ├─ sim → beforeTool(call, ctx)   ← troca args, ou `throw` cancela
   │          ↓
   │       execute(args)            ← seu código, com args já validados
   │          ↓
   │        afterTool(result, ctx)  ← transforma o resultado
   └─ não → (segue)
        ↓
afterResponse(response, ctx)        ← transforma a resposta do turno
        ↓
   grava ctx.turn e ctx.output

  qualquer throw acima → onError(error, ctx)
```

Todos os hooks são opcionais. Sem nenhum, o turno acontece igual — eles só
existem para quando você precisa entrar no meio.

::: tip Contrato dos hooks
Retornar um valor **substitui**. Retornar `undefined` **mantém** o original. É
por isso que um `beforePrompt` que só quer observar pode simplesmente não
retornar nada.
:::

## Um turno é uma chamada, não a tarefa toda

A distinção que confunde no começo: **um turno do agente é uma volta só** — uma
chamada ao modelo e, no máximo, uma tool.

Se a tarefa exige investigar antes de responder, ela exige várias voltas. É para
isso que serve o `loop`:

```ts
loop({ steps: [LeitorAgent], until: untilAnswered, maxIterations: 8 });
```

Sem o laço, o agente chamaria uma tool e o workflow terminaria ali — com o
resultado da tool como saída, sem o modelo ter tido chance de interpretá-lo.

## O que sobrevive entre os passos

Todos os passos de um workflow compartilham o **mesmo estado**. Um agente anexa o
turno dele ao histórico; o próximo agente já enxerga a conversa até ali.

Isso tem uma consequência que vale saber antes de ser mordido por ela: a resposta
de um passo entra no próximo como fala do assistente. Veja
[Estado e contexto](/pt/fundamentals/state-and-context) para promovê-la a
contexto.

## O tempo de vida da execução

Tudo que tem escopo de execução nasce no `app.run()` e é desmontado quando ela
termina:

| | |
| --- | --- |
| `runId` | disponível de forma síncrona, antes do primeiro turno |
| estado | uma instância da classe de `@Workflow({ state })` |
| tracker de orçamento | só se um `budget` foi passado |
| gravador | só se a execução estiver sendo observada |
| `AbortSignal` | o seu, combinado com o `abort()` do handle |
| limpezas | `ctx.onDispose(fn)`, na ordem inversa, em sucesso, erro ou abort |

Execuções concorrentes nunca se enxergam. Duas requisições num processo abrem
cada uma o próprio `RunContext`.

## Encerrando antes

Duas coisas diferentes, e a diferença importa:

- **`ctx.abort(reason)`** — cancela. O turno em voo é interrompido e a `reason`
  chega no `catch` de quem chamou.
- **`ctx.stop()`** — encerra **graciosamente**. Os passos seguintes são pulados e
  a execução devolve a saída que já tinha, sem lançar. É o mesmo comportamento do
  orçamento no modo `"stop"`.

## Onde ver isso acontecendo

Ligue o log e a árvore aparece ao vivo:

```ts
export const config: ThenaConfig = { log: true };
```

```
[thena] ▸ workflow LeitorWorkflow
[thena]   ▸ loop
[thena]     ▸ agent LeitorAgent
[thena]       ▸ chat
[thena]         ▸ tool read_file
[thena]         ◂ tool read_file  12ms ✓
[thena]       ◂ chat  1.84s ✓
[thena]     ◂ agent LeitorAgent  1.85s ✓
```

Com `report: true` você ganha o mesmo em HTML, com o conteúdo de cada passo. Com
`thenaFlow()`, um grafo ao vivo no navegador.

::: warning Uma execução sem observador não grava nada
Sem `report`, sem `log`, sem plugin e sem `observe: true`, não há árvore de
execução, não há eventos e não há pedido de streaming ao provider. É o caminho de
custo zero e vale cerca de 2× em tempo de CPU — mas é também por isso que o
`onEvent` pode parecer quebrado. Veja [Streaming](/pt/fundamentals/streaming).
:::

## Relacionado

- [O que é automático](/pt/fundamentals/whats-automatic) — a lista exata
- [Estado e contexto](/pt/fundamentals/state-and-context)
- [Hooks](/pt/fundamentals/hooks)
