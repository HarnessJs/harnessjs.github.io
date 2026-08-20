# O que é automático

Todo framework esconde alguma coisa. O problema não é esconder — é você não saber
**o quê**, e descobrir na hora errada.

Esta página é a lista completa. Se algo acontece sem você mandar, está aqui.

## Feito por você

| Acontece sozinho | Onde você entra |
| --- | --- |
| montar as mensagens (`system`, `user`, `assistant`, `tool`) | o hook `beforePrompt` altera o system |
| chamar o modelo com as tools declaradas | `sampling` no provider ou no `@Agent` |
| **detectar que o modelo pediu uma tool** | *(fechado — veja abaixo)* |
| **validar os argumentos contra o schema Zod** | você escreve o schema |
| **executar a tool e devolver o resultado** | os hooks `beforeTool` / `afterTool` |
| anexar cada turno ao histórico | `ctx.state` é público e editável |
| repetir enquanto o `until` do laço não for verdadeiro | você escreve o `until` |
| criar o estado do workflow, um por execução | você declara a classe em `@Workflow({ state })` |
| tentar de novo numa falha transitória de rede | `retry` no provider |
| mascarar segredos conhecidos no conteúdo capturado | `redact` no config |
| gravar a árvore da execução | `report` e `log` no config |

## A parte deliberadamente fechada

Três linhas estão em negrito. Elas são o núcleo do framework e **não têm gancho
de customização** — de propósito.

Quando o modelo responde, alguém precisa decidir: isso é resposta final ou pedido
de tool? Feito à mão, esse código vira uma pilha de condicionais que muda a cada
modelo:

```ts
// o que você NÃO escreve
if (resposta.tool_calls?.length) { … }
else if (resposta.content?.startsWith("{")) { …tentar parsear… }
else if (resposta.content?.includes("<tool_call>")) { …outro formato… }
```

É ali que moram os bugs mais chatos de agente: um modelo pequeno emite a chamada
como texto em vez de usar o campo estruturado, e o agente encerra achando que
respondeu. O framework trata isso — inclusive resgatando chamadas escritas como
texto, em vários formatos — e você nunca vê.

::: tip Por que isso é bom
Trocar `qwen2.5-coder` por `gpt-4o-mini` não deveria exigir mudar o seu código.
Como essa camada é do framework, não exige.
:::

Se você precisa mesmo interferir aí, o ponto de extensão certo é escrever um
provider — a resposta para "meu backend fala diferente".

## O que **não** é automático

Igualmente importante: o framework **não** decide por você.

- **Quando parar.** O `until` do laço é seu. Não há heurística escondida de "acho
  que terminou".
- **Quando buscar na memória.** Nada é injetado no prompt sozinho. Se você quer
  contexto vetorial, você chama `recall` onde fizer sentido.
- **Quanto gastar.** Sem `budget`, nada é medido nem limitado.
- **Como formatar contexto recuperado.** Você monta a string.
- **Quando uma falha de tool deve ser fatal.** Tudo é recuperável, a menos que
  você lance `FatalToolError`.

A regra que seguimos: **o framework entrega o mecanismo, você escolhe a
política.**

## O que muda de comportamento por padrão

Uma exceção honesta à regra acima. O **retry vem ligado**: um `429` ou um `503`
momentâneo são reexecutados até 3 vezes, com espera crescente.

Foi decisão deliberada — falha transitória de rede derrubando uma execução
inteira é quase sempre indesejado. Para desligar:

```ts
super({ host, model, retry: false });
```

O timeout, esse sim, **não tem valor padrão**: um teto arbitrário abortaria um
modelo local lento que hoje funciona. Ligue quando quiser
([Providers](/pt/fundamentals/providers)).

O segundo é o **mascaramento**, também ligado: padrões conhecidos de segredo são
escondidos em tudo que é capturado, antes de chegar ao report, ao log ou a um
plugin. Um arquivo em disco, sem retenção nem controle de acesso, é o pior lugar
para um segredo aparecer por descuido.

## O que é *condicionalmente* automático

A observação. Uma execução monta a árvore, emite eventos e pede streaming ao
provider **só quando alguém está olhando** — `report`, `log`, um plugin com
`onEvent`, ou um `observe: true` explícito.

Sem nenhum deles, a execução segue o caminho de custo zero: sem árvore, sem
eventos, sem streaming. Vale cerca de 2× em tempo de CPU por execução, e é o
motivo de o `onEvent` poder parecer não fazer nada.

## Onde você pode entrar

Do mais leve ao mais invasivo:

| Precisão | Ferramenta |
| --- | --- |
| ajustar o prompt final | hook `beforePrompt` |
| inspecionar ou barrar uma tool | hook `beforeTool` (um `throw` cancela) |
| transformar o resultado de uma tool | hook `afterTool` |
| transformar a resposta do agente | hook `afterResponse` |
| tratar erro sem derrubar | hook `onError` |
| receber o contexto ou o estado numa tool | `@context()`, `@state()` nos parâmetros |
| escolher qual memória vetorial | `@memory(Store)` no construtor |
| mexer no histórico e no contexto | `ctx.state`, público |
| controlar o laço | o `until` do `loop` |
| envolver cada tool ou cada chamada ao modelo | `app.use({ tool, chat })` |
| falar com outro backend | escrever um provider |
| assumir o turno inteiro | método `run(input, ctx)` na classe do agente |

Esse último é o escape hatch total: se a classe do agente define `run`, ela toma
conta do passo e **nenhum hook é chamado**.

## Relacionado

- [A execução](/pt/fundamentals/the-run) — a ordem exata em que tudo isso acontece
- [Hooks](/pt/fundamentals/hooks)
- [Middleware e plugins](/pt/fundamentals/middleware)
