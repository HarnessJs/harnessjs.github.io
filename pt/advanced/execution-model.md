# Modelo de execução

O que acontece entre o `app.run()` e o resultado, uma camada abaixo de
[A execução](/pt/fundamentals/the-run).

## Duas fases

**Compilação**, uma vez, no `Thena.create`. Os metadados do workflow são lidos,
os passos viram unidades executáveis, e os schemas das tools são convertidos para
o formato do provider e memoizados. O `Thena.create` é síncrono porque nada disso
faz I/O.

**Execução**, por `app.run()`. Um `RunContext` é aberto, a classe de estado é
instanciada, e os passos compilados rodam contra ela.

Essa separação é por que o formato do workflow não muda por execução, e por que
montar dois apps é barato.

## `RunContext`

A unidade de isolamento. Cada execução ganha exatamente um, guardando o id da
execução, o canal de dados, o abort controller, o tracker de orçamento, o
gravador e a lista de limpezas.

Ele é propagado por `AsyncLocalStorage`, e não passado como argumento. É isso que
faz o `context()` funcionar como função solta dentro de uma factory de provider,
e o que impede execuções concorrentes de se enxergarem sem enfiar um parâmetro em
cada camada.

```ts
provider: () => new OpenAIProvider({ apiKey: chaveDe(context().data) });
```

A consequência que vale saber: um callback que escapa do contexto assíncrono — um
`setTimeout` solto, um listener registrado em outro lugar — perde o contexto. O
`context()` ali lança, em vez de devolver os dados da execução errada.

## O pipeline do passo

Um passo de agente é um pequeno pipeline de middleware, em ordem de cebola:

```
middleware de plugin → hooks → gravação → [a chamada ao modelo]
```

As cadeias de `tool` e de `chat` são montadas da mesma forma, com `compose()`. As
preocupações do próprio framework — gravar, despachar hooks, contar orçamento —
são camadas nessa cadeia, e não casos especiais. É por isso que um plugin
consegue envolver tudo isso sem precisar de um hook próprio.

Chamar `next()` duas vezes rejeita, em vez de cobrar de você duas vezes.

## O turno

Um passo de agente é um turno:

1. montar as mensagens a partir do `ctx.state` (`system` do prompt mais `memory`
   e `tasks`, depois `history`)
2. `beforePrompt`
3. chamar o provider com os schemas das tools
4. decidir: resposta final, ou chamada de tool?
5. se for tool: validar contra o schema Zod, `beforeTool`, `execute`,
   `afterTool`, anexar o resultado como mensagem `tool`
6. `afterResponse`
7. gravar `ctx.turn` e `ctx.output`

O passo 4 é a parte fechada. Ele trata os campos nativos de tool call e resgata
chamadas que o modelo escreveu como texto, em vários formatos. O
`toolCallSource` no nó `chat` registra qual caminho foi usado.

Um `loop` repete tudo isso; um `parallel` roda vários de uma vez, cada um no
próprio contexto de passo, sobre uma leitura congelada do histórico.

## A observação é condicional

Antes do primeiro passo, o runtime pergunta: alguém está olhando? `report`,
`log`, um plugin com `onEvent`, ou `observe: true`.

Se não, o gravador nunca é construído, nenhum evento é publicado, e o provider
não é solicitado a fazer streaming. As chamadas de instrumentação viram no-op, em
vez de um `if` em cada ponto de chamada.

Isso vale cerca de **2× em tempo de CPU por execução**, e é por isso que o
`onEvent` numa execução não observada avisa em vez de silenciosamente não render
nada.

## Contabilidade do orçamento

Os contadores vivem no `RunContext`, e a checagem acontece **entre** unidades de
trabalho — depois de uma chamada ao modelo resolver, não durante. Uma chamada só
conta depois de responder, porque antes disso não existe `usage` para somar.

Daí a imprecisão documentada: a execução pode passar por uma chamada ao modelo,
mais uma por nível de aninhamento.

Uma execução aninhada ganha um tracker **encadeado**: ela conta nos próprios
limites e nos do pai, e o que estourar primeiro a interrompe. Sem o
encadeamento, disparar um sub-workflow seria a forma de driblar qualquer teto.

## Cancelamento

O `AbortSignal` da execução é a combinação do seu (`run({ signal })`) com o
`abort()` do handle. Ele é exposto como `ctx.signal` e repassado ao `fetch` do
provider.

Abortar rejeita a execução e então roda as limpezas. O `stop()` liga uma flag que
o laço de passos consulta entre os passos, então a execução resolve normalmente
com a saída que já tinha — sem exceção envolvida.

Os callbacks de `onDispose` rodam na ordem inversa do registro, em todo
encerramento: sucesso, erro, abort.

## Onde os pontos de extensão realmente ficam

| Você quer | Camada |
| --- | --- |
| mudar o comportamento de um agente | hooks |
| envolver toda tool ou chamada ao modelo | middleware `tool` / `chat` de plugin |
| substituir o passo inteiro | `run(input, ctx)` na classe do agente |
| falar com outro backend | uma subclasse de `Providers` |
| observar sem participar | `onEvent` de plugin |

Deliberadamente não existe hook entre "o provider respondeu" e "decidimos que era
uma tool call". É a estabilidade dessa camada que deixa você trocar de modelo sem
tocar no seu código.

## Relacionado

- [A execução](/pt/fundamentals/the-run)
- [O que é automático](/pt/fundamentals/whats-automatic)
- [Escrever plugins](/pt/advanced/writing-plugins)
