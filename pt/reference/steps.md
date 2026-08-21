# Passos

Os blocos de construção do `@Workflow({ steps })`, mais os helpers para escrever
a condição de parada de um laço.

```ts
import {
  parallel,
  loop,
  untilAnswered,
  calledTool,
  turnOf,
  wasExhausted,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_FAILS,
} from "@thenajs/core";
```

## `parallel(steps)`

```ts
parallel([SegurancaAgent, PerfAgent]);
```

Roda os passos ao mesmo tempo, sobre o **mesmo estado**. Devolve um
`ParallelStep` (`{ kind: "parallel", steps }`).

Todo ramo lê o histórico como ele estava quando o bloco abriu, e os turnos dos
ramos são anexados na **ordem de declaração** — `parallel([A, B])` dá `A, B`
mesmo que `B` responda primeiro. `ctx.output` e `ctx.turn` são os do último ramo
declarado. Um ramo que lança cancela os irmãos e o bloco não anexa nada.

Leia os
resultados no histórico compartilhado, ou faça cada agente gravar num campo
próprio.

## `loop(options)`

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

| Opção | Tipo | Default |
| --- | --- | --- |
| `steps` | `WorkflowStep[]` | — |
| `until` | `(ctx, state?) => unknown` | — |
| `maxIterations` | `number` | `10` |
| `onExhausted` | `(ctx, iterations) => unknown` | — |
| `maxFails` | `number` | `5` |
| `onFail` | `(ctx, info: LoopFailure) => unknown` | — |

### `until`

**Devolve `true` para parar.** O segundo parâmetro é o estado declarado em
`@Workflow({ state })`, quando houver.

```ts
until: (ctx, s: RevisaoState) => s.aprovado;
```

Declarar esse segundo parâmetro num workflow sem `state` é pego antes de a
execução começar, pela aridade da função.

### `maxFails` e `LoopFailure`

O `maxFails` conta falhas de tool **consecutivas** — o sinal de estar preso é a
repetição, não o acúmulo. Um agente que erra, corrige e avança tem `total` alto e
`consecutive` baixo, que é exatamente o comportamento desejado. `Infinity`
desliga.

```ts
interface LoopFailure {
  consecutive: number; // uma tool que funciona zera isto
  total: number; // desde o início deste laço
  toolName?: string;
  message: string; // a observação de erro que voltou ao modelo
}
```

### `LoopStopReason`

Registrado no nó `loop` do report:

```ts
type LoopStopReason = "until" | "exhausted" | "fails" | "budget" | "stop";
```

## Helpers de parada

### `untilAnswered(ctx)`

Parar quando o agente responder **sem chamar tool**. O fim usual de um laço de
investigar e agir.

```ts
export const untilAnswered = (ctx) => !calledTool(ctx);
```

::: warning Resposta vazia conta como respondida
Um modelo que devolve `""` para o laço. Seja mais exigente quando isso importar:

```ts
until: (ctx) => {
  const t = turnOf(ctx);
  return !!t && !t.calledTool && !!t.response?.trim();
};
```

:::

### `turnOf(ctx)`

O resumo do último turno, ou `undefined`:

```ts
interface TurnInfo {
  calledTool: boolean;
  toolName?: string;
  toolError?: boolean;
  toolCallSource?: "native" | "rescued";
  response: string;
}
```

O `toolCallSource` é como se mede o quanto um modelo depende do resgate por
texto.

### `calledTool(ctx)`

`true` quando o modelo chamou uma tool no último turno.

### `wasExhausted(ctx)`

`true` quando o laço mais recente parou no `maxIterations` em vez de pelo
`until`. Útil num passo **depois** do laço.

## Constantes

| | Valor | Vale para |
| --- | --- | --- |
| `DEFAULT_MAX_ITERATIONS` | `10` | `loop({ maxIterations })` |
| `DEFAULT_MAX_FAILS` | `5` | `loop({ maxFails })` |

## Relacionado

- [Laços](/pt/techniques/loops) — escrever condições de parada
- [Execução paralela](/pt/techniques/parallel-execution)
- [`@Workflow`](/pt/reference/workflow)
