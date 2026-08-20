# Migração

O ThenaJS está na **0.9.x**. Em `0.x`, o caret não sobe a versão menor — um
`^0.6.0` no seu `package.json` não puxa a 0.9 sozinho. Estas notas valem para quem
instala novo, ou sobe de versão de propósito.

## Da 0.6 para a 0.9

Cinco quebras.

### `app.run()` **rejeita** em vez de engolir o erro

Antes, uma execução que falhava sumia em silêncio. Agora a rejeição chega até você.

```ts
// trate
try {
  await app.run({ input });
} catch (err) {
  // o erro é seu agora
}
```

Essa é a que tem mais chance de mudar um comportamento que você nem sabia que
tinha.

### `app.run()` devolve um `RunHandle`, não uma `Promise`

O `await` continua funcionando exatamente como antes. O que quebrou foi tratar o
retorno como `Promise` de verdade, além de `then`/`catch`/`finally`:

```ts
await app.run({ input }); // ok
app.run({ input }).catch(trata); // ok
Promise.all([app.run({ input })]); // use .result
```

O handle existe porque uma `Promise` não expressa três necessidades reais:
cancelar, observar enquanto acontece, e **guardar** a execução para reencontrá-la
depois.

```ts
const exec = app.run({ input });
exec.runId; // disponível de forma síncrona
exec.abort(); // cancela
exec.result; // uma Promise comum, se você precisar de uma
```

### O report vai para `<dir>/<runId>/`, não `<dir>/`

Ajuste qualquer script ou job de CI que lia um caminho fixo. O `report/index.html`
continua existindo e agora lista todas as execuções; a execução individual fica em
`report/<runId>/index.html`.

### O orçamento vale **dentro** das execuções aninhadas

Um sub-workflow disparado por uma tool agora conta no orçamento do pai. Sem isso,
herdar virava a forma de escapar: um `maxCostUsd` de $1 no topo era contornável por
qualquer tool que disparasse um sub-workflow.

Passe um `budget` explícito ao `runtime.run()` se quiser que aquela execução
aninhada tenha teto próprio — ela ganha um tracker encadeado, e corta quem estourar
primeiro.

### A execução só é observada quando alguém observa

`onEvent`, `onToken`, `eventStream` e `textStream` não recebem nada a menos que a
execução esteja sendo observada. Uma execução sem observador não constrói a árvore,
não emite eventos e não pede streaming ao provider — é o caminho de custo zero, e
vale cerca de 2× em tempo de CPU por execução.

A observação liga sozinha quando há `report`, `log`, ou um plugin com `onEvent`. Se
você não usa nenhum dos três:

```ts
const exec = app.run({ input, observe: true });
```

Você recebe um aviso único no console ao assinar uma execução que não está sendo
observada, em vez de silêncio.

## Continuam funcionando, como alias

| Antigo | Novo | Situação |
| --- | --- | --- |
| `bootstrapWorkflow(W, config)` | `Thena.create(W, config)` | depreciado, funciona |
| `AgentContext` | `Context` | alias, mesmo tipo |

O `Thena.create` **não é async**, que é o ponto da mudança:

```ts
const app = Thena.create(MeuWorkflow, config); // sem await
```

## Outras mudanças da 0.9 que vale saber

- **O `thena create` passa a gerar projeto CommonJS**, no padrão do `nest new`. Só
  afeta projeto novo.
- **Todos os pacotes pedem Node ≥ 20.19** — a versão em que o `require()` de um
  módulo ESM a partir de CommonJS entrou.

## Idioma dos identificadores

A 0.9 renomeou todos os identificadores internos para o inglês. Trinta e quatro
deles tinham vazado para os `.d.ts` publicados, o que os tornava contrato. Se você
estava alcançando internals — não deveria, mas acontece — é ali que está a quebra.
A API pública descrita nesta documentação não foi afetada.

## Changelog completo

Todas as versões, em detalhe, no
[CHANGELOG.md](https://github.com/thenajs/ThenaJS/blob/main/CHANGELOG.md).
