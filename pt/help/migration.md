# Migração

## Da 0.11 para a 0.12

### O `run({ input: { message } })` virou `run({ prompt })`

```ts
- await app.run({ input: { message: "Revise src/" } });
+ await app.run({ prompt: "Revise src/" });
```

O embrulho nunca pagou o próprio custo. O `input` era declarado como um saco
aberto, mas nada no framework entregava aquele objeto ao seu código — o
`@input()` é outra coisa, os argumentos validados pelo schema de uma **tool**. O
único consumidor o reduzia a uma string antes de a execução começar. Sobrava um
nível de aninhamento e um nome que sugeria o par input/output de IO, num método
que por definição só recebe entrada.

A migração é mecânica: tire o embrulho. Vale também para runs aninhadas pelo
`WorkflowRuntime`.

### Um `input` sem `message` não é mais serializado

Passar `{ input: { userId: 7 } }` serializava o objeto inteiro em JSON e fazia
disso o prompt. Era a única razão de o tipo ser aberto, e transformava um campo
com o nome errado em sucesso silencioso em vez de erro.

```ts
- await app.run({ input: { userId: 7, acao: "revisar" } });
+ await app.run({ prompt: JSON.stringify({ userId: 7, acao: "revisar" }) });
```

Em geral o melhor é não serializar nada. Payload estruturado tem duas portas, e
a escolha entre elas é o que o modelo pode ver: o
[`data`](/pt/get-started/configuration#state-memory-e-data) para o que ele
**não** deve ler, o `state.memory` para o que ele deve.

### O `WorkflowInput` saiu do pacote

O tipo não é mais exportado. O `WorkflowRunOptions` continua, com `prompt` no
lugar do `input`.

### Duas coisas se chamam `prompt` agora

O `@Agent({ prompt })` é o prompt de sistema do agente, em markdown, fixo por
classe. O `run({ prompt })` é a fala do usuário, um por execução. A documentação
sempre diz qual — veja o [glossário](/pt/help/glossary).

## Da 0.10 para a 0.11

### O `@thenajs/tools` voltou, sem a tool de shell

O pacote saiu na `0.10` porque existia para publicar uma tool de shell, e dar
execução de comando arbitrário ao modelo é decisão da aplicação, não do
framework. **Isso não mudou — não há tool de shell.**

O que ele traz agora é a
[`ParallelTool`](/pt/techniques/batched-tool-calls), que depende de coisas do
framework que um trecho copiado não alcança.

```bash
npm install @thenajs/tools
```

Nada a migrar: se você não usava o pacote, ignore.

### O `@tools()` é novo

Uma tool passa a alcançar as outras do mesmo agente — veja
[Injeção](/pt/reference/injection). É aditivo; nada do que você escreveu muda.

### Os pacotes passam a levar o `LICENSE`

Todos os manifestos declaravam MIT, mas nenhum arquivo de licença ia nos
tarballs. A `0.11` corrige. Nada a fazer — só importa se algum scanner de licença
apontou o pacote.


O ThenaJS está na **0.12.x**. Em `0.x`, o caret não sobe a versão menor — um
`^0.11.0` no seu `package.json` não puxa a 0.12 sozinho. Estas notas valem para quem
instala novo, ou sobe de versão de propósito.

## Da 0.6 para a 0.9

Cinco quebras.

### `app.run()` **rejeita** em vez de engolir o erro

Antes, uma execução que falhava sumia em silêncio. Agora a rejeição chega até você.

```ts
// trate
try {
  await app.run({ prompt });
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
await app.run({ prompt }); // ok
app.run({ prompt }).catch(trata); // ok
Promise.all([app.run({ prompt })]); // use .result
```

O handle existe porque uma `Promise` não expressa três necessidades reais:
cancelar, observar enquanto acontece, e **guardar** a execução para reencontrá-la
depois.

```ts
const exec = app.run({ prompt });
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
const exec = app.run({ prompt, observe: true });
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
