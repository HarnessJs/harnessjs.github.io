# Memória vetorial

Busca semântica: grava textos e recupera por **similaridade**, não por chave.
Para quando o conhecimento é grande demais para caber num prompt e você precisa
da fatia relevante.

Nada é recuperado automaticamente. Você decide quando buscar e como formatar o
que volta.

## Configuração

```ts
// src/vector/projeto.store.ts
import { QdrantStore } from "@thenajs/qdrant-client";

export class MemoriaDoProjeto extends QdrantStore {
  constructor() {
    super({ url: "http://localhost:6333", collection: "projeto" });
  }
}
```

```ts
// src/config.ts
export const config: ThenaConfig = { stores: [MemoriaDoProjeto] };
```

A classe — não uma instância — é registrada, e instanciada **uma vez** para o app
inteiro.

```ts
@Agent({ provider: LocalOllamaProvider, prompt: "./assistant.agent.md" })
export class AssistantAgent {
  constructor(@memory(MemoriaDoProjeto) private readonly vetores: VectorMemory) {}
}
```

## O padrão de recuperação

O `beforePrompt` é onde isso vai:

```ts
async beforePrompt(prompt: string, ctx: Context) {
  const pergunta = ctx.state.history.at(-1)?.content ?? "";
  const achados = await this.vetores.recall(pergunta, { limit: 3 });
  if (!achados.length) return;                   // mantém o prompt intacto

  return `${prompt}

## Possivelmente relevante
${achados.map((a) => `- ${a.text}`).join("\n")}`;
}
```

Três decisões são suas e importam mais que o store: **com o quê** você busca,
**quantos** achados você pega, e **como** você os formata.

## Buscando com o texto certo

A última mensagem do usuário é a consulta óbvia e muitas vezes a errada. Num
laço, a última mensagem pode ser resultado de tool; no meio de uma conversa, "e
aquele outro?" vira um embedding que não serve para nada.

Consultas melhores, em ordem grosseira de esforço:

```ts
// o pedido original, e não o último turno
const original = ctx.state.history.find((m) => m.role === "user")?.content;

// a última mensagem do usuário, especificamente
const ultima = ctx.state.history.filter((m) => m.role === "user").at(-1)?.content;
```

Para um agente conversacional, gerar embedding de um resumo curto e rolante é
melhor que da última linha.

## Gravando

```ts
await this.vetores.remember("O deploy roda às 3h UTC", {
  dataset: "runbook",
  payload: { origem: "wiki-ops", atualizadoEm: Date.now() },
  id: "horario-deploy", // id próprio — gravar de novo sobrescreve
});
```

Ids estáveis são o que torna a reindexação idempotente. Sem um, reingerir um
documento acrescenta uma duplicata que passa a competir consigo mesma em toda
busca.

O `rememberMany` gera embeddings em paralelo e é muito mais rápido numa carga em
lote.

## Datasets

Uma partição lógica dentro de uma collection, escolhida a cada chamada:

```ts
await vetores.remember(nota, { dataset: "rascunho-da-run" });
await vetores.recall(q, { dataset: "runbook" }); // só o runbook
await vetores.recall(q, { dataset: null }); // tudo
```

Use para separar as anotações de uma execução do conhecimento durável sem subir
um segundo store.

::: warning O bug mais comum
`remember` sem `dataset` grava em `"default"`. `recall({ dataset: "persistent" })`
não acha, e volta vazio sem erro nenhum.
:::

## Afinando o recall

**Comece sem `scoreThreshold`.** Olhe os scores reais primeiro — um limiar
chutado antes de você ter visto os números ou filtra tudo ou não filtra nada.

```ts
const achados = await vetores.recall(q, { limit: 10 });
console.log(achados.map((a) => [a.score, a.text.slice(0, 60)]));
```

Então defina a partir do que você viu. Valores absolutos não são comparáveis
entre modelos de embedding.

**Mantenha o `limit` baixo.** Três trechos bons são melhores que dez medianos —
texto recuperado compete com a conversa de verdade pela atenção, e você paga por
ele a cada turno.

**Filtre com `where`** quando o payload consegue estreitar antes da similaridade:

```ts
await vetores.recall(q, { where: { origem: "wiki-ops" }, limit: 3 });
```

## Chunking

O framework guarda o que você der. Um documento de 40KB guardado inteiro é um
embedding que significa tudo e não casa com nada.

Divida pela estrutura — títulos, parágrafos, funções — em pedaços que façam
sentido sozinhos, e mantenha o contexto identificador dentro do próprio texto:

```ts
await vetores.rememberMany(
  secoes.map((s) => ({
    text: `# ${doc.titulo} — ${s.titulo}\n\n${s.corpo}`,
    dataset: "docs",
    id: `${doc.slug}#${s.slug}`,
    payload: { doc: doc.slug },
  })),
);
```

## Embeddings

Eles saem do `provider` do próprio agente. Aponte para um modelo dedicado:

```ts
super({ host, model: "qwen2.5-coder:7b", embedModel: "nomic-embed-text" });
```

Sem `embedModel`, o Ollama usa o modelo do chat — e a maioria dos modelos de chat
é ruim em embeddings.

::: warning Uma collection guarda um tamanho de embedding só
```
Este store já foi preparado com 768 dimensões, mas agora recebeu embeddings de 1536.
```
Dois agentes com modelos de embedding diferentes precisam de dois stores:
`stores: [QdrantNomic, QdrantOpenAI]`, injetados por nome com
`@memory(QdrantOpenAI)`.
:::

Trocar de modelo de embedding significa reindexar tudo. Vetores antigos não são
comparáveis aos novos.

## Custo e latência

Todo `recall` é uma chamada de embedding mais uma busca. Num laço que roda dez
vezes, são dez chamadas de embedding — baratas por unidade, não de graça. Se a
consulta não mudou, guarde em cache, ou faça o recall uma vez antes do laço em
vez de dentro dele.

## Quando não usar

Se tudo cabe no prompt, ponha no prompt. Um runbook de 20 linhas pertence ao
`.md` do agente, ou ao `run({ state })` — os dois são mais simples,
determinísticos, e custam zero para recuperar.

A memória vetorial se justifica quando o corpus é grande o bastante para que
escolher o que incluir seja, ele próprio, o problema.

## Relacionado

- [Memória](/pt/fundamentals/memory) — memória da execução e memória vetorial
- [Banco vetorial](/pt/reference/vector-store) — a API completa
- [Bancos vetoriais próprios](/pt/advanced/custom-vector-stores)
