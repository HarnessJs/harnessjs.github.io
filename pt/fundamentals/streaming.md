# Streaming

O `app.run()` devolve um `RunHandle`, não uma `Promise`. A regra: **com `await`,
você pede o resultado; sem `await`, você pede a execução.**

```ts
const texto = await app.run({ prompt }); // o resultado
const exec = app.run({ prompt }); // a execução
```

Ele é *thenable*, então as duas coisas convivem sem que o `run` precise virar
dois métodos.

## Por que um handle

Uma `Promise` não expressa três usos reais: cancelar, observar o que está
acontecendo, e **guardar** a execução para reencontrá-la depois — o padrão de
responder um `runId` num POST e acompanhar por SSE.

```ts
const exec = app.run({ prompt, observe: true });

exec.runId; // disponível de forma síncrona, antes do primeiro turno
exec.result; // uma Promise comum — compõe com Promise.all
exec.signal; // o seu, combinado com o abort() deste handle
exec.abort(reason); // cancela
```

## Dois streams

Token e passo são canais separados, de propósito: token não é um passo da
execução — não tem início, fim nem status.

```ts
// o texto, conforme o modelo escreve
for await (const token of exec.textStream) process.stdout.write(token);

// os passos, conforme acontecem
for await (const evento of exec.eventStream) console.log(evento.kind);
```

Ou com callbacks, cada um devolvendo como cancelar a assinatura:

```ts
const off = exec.onToken((t) => process.stdout.write(t));
exec.onEvent((e) => metricas.registrar(e));
```

### Quem assina atrasado recebe o que já passou

Quem assina depois do início **recebe o que já aconteceu** antes dos itens novos.
Sem isso, um SSE que conecta três segundos após o POST veria a execução começando
do meio — e um `for await` sobre o texto começaria no meio da frase.

O buffer de eventos tem teto de 500 eventos. Com `report` ligado cada evento
carrega prompt e resposta, e o padrão POST+SSE mantém vários handles vivos ao
mesmo tempo — o teto troca o começo de uma execução muito longa por um limite de
memória previsível.

::: warning O streaming só acontece se o provider suportar
Um provider que ignore o `onToken` continua funcionando; o texto simplesmente
chega inteiro no `result`.
:::

## A observação é opt-in

Esta é a parte que surpreende:

```
[thena] onEvent() will receive nothing: this run is not being observed.
Use `run({ observe: true })`, or turn on `report`, `log` or a plugin with `onEvent`.
```

Uma execução sem observador não constrói a árvore de execução, não emite eventos
e não pede streaming ao provider. É o caminho de custo zero e vale cerca de **2×
em tempo de CPU por execução**.

A observação liga sozinha quando há `report`, `log`, ou um plugin com `onEvent`.
Quando o único consumidor é o handle, diga:

```ts
const exec = app.run({ prompt, observe: true });
```

Você recebe o aviso uma vez, em vez de um `for await` que nunca rende.

## O padrão POST + SSE

O motivo de o handle existir:

```ts
app.post("/runs", (req, res) => {
  const exec = agente.run({
    prompt: req.body.message,
    observe: true,
    signal: req.signal,
  });
  res.json({ runId: exec.runId }); // respondido antes do primeiro turno
  execucoes.set(exec.runId, exec);
});

app.get("/runs/:id/stream", async (req, res) => {
  const exec = execucoes.get(req.params.id);
  res.setHeader("Content-Type", "text/event-stream");
  for await (const evento of exec.eventStream) {
    res.write(`data: ${JSON.stringify(evento)}\n\n`);
  }
  res.end();
});
```

O `runId` é síncrono, então o POST responde na hora. O cliente conecta quando
quiser e ainda assim vê a execução inteira, por causa do replay acima.

O `eventStream` como `AsyncIterable` dá backpressure num socket lento, o que a
forma com callback não dá.

## Erro não fica sem tratamento

Um handle cuja execução falha não derruba o processo com `unhandledRejection`,
mesmo que ninguém tenha dado `await` ainda — que é exatamente a situação do
POST+SSE. O erro continua disponível em `.result`; ele só deixa de ser "não
tratado".

## Relacionado

- [A execução](/pt/fundamentals/the-run)
- [Erros](/pt/fundamentals/errors)
- [Middleware e plugins](/pt/fundamentals/middleware)
