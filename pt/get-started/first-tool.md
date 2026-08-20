# Sua primeira tool

Seu agente sabe falar. Ele não sabe ler um arquivo, chamar uma API ou rodar um
comando — então, quando você pergunta sobre o `README.md`, ele chuta.

Uma tool é como você entrega uma capacidade a ele.

## Uma tool é uma classe

```ts
// src/tools/read-file.tool.ts
import { Tool } from "@thenajs/core";
import { readFile } from "node:fs/promises";
import { z } from "zod";

@Tool({
  name: "read_file",
  description: "Lê um arquivo e devolve o conteúdo.",
  schema: z.object({ path: z.string() }),
})
export class ReadFileTool {
  async execute({ path }: { path: string }) {
    return readFile(path, "utf8");
  }
}
```

Três coisas a descrevem, e o modelo vê as três: o `name` que ele chama, a
`description` a partir da qual ele decide, e o `schema` que diz quais argumentos
são válidos.

Entregue ao agente:

```ts
@Agent({
  provider: LocalOllamaProvider,
  tools: [ReadFileTool],
  prompt: "./explorer.agent.md",
})
export class ExplorerAgent {}
```

Pergunte de novo:

```
[thena] ▸ agent ExplorerAgent
[thena]   ▸ chat
[thena]     ▸ tool read_file
[thena]     ◂ tool read_file  3ms ✓
[thena]   ◂ chat  1.81s ✓

É um framework TypeScript para construir agentes de LLM, publicado como @thenajs/*.
```

Ele leu o arquivo. Você não escreveu `if` para detectar a chamada, nem
`JSON.parse` dos argumentos, nem validação.

## O que o framework fez por você

Entre a sua pergunta e aquela resposta:

| | |
| --- | --- |
| Converteu o schema para o formato que o provider espera | seu objeto Zod, convertido uma vez e memoizado |
| Percebeu que o modelo queria o `read_file` | tool call nativa, ou resgatada do texto se o modelo tiver emitido JSON |
| Validou os argumentos contra o seu schema | entrada inválida nunca chega no seu `execute` |
| Rodou o `execute` e devolveu o resultado | como mensagem `tool`, no formato certo para o próximo turno |

A última linha é o motivo de o `execute` receber `{ path }` já tipado. Se o modelo
mandar `{ file: "README.md" }`, o seu código não é chamado — o modelo é informado
do que errou, e tenta de novo.

## Só o que você entregar

O agente faz exatamente o que o array `tools` permite, e nada além. Isso não é uma
limitação a contornar — é a fronteira de segurança. Um agente que lê conteúdo não
confiável e segura uma tool com efeito colateral é superfície de ataque; veja o
[SECURITY.md](https://github.com/thenajs/ThenaJS/blob/main/SECURITY.md).

O ThenaJS não publica pacote de tools — uma tool é pequena o bastante para ser
sua. Prontas para copiar, incluindo uma de shell e o aviso dela, estão em
[Receitas de tools](/pt/techniques/tool-recipes).

## Quando a tool falha

Pergunte sobre um arquivo que não existe. Sua tool lança `ENOENT` — e no ThenaJS
isso **não** encerra a execução. O erro volta ao modelo como resultado da tool, e
ele ganha outro turno:

```
[thena]   ▸ tool read_file
[thena]   ◂ tool read_file  2ms ✗   ENOENT: no such file or directory, 'READMEE.md'
[thena]   ▸ chat
[thena]     ▸ tool read_file
[thena]     ◂ tool read_file  3ms ✓

É um framework TypeScript para construir agentes de LLM.
```

Ele errou o nome, foi avisado, e corrigiu. **Falha de tool é observação, não
exceção** — e é essa decisão sozinha que faz o laço de investigar-agir-olhar-de-
novo funcionar.

Devolver o erro é melhor que lançar, porque aí você escolhe as palavras que o
modelo lê:

```ts
async execute({ path }: { path: string }) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return { content: `Não existe arquivo em "${path}". Confira o caminho.`, isError: true };
  }
}
```

A diferença não é cosmética. `ENOENT: no such file or directory, open
'READMEE.md'` descreve uma syscall. `Não existe arquivo em "READMEE.md". Confira o
caminho.` diz ao modelo o que fazer em seguida.

## O problema

Um agente com uma tool responde uma pergunta. Trabalho de verdade tem etapas —
planejar, investigar, conferir o resultado — e muitas vezes precisa dar mais de
uma volta.

É para isso que existe o workflow.

**Próximo: [seu primeiro workflow](/pt/get-started/first-workflow).**
