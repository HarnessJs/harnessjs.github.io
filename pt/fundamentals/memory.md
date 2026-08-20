# Memória

"Memória" significa duas coisas diferentes no ThenaJS, e mantê-las separadas
poupa muita confusão.

| | Onde mora | O modelo lê? |
| --- | --- | --- |
| **Memória da execução** — `run({ memory })` | no estado da execução, serializada na mensagem `system` | **sim**, a cada turno |
| **Memória vetorial** — `VectorMemory` | num banco vetorial, fora da execução | só o que você `recall` e põe no prompt |

Nenhuma das duas é automática no sentido que importa: nada é recuperado e
injetado por você.

## Memória da execução

Contexto durável desta execução. Você semeia, e ele está na mensagem `system`
desde o primeiro turno:

```ts
await app.run({
  input: { message: "O que eu faço agora?" },
  memory: { userId: "123", plano: "pro" },
});
```

Agentes e hooks podem acrescentar durante a execução:

```ts
ctx.state.append("memory", "O usuário prefere respostas curtas");
```

Como vai para o modelo, também vai para o report. O que o modelo **não** deve ver
pertence ao [`run({ data })`](/pt/fundamentals/state-and-context#memory-e-data).

A memória da execução não é persistente. Ela dura o que a execução durar.
Persistir entre execuções é trabalho da sua aplicação — carregue, passe em
`run({ memory })`, salve o que mudou.

## Memória vetorial

Busca semântica: o agente grava textos e recupera **por similaridade**, não por
chave. É o que você quer para "já vimos algo parecido antes".

Registre o store uma vez, no config:

```ts
import { QdrantStore } from "@thenajs/qdrant-client";

export class MemoriaDoProjeto extends QdrantStore {
  constructor() {
    super({ url: "http://localhost:6333", collection: "projeto" });
  }
}

export const config: ThenaConfig = { memory: [MemoriaDoProjeto] };
```

Cada classe é instanciada **uma vez** e compartilhada por todos os agentes — uma
conexão e um preparo de collection, independente de quantos agentes existem.

O agente pede:

```ts
@Agent({ provider: LocalOllamaProvider, prompt: "./assistant.agent.md" })
export class AssistantAgent {
  constructor(@memory(MemoriaDoProjeto) private readonly vetores: VectorMemory) {}

  async beforePrompt(prompt: string, ctx: Context) {
    const pergunta = ctx.state.history.at(-1)?.content ?? "";
    const achados = await this.vetores.recall(pergunta, { limit: 3 });
    if (!achados.length) return;
    return `${prompt}\n\n## Relacionado\n${achados.map((a) => a.text).join("\n")}`;
  }
}
```

Esse `beforePrompt` é o padrão inteiro: **você** decide quando buscar e como
formatar o que volta. O framework nunca injeta contexto recuperado sozinho.

### A API

```ts
await vetores.remember("texto a guardar", { dataset: "notas" });
await vetores.rememberMany([{ text: "a" }, { text: "b" }]);

const achados = await vetores.recall("consulta", {
  limit: 5,
  dataset: "notas", // omita para o default; `null` busca em todos
  scoreThreshold: 0.7,
});

await vetores.forget({ dataset: "notas" });
```

Os embeddings saem do `provider` do próprio agente, cujo `embed()` é público.
Aponte para um modelo dedicado com `embedModel` — a maioria dos modelos de chat é
ruim nisso.

### Datasets

Um dataset é uma partição lógica dentro de uma collection, escolhida a cada
chamada. É a resposta para "separar as anotações desta execução da base de
conhecimento durável" sem subir um segundo store.

O bug mais comum: `remember` sem `dataset` grava em `"default"`, e
`recall({ dataset: "persistent" })` não acha. `{ dataset: null }` busca em tudo.

### Vários stores

```ts
memory: [QdrantNomic, QdrantOpenAI];
```

Vários stores fazem sentido quando eles são incompatíveis entre si —
tipicamente modelos de embedding de dimensões diferentes, que não cabem na mesma
collection.

A injeção por esse array é **posicional**, e o TypeScript não acusa uma
reordenação porque os parâmetros têm o mesmo tipo. Nomeie o store:

```ts
constructor(@memory(QdrantOpenAI) private readonly v: VectorMemory) {}
```

::: warning Uma collection guarda um tamanho de embedding só
Dois agentes com modelos de embedding diferentes apontando para o mesmo store dão
`Este store já foi preparado com 768 dimensões, mas agora recebeu embeddings de
1536`. Cada modelo precisa do seu store.
:::

## Quando você não precisa de nenhuma das duas

A maioria dos agentes. Um agente de um turno só, ou um workflow cujos passos
compartilham tudo pelo histórico da conversa, não precisa de configuração de
memória nenhuma.

Recorra à memória da execução quando um fato precisa sobreviver entre passos e
ser visível ao modelo. Recorra à memória vetorial quando o conhecimento é grande
demais para caber num prompt e você precisa recuperar a fatia relevante.

## Relacionado

- [Estado e contexto](/pt/fundamentals/state-and-context) — `memory` e `data`
- [Providers](/pt/fundamentals/providers) — de onde saem os embeddings
- [Injeção de dependência](/pt/fundamentals/dependency-injection)
