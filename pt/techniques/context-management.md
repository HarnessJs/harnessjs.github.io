# Janela de contexto

Todo turno reenvia o histórico inteiro. Um laço que roda doze voltas com uma tool
que devolve 4KB por vez está mandando ~50KB de conteúdo de arquivo velho na
última chamada — pagando por isso, e empurrando a pergunta de verdade para longe
da atenção do modelo.

O `contextWindow()` é um middleware `chat` pronto que apara isso.

```ts
import { contextWindow } from "@thenajs/core";

await app.use({
  name: "janela",
  chat: contextWindow({
    maxTurns: 12,
    maxChars: 60_000,
    maxCharsPerTool: 4_000,
  }),
});
```

## Meça antes de cortar

::: warning Ele não tem defaults, de propósito
Cortar histórico muda o comportamento do agente — ele pode perder o que precisava
lembrar, e de forma silenciosa. Um default aqui trocaria uma falha ruidosa e cara
por uma degradação muda, que é muito pior de diagnosticar.
:::

O número para olhar é o `promptTokens` nos nós `chat` do report. Se ele cresce
turno a turno e se aproxima da janela do seu modelo, apare. Se não, esta página
não é o seu problema.

## As opções

| Opção | O que faz |
| --- | --- |
| `maxTurns` | quantas mensagens do fim manter |
| `maxChars` | teto de caracteres do histórico; corta do começo até caber |
| `maxCharsPerTool` | teto por observação de tool |
| `warnIndexFailure` | a nota deixada no lugar do que foi cortado; `false` corta em silêncio |

::: tip `maxTurns` conta mensagens, não idas e voltas
Um turno com tool ocupa duas mensagens (`assistant` + `tool`), então
`maxTurns: 12` guarda cerca de 6 trocas.
:::

O `maxCharsPerTool` costuma ser o de maior valor. Saída de tool é o que mais
infla um histórico e o que envelhece mais rápido — o modelo raramente precisa de
um arquivo inteiro dez turnos depois.

## O que nunca é cortado

As mensagens `system` iniciais. Elas são o prompt do agente e a projeção do
`ctx.state.memory`, e cortá-las quebraria o agente em vez de economizar.

Preservar o começo tem um segundo benefício: mantém o prefixo estável para o
cache de prompt do provider. Cortar do topo invalidaria o desconto a cada turno.

## Diga que cortou

```ts
contextWindow({
  maxTurns: 12,
  warnIndexFailure: "[…histórico anterior omitido para caber na janela…]",
});
```

Uma nota explícita é melhor que um salto silencioso. Sem ela o modelo vê a
conversa começar no meio e pode repetir trabalho que já fez.

`false` corta sem avisar. Use só quando você tiver medido que a própria nota está
confundindo o modelo.

::: warning Sobre o nome dessa opção
O `warnIndexFailure` guarda o texto da nota, o que o nome dele não sugere — parece
uma renomeação mal feita. É API pública, então este é o nome real; espere que
mude numa versão futura.
:::

## Cortando na origem

Middleware é a resposta geral, mas a correção mais barata muitas vezes está na
tool:

```ts
const MAX = 4000;
return texto.length <= MAX ? texto : `${texto.slice(0, MAX)}\n… [truncado]`;
```

Uma tool que devolve um orçamento em vez de tudo que encontrou mantém o histórico
pequeno desde o começo — e consegue truncar com inteligência, o que um corte
genérico por caractere não consegue. Veja
[Projetar tools](/pt/techniques/tool-design).

## Resumir em vez de descartar

Numa conversa longa, descartar perde informação que um resumo guardaria. Não há
resumidor embutido; o formato é um middleware `chat` ou um hook `afterResponse`
que dobra os turnos velhos no `ctx.state.memory`:

```ts
export class WorkerAgent {
  async afterResponse(resposta: string, ctx: Context) {
    if (ctx.state.history.length < 20) return;

    const velhos = ctx.state.history.slice(0, -8);
    ctx.state.set("history", ctx.state.history.slice(-8));
    ctx.state.append("memory", `Antes: ${await resumir(velhos)}`);
  }
}
```

Como o `memory` vira mensagem `system` no topo, ele sobrevive a qualquer corte
posterior.

## Outras alavancas

**`numCtx`** (Ollama apenas) define a janela do próprio modelo. Aumentar custa
memória e tempo; não torna um histórico inchado uma boa ideia.

**Isole a parte ruidosa.** Uma subtarefa que leva dez voltas para produzir uma
linha pertence a uma [execução aninhada](/pt/techniques/nested-runs) — o pai vê
uma string em vez de dez turnos. Muitas vezes isso é melhor que cortar.

## Relacionado

- [Middleware e plugins](/pt/fundamentals/middleware)
- [Projetar tools](/pt/techniques/tool-design)
- [Execuções aninhadas](/pt/techniques/nested-runs)
- [Desempenho](/pt/best-practices/performance)
