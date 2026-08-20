# Banco vetorial

Duas camadas: `VectorStore` é o contrato do banco, e `VectorMemory` é o que é
injetado nos agentes — ela junta um store com o `embed()` de um provider.

```ts
import type { VectorMemory, VectorStore } from "@thenajs/core";
import { QdrantStore } from "@thenajs/qdrant-client";
```

## `VectorMemory`

O que o `@memory()` entrega.

### `remember(text, options?)`

```ts
const id = await memoria.remember("o deploy roda às 3h", {
  dataset: "notas",
  payload: { origem: "runbook" },
  id: "runbook-1", // id próprio, para sobrescrever um item existente
});
```

Devolve o id. O `rememberMany(items)` recebe `({ text } & RememberOptions)[]` e
gera os embeddings em paralelo.

### `recall(query, options?)`

```ts
const achados = await memoria.recall("quando roda o deploy", {
  limit: 5,
  dataset: "notas", // omita para o default; `null` busca em TODOS
  scoreThreshold: 0.7,
  where: { origem: "runbook" },
});
```

```ts
interface RecallHit {
  text: string;
  score: number;
  dataset: string;
  id: string | number;
  payload?: Record<string, unknown>;
}
```

### `forget(selector?)`

```ts
await memoria.forget({ ids: ["runbook-1"] });
await memoria.forget({ dataset: "rascunho" });
await memoria.forget({ where: { origem: "runbook" } });
```

### `store`

O `VectorStore` por baixo, público para o `@memory(Store)` conseguir distinguir
um do outro.

## Datasets

Uma partição lógica dentro de uma collection, escolhida a cada chamada. Bancos
vetoriais costumam recomendar partição por campo em vez de muitas collections.

| Chamada | Dataset usado |
| --- | --- |
| `remember(t)` | o default, `"default"` |
| `recall(q)` | o default |
| `recall(q, { dataset: "x" })` | só o `"x"` |
| `recall(q, { dataset: null })` | **todos** |

O bug mais comum é gravar em `"default"` e buscar em `"persistent"`.

## `VectorStoreCredentials`

```ts
interface VectorStoreCredentials extends TransportCredentials {
  url: string;
  apiKey?: string;
  collection?: string; // default "thena_memory"
  datasetField?: string; // default "dataset"
  retry?: RetryPolicy | boolean; // herdado, ligado por padrão
}
```

## `QdrantStore`

```ts
import { QdrantStore } from "@thenajs/qdrant-client";

export class MemoriaDoProjeto extends QdrantStore {
  constructor() {
    super({ url: "http://localhost:6333", collection: "projeto" });
  }
}
```

Registre a classe — não uma instância — no config:

```ts
export const config: ThenaConfig = { stores: [MemoriaDoProjeto] };
```

Instanciada **uma vez** e compartilhada por todos os agentes.

## Escrevendo o seu store

Estenda `VectorStore`, que estende `HttpTransport` — então retry e timeout vêm de
graça.

```ts
interface VectorDocument {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

interface VectorMatch {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
}

interface VectorSearch {
  vector: number[];
  limit?: number;
  where?: Record<string, unknown>; // igualdade simples em campos do payload
  rawFilter?: unknown; // formato nativo — VENCE o `where`
  scoreThreshold?: number;
  withPayload?: boolean; // default true — é onde o texto vive
}

interface CollectionOptions {
  size: number; // precisa bater com o modelo de embedding
  distance?: VectorDistance; // "cosine" | "euclid" | "dot" | "manhattan"
}
```

Veja [Bancos vetoriais próprios](/pt/advanced/custom-vector-stores).

## Dimensões

```
Este store já foi preparado com 768 dimensões, mas agora recebeu embeddings de 1536.
```

Uma collection guarda um tamanho de embedding só. Dois agentes com modelos de
embedding diferentes precisam de dois stores:

```ts
stores: [QdrantNomic, QdrantOpenAI];
```

A injeção por esse array é posicional; o `@memory(QdrantOpenAI)` nomeia em vez
disso.

## Relacionado

- [Memória](/pt/fundamentals/memory) — o conceito
- [Memória vetorial](/pt/techniques/vector-memory) — padrões
- [Injeção](/pt/reference/injection)
