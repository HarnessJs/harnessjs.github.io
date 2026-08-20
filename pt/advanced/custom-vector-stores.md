# Bancos vetoriais próprios

`VectorStore` é o contrato entre o framework e um banco vetorial. O
`@thenajs/qdrant-client` é uma implementação, escrita contra a mesma interface
pública que você usaria.

```ts
import { VectorStore } from "@thenajs/core";
import type {
  VectorStoreCredentials,
  VectorDocument,
  VectorMatch,
  VectorSearch,
  VectorSelector,
  CollectionOptions,
} from "@thenajs/core";

export class MeuStore extends VectorStore {
  constructor(credentials: VectorStoreCredentials) {
    super();
    this.configureTransport(credentials); // retry e timeout
    this.url = credentials.url.replace(/\/$/, "");
    this.collection = credentials.collection ?? "thena_memory";
  }
}
```

## O que você implementa

| Método | Chamado quando |
| --- | --- |
| `ensureCollection(options)` | antes da primeira gravação, uma vez por store |
| `upsert(documents)` | `remember` / `rememberMany` |
| `search(params)` | `recall` |
| `remove(selector)` | `forget` |

O `VectorMemory` fica acima disso e cuida do embedding, da partição por dataset e
do formato do que os agentes recebem. Seu store lida só com vetores e payloads.

## Os formatos

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
  distance?: "cosine" | "euclid" | "dot" | "manhattan";
}
```

O `where` é o filtro neutro e cobre a maioria dos casos — traduza para o formato
do seu banco. O `rawFilter` é o escape hatch para o que um shape neutro não
expressa (ranges, geo, lógica booleana aninhada); quando presente ele **vence** o
`where` em vez de mesclar, então o usuário tem uma resposta previsível em vez de
uma regra de combinação para decorar.

## O transporte vem de graça

O `VectorStore` estende `HttpTransport`, a mesma base do `Providers`. Chame
`this.configureTransport(credentials)` no construtor e use `this.request()`:

```ts
async search(params: VectorSearch): Promise<VectorMatch[]> {
  const { response } = await this.request(`${this.url}/collections/${this.collection}/points/search`, {
    method: "POST",
    headers: this.headers(),
    body: JSON.stringify(paraBuscaNativa(params)),
  });
  if (!response.ok) throw new Error(`busca falhou (${response.status})`);
  const data = await response.json();
  return data.result.map(paraVectorMatch);
}
```

Você herda retry, backoff exponencial, `Retry-After` e timeout opcional.

::: warning Retry e gravações
A política de retry padrão repete requisições que falharam. Isso é seguro para
`search`, e seguro para `upsert` **se os seus ids forem estáveis** — que é por
que o `remember({ id })` existe. Se a gravação do seu backend não for idempotente,
estreite o `isRetryable` para aquele caminho.
:::

Dê a um store um `timeoutMs` muito mais curto que o de um modelo. Ele deveria
responder em milissegundos:

```ts
super({ url, collection, retry: { maxAttempts: 3, timeoutMs: 5_000 } });
```

## Datasets são um campo do payload

O framework não cria uma collection por dataset. Ele grava um campo —
`datasetField`, default `"dataset"` — no payload e filtra por ele, porque bancos
vetoriais costumam recomendar partição por campo em vez de por collection.

O seu `search` precisa honrar o `where` para isso funcionar. Se ele ignora o
`where`, o `recall({ dataset })` busca tudo em silêncio.

## Dimensões

O `ensureCollection({ size })` é chamado com a dimensão do modelo de embedding,
tirada do primeiro vetor produzido. Uma collection guarda um tamanho só:

```
Este store já foi preparado com 768 dimensões, mas agora recebeu embeddings de 1536.
```

A sua implementação deve detectar a divergência e falhar alto, em vez de gravar
vetores que nunca vão casar. Dois modelos de embedding precisam de dois stores.

## Registrando

Exatamente como o que vem junto — a classe, não uma instância:

```ts
export class MemoriaDoProjeto extends MeuStore {
  constructor() {
    super({ url: "http://localhost:7777", collection: "projeto" });
  }
}

export const config: ThenaConfig = { stores: [MemoriaDoProjeto] };
```

Instanciado uma vez e compartilhado por todos os agentes: uma conexão, um
`ensureCollection`, independente de quantos agentes existem.

## Testando

O contrato são quatro métodos sobre dados simples, então uma implementação em
memória é curta — e deixa os testes de agente determinísticos e offline:

```ts
export class MemoryStore extends VectorStore {
  private pontos: VectorDocument[] = [];

  async ensureCollection() {}
  async upsert(docs: VectorDocument[]) {
    this.pontos.push(...docs);
  }
  async search({ vector, limit = 5 }: VectorSearch) {
    return this.pontos
      .map((p) => ({ id: p.id, score: cosseno(p.vector, vector), payload: p.payload }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  async remove() {
    this.pontos = [];
  }
}
```

## Relacionado

- [Banco vetorial](/pt/reference/vector-store) — a API completa
- [Memória vetorial](/pt/techniques/vector-memory) — padrões de uso
- [Transporte HTTP](/pt/advanced/http-transport)
