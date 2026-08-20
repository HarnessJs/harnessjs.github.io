# Laços

Um `loop` repete os passos dele até o `until(ctx)` devolver algo verdadeiro.
Escrever essa condição é onde mora a maior parte do raciocínio.

```ts
loop({
  steps: [ExecutorAgent],
  until: untilAnswered,
  maxIterations: 8,
});
```

## `true` significa parar

O erro mais comum é ler ao contrário. O `until` responde *"terminamos?"*, e não
*"continuamos?"*.

## A condição pronta

```ts
import { untilAnswered } from "@thenajs/core";
```

Parar quando o agente responder **sem chamar tool** — o fim natural de um laço de
investigar-e-responder. O modelo chama tools enquanto precisa de informação, e
produz prosa quando está pronto.

::: warning Resposta vazia conta como respondida
Um modelo que devolve `""` para o laço na primeira volta. Se isso acontecer, seja
mais exigente:

```ts
import { turnOf } from "@thenajs/core";

until: (ctx) => {
  const t = turnOf(ctx);
  return !!t && !t.calledTool && !!t.response?.trim();
};
```

:::

## Parando pelo seu critério

Quando "terminou" é uma decisão, e não um formato, ponha no estado:

```ts
export class RevisaoState {
  aprovado = false;
  rodadas = 0;
}
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

```ts
loop({
  steps: [LeitorAgent, RevisorAgent],
  until: (_ctx, s: RevisaoState) => s.aprovado,
  maxIterations: 5,
});
```

Alguém precisa **gravar** o que o `until` lê. Um laço que sempre bate no teto
quase sempre significa que ninguém nunca gravou o campo.

## Sempre ponha um teto

O `maxIterations` tem default `10`. Deixá-lo implícito está ok; deixar o
`onExhausted` de fora é como você não percebe:

```ts
loop({
  steps: [ExecutorAgent],
  until: minhaCondicao,
  maxIterations: 8,
  onExhausted: (ctx, n) => console.warn(`[app] teto após ${n} rodadas`),
});
```

Sem ele, "o agente funciona mas as respostas são ruins" e "o laço nunca converge"
são indistinguíveis de fora.

Depois do laço, o `wasExhausted(ctx)` conta a um passo posterior qual foi o caso:

```ts
import { wasExhausted } from "@thenajs/core";

@Workflow({ steps: [loop({ … }), ResumidorAgent] })
```

```ts
export class ResumidorAgent {
  async beforePrompt(prompt: string, ctx: Context) {
    if (wasExhausted(ctx)) {
      return `${prompt}\n\nA investigação não convergiu. Diga o que ficou em aberto.`;
    }
  }
}
```

## Parando por falha repetida

O `maxFails` (default `5`) encerra o laço depois dessa quantidade de falhas de
tool **consecutivas**:

```ts
loop({
  steps: [ExecutorAgent],
  until: untilAnswered,
  maxFails: 3,
  onFail: (ctx, info) => console.warn(`${info.consecutive}× — ${info.message}`),
});
```

Consecutivas, e não totais, é o ponto: um agente que erra, corrige e avança tem
`total` alto e `consecutive` baixo, e não deveria ser cortado. `Infinity`
desliga.

## Compondo condições

O `until` é uma função comum, então combine à vontade:

```ts
until: (ctx, s: RevisaoState) =>
  s.aprovado || s.rodadas >= 3 || (ctx.budget?.costUsd ?? 0) > 0.25;
```

Ler `ctx.budget` dentro do `until` é como se escreve uma política de custo que o
framework não opina. Ele só é populado quando a execução tem `budget`.

## Por que um laço, afinal

Sem um, um passo de agente é um turno só: uma chamada ao modelo e no máximo uma
tool. O agente chama `read_file`, e o workflow termina com o conteúdo do arquivo
como saída — o modelo nunca chegou a interpretá-lo.

```ts
@Workflow({ steps: [LeitorAgent] })                        // um turno
@Workflow({ steps: [loop({ steps: [LeitorAgent], … })] })  // investiga
```

## Laços dentro de laços

Eles se aninham, e o `until` interno roda sobre o mesmo `ctx`:

```ts
loop({
  steps: [
    PlannerAgent,
    loop({ steps: [ExecutorAgent], until: untilAnswered, maxIterations: 5 }),
  ],
  until: (_ctx, s: MeuState) => s.terminou,
  maxIterations: 3,
});
```

Vale olhar a multiplicação: 3 × 5 são até 15 turnos do executor. É aqui que um
`budget` de execução se justifica.

## Erros comuns

**A condição está invertida.** `true` para.

**Ninguém grava o campo.** Acrescente `onExhausted` e descubra.

**`untilAnswered` num workflow cujo último passo não é o agente.** O resumo do
turno é o do *último* passo, então um `loop` que termina num passo que não é
agente lê o que aquilo deixou.

**Declarar o 2º parâmetro do `until` sem `state`.** Pego antes de a execução
começar, pela aridade da função.

## Relacionado

- [Passos](/pt/reference/steps) — `loop`, helpers de `until`, `LoopFailure`
- [Workflows](/pt/fundamentals/workflows)
- [Orçamentos](/pt/techniques/budgets)
