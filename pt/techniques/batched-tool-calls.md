# Chamadas de tool em lote

O provider honra uma tool call por turno. Ler três arquivos custa três idas ao
modelo, e você paga por todas.

A `ParallelTool` empacota várias chamadas num turno só:

```bash
npm install @thenajs/tools
```

```ts
import { ParallelTool } from "@thenajs/tools";

@Agent({
  provider: GPT,
  tools: [ReadFileTool, ListDirTool, ParallelTool],
  prompt: "./explorer.agent.md",
})
export class ExplorerAgent {}
```

É toda a configuração. Ela não recebe argumento nenhum — despacha as **outras
tools do mesmo agente**, e chega até elas pelo [`@tools()`](/pt/reference/injection).

## O que ela economiza

Round-trip, não CPU. Três leituras viram uma chamada ao modelo em vez de três. As
tools rodam concorrentes, porque sai de graça depois que você já está num turno
só, mas não é aí que está o dinheiro.

```
sem parallel            com parallel
─────────────────       ─────────────────
modelo → read a         modelo → parallel([a, b, c])
modelo → read b         modelo → resposta
modelo → read c
modelo → resposta       2 chamadas em vez de 4
```

## É opt-in, e isso importa

Registrar é a chave inteira. Deixe de fora e o agente se comporta exatamente como
antes, uma tool por turno.

Essa chave existe porque **modelo fraco se sai pior com ela**. Preencher um array
`calls` aninhado é mais difícil que emitir uma tool call comum: o modelo precisa
escolher a ferramenta pelo nome e montar os argumentos sem o schema dela na
frente. Um modelo de fronteira faz isso com folga; um pequeno, rodando local,
pode não fazer.

Se o seu provider usa um modelo que tropeça, não registre a tool. Nada mais muda.

## O que ela **não** custa

É por isto que ela mora no framework em vez de ser um trecho para copiar.

Toda tool que o agente registra é embrulhada pelo runtime em cinco camadas: o nó
do report, os hooks `beforeTool`/`afterTool` do agente, os middlewares de
`app.use({ tool })` — onde mora a autorização —, a contagem de orçamento e a
política de erro.

A `ParallelTool` recebe as tools **já embrulhadas**, então cada chamada interna
continua passando pelas cinco. No report aparece assim:

```
▸ tool parallel
  ▸ tool read_file
  ▸ tool read_file
  ◂ tool read_file  4ms ✓
  ◂ tool read_file  6ms ✓
◂ tool parallel  7ms ✓
```

Três nós, não um. Uma versão feita à mão que despachasse tools cruas devolveria a
mesma resposta e perderia tudo isso — inclusive a garantia da página de
[Segurança](/pt/best-practices/security) de que um middleware de tool enxerga o
nome real e os argumentos finais. Ele veria `parallel` e um payload opaco.

## Falha

Uma chamada que falha não derruba o lote. As outras rodam do mesmo jeito, e o
modelo lê o que funcionou ao lado do que não funcionou:

```
[1] read_file → ok
export const config = { … }

[2] read_file → error
argumentos inválidos — path: expected string, received number
```

O lote só é marcado como erro quando **todas** as chamadas falharam. Um lote
parcialmente bom não é um turno perdido, e marcá-lo como erro faria o `maxFails`
de um laço contar uma falha que não houve.

Os argumentos são validados contra o schema de cada tool antes de ela rodar,
então uma chamada malformada volta como observação que o modelo consegue
corrigir — e não como exceção.

## Quando não usar

**Quando as chamadas dependem uma da outra.** Se B precisa do resultado de A, são
dois turnos. A tool não ajuda, e o modelo pedindo as duas de uma vez produz
bobagem na segunda.

**Quando há só uma chamada.** O schema exige no mínimo duas — um lote de uma é
uma tool call comum com passos a mais.

## Relacionado

- [`@tools()`](/pt/reference/injection) — como uma tool alcança as irmãs
- [Projetar tools](/pt/techniques/tool-design)
- [Execução paralela](/pt/techniques/parallel-execution) — o bloco `parallel`, que
  é outra coisa: **agentes** concorrentes, não tools concorrentes
