# Perguntas frequentes

## O que roda sem eu escrever?

Todo framework esconde alguma coisa. O problema não é esconder — é você não saber
**o quê**, e descobrir na hora errada. Esta é a lista.

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
| gravar a árvore da execução | `report` e `log` no config |

## Por que não dá para customizar a detecção de tool call?

Três linhas acima estão em negrito. Elas são o núcleo do framework e **não têm
gancho de customização**, de propósito.

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

Trocar `qwen2.5-coder` por `gpt-4o-mini` não deveria exigir mudar o seu código.
Como essa camada é do framework, não exige.

Se você precisa mesmo interferir aí, o ponto de extensão certo é escrever um
provider próprio.

## O que o framework *não* decide por mim?

- **Quando parar.** O `until` do laço é seu. Não há heurística escondida de "acho
  que terminou".
- **Quando buscar na memória.** Nada é injetado no prompt sozinho. Se você quer
  contexto vetorial, você chama `recall` onde fizer sentido.
- **Quanto gastar.** Sem `budget`, nada é medido nem limitado.
- **Como formatar contexto recuperado.** Você monta a string.

A regra: **o framework entrega o mecanismo, você escolhe a política.**

A única exceção honesta é o **retry, que vem ligado** — um `429` ou um `503`
momentâneo são reexecutados até 3 vezes, com espera crescente, porque uma falha
transitória de rede derrubar uma execução inteira quase nunca é o que se quer.
Desligue com `retry: false` no provider.

O timeout, esse sim, **não tem default**: um teto arbitrário abortaria um modelo
local lento que hoje funciona.

## O que acontece quando uma tool falha?

Vira observação, não exceção. O texto do erro volta ao modelo como resultado da
tool, e ele ganha outro turno para corrigir.

Isso cobre os casos recuperáveis — caminho errado, 404, timeout. Para as falhas
que o modelo não conserta (um bug no seu código, uma credencial expirada, um banco
fora do ar), lance `FatalToolError`: ela atravessa o agente e encerra a execução,
e a mensagem original nunca chega ao contexto do modelo nem ao report em disco.

```ts
import { FatalToolError } from "@thenajs/core";

throw new FatalToolError("banco indisponível", { cause: err });
```

## Preciso de workflow para um agente só?

Precisa, e é uma linha:

```ts
@Workflow({ steps: [MeuAgent] })
export class MeuWorkflow {}
```

A execução — o contexto dela, o orçamento, o cancelamento e o gravador — pertence
ao workflow, não ao agente. Deixar o caso de um agente só pular isso significaria
dois modelos de execução diferentes.

## O `Thena.create` é async?

Não. Montar o app não espera nada. Quem espera é o `app.run`.

O `bootstrapWorkflow` é a forma antiga, `async`, e está **depreciado**; continua
funcionando para não quebrar código da 0.6.

## Dá para rodar vários agentes ao mesmo tempo num processo?

Dá. Cada `app.run(...)` abre o próprio contexto de execução — estado, orçamento,
cancelamento e gravador próprios. Duas requisições concorrentes nunca enxergam os
dados uma da outra.

## Quais modelos funcionam?

Qualquer um que o Ollama ou a OpenAI sirvam, mais qualquer um para o qual você
escreva um provider. Na prática, o que separa os modelos é a tool call: um modelo
que não emite chamada estruturada vai depender do resgate por texto do framework —
funciona, mas é sinal de que você está no limite do que aquele modelo dá conta.
Confira o `toolCallSource` nos nós `chat` do report: `"rescued"` significa
exatamente isso.

## Por que a resposta muda a cada execução?

Esperado sem `sampling`. Para iterar sobre o comportamento do agente, fixe:

```ts
sampling: { temperature: 0, seed: 42 }
```

O `seed` só tem efeito junto da temperatura baixa. Sem isso, você não consegue
distinguir "minha mudança melhorou" de "deu sorte".

## O ThenaJS lê variável de ambiente?

Não. Não existe `THENA_*` para aprender. Credencial vai onde você puser —
`process.env.OPENAI_API_KEY` na sua própria classe de provider. O framework nunca
busca um global, então dois providers no mesmo processo podem usar duas chaves
diferentes.

## Onde eu reporto um bug?

Em [github.com/thenajs/ThenaJS/issues](https://github.com/thenajs/ThenaJS/issues),
com o `report/<runId>/report.json` da execução — ele tem a árvore completa e é o
que mais ajuda. Veja [Suporte](/pt/help/support).
