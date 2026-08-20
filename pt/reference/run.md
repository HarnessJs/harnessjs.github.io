# Run e `RunHandle`

```ts
const app = Thena.create(MeuWorkflow, config); // não é async
const exec = app.run({ input: { message: "oi" } });
const resultado = await exec;
await app.dispose();
```

## `Thena.create(ClasseDoWorkflow, config?)`

Devolve um `WorkflowApp`. **Não é async** — montar o app não espera nada.

```ts
Thena.create<T = string, D extends RunData = RunData>(
  ClasseDoWorkflow, config?: ThenaConfig
): WorkflowApp<T, D>
```

`T` é o tipo da saída da execução; `D` tipa o `run({ data })` e o
`context<D>().data`.

::: tip `bootstrapWorkflow` é a forma `async` depreciada
Continua funcionando para não quebrar código da 0.6. Use o `Thena.create`.
:::

## `WorkflowApp`

| Membro | O que faz |
| --- | --- |
| `run(options)` | inicia uma execução, devolve um `RunHandle` **de forma síncrona** |
| `use(plugin)` | acopla um plugin. Dê `await`, e chame **antes** do `run` |
| `dispose()` | aborta as execuções em voo, espera elas soltarem, encerra os plugins |

Chamadas concorrentes ao `run` são seguras: cada uma abre o próprio `RunContext`.

## `WorkflowRunOptions`

```ts
await app.run({
  input: { message: "Revise src/" },
  memory: { userId: "123" },
  data: { contaId: "acme" },
  budget: { maxChatCalls: 20 },
  signal: AbortSignal.timeout(30_000),
  observe: true,
  report: false,
  log: "verbose",
});
```

| Opção | Tipo | Observações |
| --- | --- | --- |
| `input` | `WorkflowInput` | `message` vira a entrada inicial; senão o objeto inteiro é serializado |
| `memory` | `Record<string, unknown>` | semeado no `memory` do estado — **o modelo lê** |
| `data` | `D` | o seu canal — **nunca vai ao modelo nem ao report** |
| `budget` | `RunBudget` | sem ele, nada é medido |
| `signal` | `AbortSignal` | combina com o `abort()` do handle; o primeiro a disparar vence |
| `observe` | `boolean` | força a observação ligada |
| `report` | `boolean \| ReportOptions` | sobrescreve o `ThenaConfig` nesta execução |
| `log` | `LogConfig` | sobrescreve o `ThenaConfig` nesta execução |

## `RunHandle`

É `PromiseLike`, então `await` devolve o resultado. Sem `await`, você tem a
execução.

| Membro | Tipo | Observações |
| --- | --- | --- |
| `runId` | `string` | **síncrono**, antes do primeiro turno |
| `result` | `Promise<T>` | Promise comum — compõe com `Promise.all` |
| `signal` | `AbortSignal` | o seu combinado com o `abort()` deste handle |
| `abort(reason?)` | `void` | a `reason` chega no `catch` de quem chamou |
| `onEvent(cb)` | `() => void` | devolve como cancelar a assinatura |
| `eventStream` | `AsyncIterable<ExecutionEvent>` | dá backpressure |
| `onToken(cb)` | `() => void` | devolve como cancelar a assinatura |
| `textStream` | `AsyncIterable<string>` | |
| `then` / `catch` / `finally` | | devolvem Promises comuns — encadear **descarta** o handle |

Quem assina atrasado recebe o que já passou antes dos itens novos, num buffer de
até 500 eventos.

::: warning Nada é emitido a menos que a execução seja observada
A observação liga com `report`, `log`, um plugin com `onEvent`, ou um `observe:
true` explícito. Senão a execução segue o caminho de custo zero — sem árvore, sem
eventos, sem streaming — e você recebe um aviso único no console.
:::

Veja [Streaming](/pt/fundamentals/streaming).

## `RunBudget`

```ts
budget: {
  maxDurationMs: 60_000,
  maxChatCalls: 20,
  maxToolCalls: 50,
  maxTokens: 100_000,
  maxCostUsd: 0.5,
  mode: "stop",
  onExceeded: (info) => console.warn(info.reason),
}
```

| Chave | Observações |
| --- | --- |
| `maxDurationMs` | tempo de parede da execução inteira |
| `maxChatCalls` | chamadas ao modelo |
| `maxToolCalls` | execuções de tool |
| `maxTokens` | prompt + completion, só o que o provider reporta |
| `maxCostUsd` | exige `costPer1kTokens` no provider |
| `mode` | `"stop"` (default) encerra graciosamente; `"throw"` lança `BudgetExceededError` |
| `onExceeded` | chamado uma única vez, quando o orçamento estoura |

```ts
interface BudgetUsage {
  chatCalls: number;
  toolCalls: number;
  tokens: number;
  costUsd: number;
  elapsedMs: number;
}
```

Leia no meio da execução com `ctx.usage()` ou `ctx.budget`.

::: warning O teto é uma barreira, não um corte no meio da frase
A parada é checada **entre** unidades de trabalho, e uma chamada ao modelo só é
contabilizada depois de responder. A execução pode gastar mais uma chamada além
do limite — e mais uma por nível de aninhamento quando uma tool dispara um
sub-workflow. É um limite superior conhecido e constante.
:::

Uma execução aninhada conta no orçamento do pai. Passe um `budget` explícito ao
`runtime.run()` para dar a ela um teto próprio; corta quem estourar primeiro.

## Relacionado

- [Configuração](/pt/get-started/configuration)
- [`ThenaConfig`](/pt/reference/thena-config)
- [Orçamentos](/pt/techniques/budgets)
- [Cancelamento](/pt/techniques/cancellation)
