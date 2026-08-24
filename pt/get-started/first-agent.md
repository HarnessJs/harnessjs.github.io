# Seu primeiro agente

Você quer um programa que responda perguntas sobre uma base de código. Não um
chatbot — uma coisa que você chama do seu próprio código, que lê arquivos e conta
o que encontrou.

A menor versão útil disso é um agente.

## Dois arquivos

No ThenaJS um agente é uma classe, e o comportamento dele mora ao lado, em
markdown.

```ts
// src/agents/explorer/explorer.agent.ts
import { Agent } from "@thenajs/core";
import { LocalOllamaProvider } from "../../providers/ollama.provider";

@Agent({
  provider: LocalOllamaProvider,
  tools: [],
  prompt: "./explorer.agent.md",
})
export class ExplorerAgent {}
```

```md
<!-- src/agents/explorer/explorer.agent.md -->

Você explora projetos de software.

Responda em um parágrafo curto. Se não tiver certeza, diga isso.
```

A separação é deliberada. Prompt muda o tempo todo — uma palavra aqui, um exemplo
ali — e muda por motivos diferentes dos que fazem o código mudar. Manter no `.md`
faz um ajuste de prompt virar um diff de prompt, e não uma edição de string
enterrada numa classe.

O caminho é relativo ao arquivo do agente, então os dois ficam lado a lado.

## Executando

Um agente roda dentro de um workflow. Para um agente só, o workflow é uma linha:

```ts
// src/workflows/explorer.workflow.ts
import { Workflow } from "@thenajs/core";
import { ExplorerAgent } from "../agents/explorer/explorer.agent";

@Workflow({ steps: [ExplorerAgent] })
export class ExplorerWorkflow {}
```

```ts
// src/main.ts
import { Thena } from "@thenajs/core";
import { ExplorerWorkflow } from "./workflows/explorer.workflow";

async function bootstrap() {
  const app = Thena.create(ExplorerWorkflow, { log: true });

  console.log(await app.run({ prompt: "O que este projeto faz?" }));

  await app.dispose();
}

bootstrap();
```

```bash
npm start
```

```
[thena] ▸ workflow ExplorerWorkflow
[thena]   ▸ agent ExplorerAgent
[thena]     ▸ chat
[thena]     ◂ chat  1.42s ✓
[thena]   ◂ agent ExplorerAgent  1.42s ✓
[thena] ◂ workflow ExplorerWorkflow  1.42s ✓

Parece um projeto TypeScript, mas não consigo ler nenhum arquivo para confirmar.
```

Respondeu. E disse exatamente o que está errado.

## O que acabou de acontecer

Você não escreveu código para montar um array de `messages`, chamar um endpoint
HTTP, parsear resposta ou tratar retry. O `Thena.create` compilou o workflow, o
`app.run` abriu uma execução, e o agente deu um turno.

Dois detalhes que importam mais adiante:

- **`Thena.create` não é async.** Montar o app não espera nada. Quem espera é o
  `app.run`.
- **`app.dispose()` importa.** Ele drena as execuções em voo e encerra os plugins.
  Num script dá para pular; num servidor, não.

## O problema

Leia a resposta de novo:

> não consigo ler nenhum arquivo para confirmar.

O agente tem razão. Um modelo produz texto. Ele não tem sistema de arquivos, não
tem rede, não tem como tocar em nada. Pergunte o que tem no `README.md` e ele vai
chutar — muitas vezes de forma convincente, o que é pior.

Para fazer qualquer coisa, ele precisa de algo que você entregue.

**Próximo: [dê uma tool a ele](/pt/get-started/first-tool).**
