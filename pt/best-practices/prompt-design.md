# Escrever prompts

O prompt é um arquivo markdown ao lado do agente. É o arquivo de maior alavancagem
do projeto, e o que mais costuma ser tratado com descaso.

```md
<!-- src/agents/explorer/explorer.agent.md -->

Você explora projetos de software.

Use as tools para investigar antes de responder. Prefira ler a chutar.

Responda em um parágrafo curto. Se não tiver certeza, diga isso.
```

## Diga o que fazer, não o que não fazer

Modelos seguem instrução positiva muito melhor que proibição.

```md
✗ Não responda sem ler os arquivos.
✓ Antes de responder, leia os arquivos relevantes.
```

Um prompt que é uma lista de coisas a não fazer também tende a crescer para
sempre, porque cada nova falha acrescenta uma linha.

## Mande agir

A causa mais comum de "ele descreveu o que faria em vez de fazer" é um prompt que
nunca mandou agir. A presença das tools não é uma instrução.

```md
Antes de responder, leia os arquivos relevantes com `read_file`.
```

A segunda causa mais comum é a `description` da tool — veja
[Projetar tools](/pt/techniques/tool-design).

## Dê forma à condição de parada

Quando o `until` de um laço lê uma decisão da resposta, o prompt precisa tornar
essa decisão inequívoca:

```md
Se o trabalho atende a todos os critérios, responda exatamente `APROVADO` e nada
mais. Caso contrário, liste o que falta.
```

```ts
this.state.aprovado = /\bAPROVADO\b/.test(resposta);
```

::: tip Dê ao crítico um jeito de dizer sim
Um revisor instruído apenas a achar problemas sempre acha um, e o laço nunca
converge. Declare a condição de aprovação explicitamente.
:::

## Estruture com títulos

Markdown não é enfeite — é estrutura que o modelo usa:

```md
Você revisa pull requests procurando problemas de segurança.

## O que conferir

- validação de entrada em qualquer coisa que chegue numa query
- segredos em código ou configuração

## Como responder

Responda `APROVADO`, ou uma lista numerada de problemas com arquivo e linha.
```

Seções curtas são melhores que um parágrafo só. Uma parede de texto enterra a
instrução que importa.

## Ponha exemplos, mas poucos

Um ou dois exemplos concretos do *formato de saída* costumam valer mais que três
parágrafos descrevendo-o. Além disso você está gastando contexto a cada turno com
retorno decrescente — e exemplos são o que um `contextWindow()` não corta, porque
estão na mensagem `system`.

## O que não pertence ao prompt

**Controle de fluxo.** "Depois de três tentativas, pare" pertence ao `until` e ao
`maxIterations`, onde é aplicado em vez de esperado.

**Segredos.** Tudo no prompt vai para o modelo e para o report. Use o
[`run({ data })`](/pt/fundamentals/state-and-context#memory-e-data).

**Fatos por execução.** O nome de um usuário, um plano, uma conta — isso vai no
`run({ state })`, que vira mensagem `system`. O `.md` é o mesmo para toda
execução.

**Descrição de tool.** Descreva a tool no `@Tool({ description })` dela. Dizer
duas vezes significa manter duas cópias em sincronia.

## Iterando

Fixe o sampling primeiro, ou você não distingue melhoria real de sorte:

```ts
sampling: { temperature: 0, seed: 42 }
```

Então mude **uma coisa por vez**, e leia o prompt que o modelo de fato recebeu:

```ts
log: "verbose";
```

Isso imprime o prompt final — depois do `beforePrompt`, depois da projeção do
estado. A maioria das surpresas acaba sendo algo acrescentado que você esqueceu,
e não o `.md`.

## Sampling por agente

Prompt e sampling trabalham juntos. Um prompt pedindo análise cuidadosa briga com
um `temperature: 0.9`:

```ts
@Agent({ provider: Compartilhado, prompt: "./planner.agent.md",
         sampling: { temperature: 0 } })
export class PlannerAgent {}

@Agent({ provider: Compartilhado, prompt: "./escritor.agent.md",
         sampling: { temperature: 0.8 } })
export class EscritorAgent {}
```

Determinismo onde uma decisão é tomada, variedade onde se escreve prosa.

## Tamanho

Mais curto costuma ser melhor, mas a regra real é que **cada linha precisa
justificar a própria presença**. Um prompt que cresceu para 200 linhas por
remendos após incidentes é um prompt que ninguém mais entende, e provavelmente o
modelo também não.

Quando um prompt fica longo porque está segurando dois trabalhos, esse é o sinal
para dividir o agente — veja [Arquitetura](/pt/best-practices/architecture).

## Diferenças entre modelos são reais

Um prompt afinado no `gpt-4o` não se comporta igual no `qwen2.5-coder:7b`.
Modelos menores precisam de instrução mais explícita, menos restrições
simultâneas, e menos tools para escolher.

O `toolCallSource: "rescued"` no report é a versão mensurável de "este modelo está
no limite para esta tarefa".

## Relacionado

- [Agentes](/pt/fundamentals/agents)
- [Projetar tools](/pt/techniques/tool-design)
- [Laços](/pt/techniques/loops)
- [Depuração](/pt/devtools/debugging)
