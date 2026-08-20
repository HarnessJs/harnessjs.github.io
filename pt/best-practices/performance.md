# Desempenho

Quase todo o tempo e todo o custo de um agente é o modelo. Otimizar o seu
TypeScript raramente é a resposta; reduzir o que você manda e com que frequência,
sim.

## Meça primeiro

Os números estão no report, por nó `chat`:

| Campo | Diz |
| --- | --- |
| `promptTokens` | o quanto o histórico cresceu |
| `completionTokens` | o quanto o modelo está escrevendo |
| `costUsd` | o número que importa |
| `attempts` | a rede retentou |
| `durationMs` | para onde foi o tempo |

E por execução: `chatCalls`, `toolCalls`, `elapsedMs`. O `iterations` e o
`exhausted` de um nó `loop` dizem se ele convergiu.

O `costPer1kTokens` no provider é o que transforma tokens em dinheiro:

```ts
super({ apiKey, model, costPer1kTokens: { input: 0.00015, output: 0.0006 } });
```

## As alavancas, por ordem de efeito

### 1. Menos turnos

Todo turno é uma chamada completa ao modelo, com o histórico inteiro. Um laço que
converge em 3 custa metade de um que converge em 6.

Se o `exhausted: true` aparece com frequência, a condição de parada não está
funcionando — isso não é ajuste de desempenho, é bug. Veja
[Laços](/pt/techniques/loops).

### 2. Um histórico menor

Todo turno reenvia tudo, então o tamanho do histórico se multiplica ao longo dos
turnos. Uma tool devolvendo 4KB doze vezes significa que a última chamada carrega
~50KB de conteúdo velho.

A correção mais barata é na tool:

```ts
return texto.length <= MAX ? texto : `${texto.slice(0, MAX)}\n… [truncado]`;
```

A correção geral é o
[`contextWindow()`](/pt/techniques/context-management) — mas meça o
`promptTokens` antes de recorrer a ele, porque cortar muda o comportamento do
agente em silêncio.

### 3. Menos agentes

Cada divisão acrescenta pelo menos uma chamada ao modelo por execução. Estruturas
multiagente são a forma mais fácil de triplicar o custo sem perceber. Veja
[Sistemas multiagente](/pt/techniques/multi-agent-systems).

### 4. Um modelo menor onde couber

O `provider` é por agente, então um passo de classificação não precisa do modelo
que o passo de raciocínio precisa:

```ts
@Agent({ provider: RapidoBarato, prompt: "./classificador.agent.md" })
@Agent({ provider: LentoInteligente, prompt: "./raciocinador.agent.md" })
```

### 5. Cache

Chamadas idênticas são mais comuns do que se espera, especialmente em
`temperature: 0`:

```ts
await app.use({
  name: "cache",
  chat: async (inv, next) => {
    const chave = hash(inv.messages);
    const guardado = await cache.get(chave);
    if (guardado) {
      inv.meta({ cacheHit: true });
      return guardado;
    }
    return cache.set(chave, await next());
  },
});
```

O `inv.meta()` é o que torna a taxa de acerto visível no report — senão uma
chamada de 4ms é indistinguível de uma rápida.

## Cache de prompt

Providers dão desconto num prefixo repetido. É por isso que o `contextWindow()`
**nunca corta as mensagens `system` iniciais** — cortar do topo invalidaria o
desconto a cada turno.

A regra prática: mantenha o que é estável na frente, e deixe o que muda acumular
atrás. Colocar um timestamp no topo de um prompt desliga o cache de prompt da
execução inteira, em silêncio.

## Latência e custo

Eles puxam em direções diferentes.

**`parallel`** reduz tempo de parede, não chamadas. Três ramos de 2 segundos levam
~2 segundos em vez de 6, pelas mesmas três chamadas. Compensa quando os ramos são
genuinamente independentes.

**Streaming** não deixa nada mais rápido, mas o tempo até o primeiro token é o que
o usuário percebe:

```ts
for await (const token of exec.textStream) res.write(token);
```

**Menos chamadas de tool, maiores** são melhores que muitas pequenas — cada ida e
volta é uma chamada completa ao modelo.

## Desligue a observação quando não precisar

Uma execução sem `report`, `log`, plugin ou `observe: true` pula a construção da
árvore, a emissão de eventos e o pedido de streaming. Vale cerca de **2× em tempo
de CPU por execução**.

```ts
await app.run({ input, log: false, report: debug ? { … } : false });
```

Além disso, `report: true` num serviço movimentado é crescimento ilimitado de
disco com arquivos que ninguém lê. Amostre, ou encaminhe eventos para um plugin.

## Concorrência

Execuções são quase todas `await`, então um processo aguenta muitas ao mesmo
tempo. Mas concorrência sem limite contra um provider com rate limit produz
`429`s, sobre os quais o retry então faz backoff — transformando uma sobrecarga
rápida numa lenta.

```ts
import pLimit from "p-limit";
const limite = pLimit(10);
```

Para um Ollama local o número útil é pequeno — muitas vezes 1 ou 2, já que ele
serve uma geração por vez.

## O que não vale otimizar

- **O overhead do próprio framework.** A conversão de schema é memoizada, os ids
  dos nós são um contador em vez de `randomUUID`, e a instrumentação é no-op
  quando não há observação. Não é o seu gargalo.
- **O `Thena.create`.** Síncrono, sem I/O. Chame uma vez mesmo assim, porque o
  workflow compila e os stores conectam uma vez.
- **Micro-otimizar código de tool.** Uma tool que leva 3ms ao lado de uma chamada
  de modelo de 1,8s é ruído.

## Relacionado

- [Escala](/pt/deployment/scaling)
- [Janela de contexto](/pt/techniques/context-management)
- [Orçamentos](/pt/techniques/budgets)
- [Report](/pt/devtools/report)
