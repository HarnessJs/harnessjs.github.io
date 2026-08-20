# Introdução

O ThenaJS é um framework TypeScript para construir **agentes** — programas que
recebem uma tarefa, decidem sozinhos quais ações executar, executam, olham o
resultado e seguem até terminar.

A ideia central é separar duas coisas que costumam se misturar:

- **A lógica fica no `.ts`** — quais ações o agente pode tomar, qual modelo usa,
  como os passos se encadeiam.
- **O comportamento fica no `.md`** — o prompt, em markdown, que você edita sem
  recompilar nada.

```ts
@Agent({
  provider: LocalOllamaProvider,
  tools: [ShellTool],
  prompt: "./explorer.agent.md",
})
export class ExplorerAgent {}
```

Esse arquivo é o agente inteiro. O que falta — montar as mensagens, chamar o
modelo, perceber que ele pediu uma tool, validar os argumentos, executar, devolver
o resultado e repetir — é trabalho do framework.

## O que você escreve, e o que não escreve

| Você escreve | O framework faz |
| --- | --- |
| o prompt, em markdown | monta as mensagens (system, user, assistant, tool) |
| a ação, com um schema Zod | detecta que o modelo quer chamá-la |
| — | valida os argumentos contra o schema |
| — | executa a ação e devolve o resultado ao modelo |
| a ordem dos passos | roda o pipeline e compartilha o estado |
| — | grava a árvore de execução para você inspecionar |

Essa divisão tem uma consequência que vale destacar: **você nunca escreve `if`
para descobrir se o modelo pediu uma tool, nem qual.** Essa parte é
deliberadamente fechada — é onde mora a maior parte dos bugs de agente feito à
mão, e onde modelos diferentes divergem mais.

## Quando faz sentido

Faz sentido quando a tarefa exige **várias voltas**: o agente investiga, decide,
age, olha o resultado e decide de novo. Um assistente que lê arquivos antes de
responder, um revisor que roda o linter e comenta, um operador que consulta um
sistema e executa um deploy.

Não faz sentido se você só precisa de **uma chamada** ao modelo — transformar um
texto, classificar, extrair um campo. Para isso, o SDK do provider direto é mais
simples e você não paga por abstração que não usa.

## O que vem na caixa

- **Providers** para Ollama e OpenAI, com retry e timeout. Ou escreva o seu.
- **Workflows** que encadeiam agentes em sequência, em paralelo ou em laço.
- **Hooks** para interceptar prompt, tools, resposta e erro.
- **Report** em HTML com a árvore da execução, tokens e custo.
- **Memória vetorial** com cliente Qdrant nativo, para busca semântica.
- **Orçamentos** de tempo, chamadas, tokens e custo por execução.
- **Visão ao vivo** da execução, como um grafo no navegador.

Tudo opcional. Um agente que só conversa não precisa de nada disso.

## Requisitos

- **Node 20.19 ou mais novo**
- Um modelo: [Ollama](https://ollama.com) rodando local, ou uma chave da OpenAI

Se você tem os dois, o próximo passo é [instalar](/pt/get-started/installation).

## Situação do projeto

O ThenaJS está na **0.9.x**. A API descrita aqui é a que existe hoje, mas ainda não
chegou à 1.0 — espere quebras entre versões menores, e leia as
[notas de migração](/pt/help/migration) ao subir de versão.
