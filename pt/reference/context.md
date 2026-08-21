# Contexto

O objeto que atravessa todos os passos de uma execução. `Context` é o nome
preferido; `AgentContext` é o mesmo tipo, mantido como alias.

```ts
import type { Context } from "@thenajs/core";
```

## Forma

```
ctx                    ← controles da execução, campos do runtime, e os seus
 └─ ctx.state          ← a conversa que o modelo efetivamente vê
```

Qualquer campo que você escrever é aceito, tipado como `unknown`:

```ts
ctx.tentativas = ((ctx.tentativas as number) ?? 0) + 1;
```

Para o que os passos realmente trocam entre si, prefira o estado tipado do
workflow (`@Workflow({ state })`).

## Controles da execução

Estes pertencem à **execução**, não ao passo. Num bloco `parallel` cada ramo tem
o próprio contexto de passo — `context()` dentro de um ramo resolve para aquele
ramo — enquanto estes valem para a execução inteira.

| Membro | Tipo | Observações |
| --- | --- | --- |
| `runId` | `string` | o mesmo id de todo `ExecutionEvent` |
| `data` | `D` | o seu canal. **Nunca vai para o modelo.** Sempre presente — `{}` quando não informado |
| `signal` | `AbortSignal` | repasse ao seu `fetch` para o cancelamento chegar dentro |
| `usage()` | `BudgetUsage` | consumo acumulado até aqui |
| `abort(reason?)` | `void` | cancela; o turno em voo é interrompido |
| `stop()` | `void` | encerra **graciosamente** — passos seguintes pulados, saída mantida, sem lançar |
| `onDispose(fn)` | `void` | limpeza para o fim da execução, ordem inversa, como um `defer` |
| `meta(dados)` | `void` | telemetria no nó deste passo; no-op sem observação |

```ts
const conn = await pool.acquire();
ctx.onDispose(() => conn.release());
```

O `data` é tipado por você:

```ts
type MinhaExecucao = { contaId: string };
const app = Thena.create<string, MinhaExecucao>(Fluxo, config);
context<MinhaExecucao>().data.contaId; // string, sem cast
```

::: tip Use `type`, não `interface extends`
Uma interface que estende a forma de `RunData` herda o índice livre dela, então
um campo escrito errado vira `unknown` em vez de erro de compilação.
:::

## Campos do runtime

| Campo | Tipo |
| --- | --- |
| `turn` | `TurnInfo` — resumo do último turno |
| `output` | a saída do último passo |
| `budget` | `BudgetUsage`, presente quando há `budget` |

```ts
interface TurnInfo {
  calledTool: boolean;
  toolName?: string;
  toolError?: boolean;
  toolCallSource?: "native" | "rescued";
  response: string;
}
```

## `ctx.state`

Três buckets, cada um vira parte do prompt:

| Bucket | Tipo | Chega ao modelo como |
| --- | --- | --- |
| `history` | `Message[]` | as mensagens, em ordem |
| `memory` | `string[]` | uma mensagem `system` no topo |
| `tasks` | `string[]` | uma nota dentro da mensagem `system` |

```ts
ctx.state.append("memory", "O usuário prefere respostas curtas");
ctx.state.set("history", ctx.state.history.slice(0, -1));
```

O `run({ memory })` semeia o bucket `memory`.

## `abort()` e `stop()`

| | `abort(reason)` | `stop()` |
| --- | --- | --- |
| A execução | rejeita com a `reason` | resolve com a saída que já havia |
| Passos seguintes | interrompidos | pulados |
| Turno em voo | interrompido | termina |

O `stop()` é o mesmo comportamento do orçamento no modo `"stop"`.

## `context()` como função

O mesmo export é chamável e devolve o contexto de onde você estiver:

```ts
provider: () => new OpenAIProvider({ apiKey: chaveDe(context().data) });
```

Dentro de um passo vem o contexto do passo, com `state` e `turn`. Fora dele —
numa factory de provider, que roda na compilação — vem o da execução, e tocar em
`state` lança com a explicação.

## Relacionado

- [Estado e contexto](/pt/fundamentals/state-and-context) — o conceito
- [Injeção](/pt/reference/injection)
- [Run e RunHandle](/pt/reference/run)
