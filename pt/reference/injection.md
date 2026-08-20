# Injeção

Decorators de parâmetro que dizem o que cada argumento deve receber. Como cada um
se declara, **a ordem não importa** — e dois parâmetros do mesmo tipo deixam de
ser ambíguos.

```ts
import { input, context, state, memory } from "@thenajs/core";
```

| Decorator | Onde | O que entrega |
| --- | --- | --- |
| `@input()` | `execute` de tool | os argumentos, validados pelo schema |
| `@context()` | `execute` de tool | o `Context` da execução |
| `@state()` | construtor de agente, `execute` de tool | a instância de `@Workflow({ state })` |
| `@memory(Store?)` | construtor de agente | uma `VectorMemory` |

## Em tools

```ts
@Tool({ name: "ler", description: "…", schema: z.object({ path: z.string() }) })
export class LerTool {
  async execute(
    @input() { path }: { path: string },
    @context() ctx: Context,
    @state() s: RevisaoState,
  ) {
    s.arquivosLidos.push(path);
    return readFile(path, "utf8", { signal: ctx.signal });
  }
}
```

Sem decorator nenhum, o `execute` recebe só os argumentos — o caso comum:

```ts
async execute({ path }: { path: string }) { … }
```

## Em agentes

```ts
@Agent({ provider: MeuProvider, prompt: "./a.agent.md" })
export class MeuAgente {
  constructor(
    @state() private readonly s: RevisaoState,
    @memory(QdrantOpenAI) private readonly vetores: VectorMemory,
  ) {}
}
```

`@memory(Store)` identifica a memória pela classe do store, removendo a
dependência da ordem de `ThenaConfig.stores`. Sem argumento, entrega a primeira
registrada.

Sem o decorator vale o contrato posicional — que é por que reordenar aquele array
muda o comportamento em silêncio.

::: warning `@context()` não funciona em construtor
O agente é instanciado antes de a execução começar, então o contexto ainda não
existe. O runtime falha com essa explicação em vez de injetar `undefined`. Use no
`execute` de uma tool, ou receba o `ctx` como parâmetro do hook.
:::

## `context()` como função

```ts
provider: () => new OpenAIProvider({ apiKey: chaveDe(context().data) });
```

Mesmo objeto, momento diferente: dentro de um passo vem o ctx do passo, com
`state` e `turn`; fora dele vem o da execução, e tocar em `state` lança com a
explicação.

## Construtores de tool

Tools são instanciadas pelo framework, então os construtores delas também recebem
dependências — mais utilmente o `WorkflowRuntime`:

```ts
export class PesquisaTool {
  constructor(private readonly runtime: WorkflowRuntime) {}
}
```

## Por que não por tipo

O `reflect-metadata` lê os **tipos** dos parâmetros e dispensaria estes
decorators. Não é usado porque o esbuild — que o `tsx` usa em dev — não emite
`design:paramtypes`: injeção por tipo compilaria e quebraria em silêncio no
`npm start`.

As chamadas dos decorators são emitidas nos dois caminhos.

É também por isso que o `experimentalDecorators` é obrigatório, em vez da
proposta Stage 3 — que não tem decorators de parâmetro.

## Se você não declarar estado

| Situação | O que acontece |
| --- | --- |
| ninguém pede estado | funciona normal |
| um agente pede com `@state()` | erro apontando a classe e o parâmetro |
| uma tool pede com `@state()` | erro apontando o método e o parâmetro |
| o `until` declara o 2º parâmetro | erro dizendo para acrescentar `state` |

O último é detectado **antes de rodar**, pela aridade do `until`. Sem essa
checagem, o estado chegaria `undefined` e sairia como um `TypeError` na primeira
leitura de campo, sem nunca dizer o que faltou.

Um `until` de um parâmetro só (`untilAnswered`, ou `(ctx) => …`) nunca dispara
essa checagem.

## Erros

```
[thena] @state() em RevisorAgent (parâmetro 0): nenhum estado declarado.
        Acrescente `state: MinhaClasse` no @Workflow.

[thena] @memory(QdrantOpenAI) em MeuAgente: esse store não está registrado em
        ThenaConfig.stores.
```

## Relacionado

- [Injeção de dependência](/pt/fundamentals/dependency-injection) — o conceito
- [Contexto](/pt/reference/context)
- [Banco vetorial](/pt/reference/vector-store)
