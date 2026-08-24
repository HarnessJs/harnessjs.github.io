# Cancelamento

Três formas de encerrar uma execução antes do fim, e elas não são
intercambiáveis.

| | Termina como | Chega dentro das tools |
| --- | --- | --- |
| `signal` / `abort()` | rejeita | sim, pelo `ctx.signal` |
| `ctx.stop()` | resolve com a saída que já havia | não — o turno termina |
| `budget` | `"stop"` ou `"throw"` | não |

## De fora: `signal`

```ts
app.run({ prompt, signal: req.signal });                  // cliente desconectou
app.run({ prompt, signal: AbortSignal.timeout(30_000) }); // prazo duro
```

Combina com o `abort()` do handle — o que disparar primeiro vence.

## Pelo handle: `abort()`

```ts
const exec = app.run({ prompt });
exec.abort(new Error("cancelado pelo usuário"));
```

A `reason` chega inteira no `catch` de quem chamou, então use um erro seu quando
quiser distinguir motivos:

```ts
class CanceladoPeloUsuario extends Error {}

try {
  await exec;
} catch (err) {
  if (err instanceof CanceladoPeloUsuario) return res.status(499).end();
  throw err;
}
```

## De dentro: `ctx.abort()`

Disponível em tools e hooks:

```ts
async execute(@input() args, @context() ctx: Context) {
  if (await ehProibido(args)) ctx.abort(new Error("alvo proibido"));
}
```

## O cancelamento só chega até onde você levar

Esta é a parte que passa despercebida. O `abort()` interrompe o trabalho do
próprio framework, mas uma tool bloqueada num `fetch` continua a menos que você
entregue o signal a ela:

```ts
async execute(@input() { url }: { url: string }, @context() ctx: Context) {
  const res = await fetch(url, { signal: ctx.signal });   // ← o ponto todo
  return res.text();
}
```

Tudo que demora deve receber o `ctx.signal`: `fetch`, um driver de banco,
`readFile`, um processo filho. Sem isso, o `abort()` só tem efeito *entre* os
passos.

O provider já faz isso — um abort chega no `fetch` da chamada ao modelo, e não só
no passo seguinte.

## Limpando

O `ctx.onDispose(fn)` roda no fim da execução — sucesso, erro **ou** abort — na
ordem inversa do registro, como um `defer`:

```ts
const conn = await pool.acquire();
ctx.onDispose(() => conn.release());
```

É o único lugar confiável para limpeza, porque uma execução abortada não chega ao
resto da sua função.

## `stop()` — o gracioso

```ts
async execute(@input() args, @context() ctx: Context) {
  const guardado = await consultar(args);
  if (guardado) {
    ctx.stop();          // já temos uma resposta boa
    return guardado;
  }
}
```

O `stop()` pula os passos restantes e deixa a execução **resolver** com a saída
que já tinha. Nada lança, e quem chamou não distingue de um fim normal — que é a
intenção.

É o mesmo comportamento do orçamento no modo `"stop"`.

| | `abort(reason)` | `stop()` |
| --- | --- | --- |
| A execução | rejeita | resolve |
| O turno em voo | interrompido | termina |
| Passos seguintes | interrompidos | pulados |
| Use para | uma falha, um cancelamento | "terminamos antes" |

## Encerrando o app

```ts
await app.dispose();
```

Aborta as execuções em voo, espera elas soltarem, e encerra os plugins. Num
script dá para pular; num servidor, ligue ao sinal de desligamento:

```ts
process.on("SIGTERM", async () => {
  await app.dispose();
  process.exit(0);
});
```

## Num servidor HTTP

Os dois juntos é o que faz uma execução se comportar com um cliente real:

```ts
app.post("/runs", async (req, res) => {
  const exec = agente.run({
    prompt: req.body.message,
    signal: req.signal, // o cliente caiu
    budget: { maxDurationMs: 120_000 }, // está demorando demais
  });

  try {
    res.json({ resposta: await exec });
  } catch (err) {
    if (exec.signal.aborted) return; // o cliente foi embora; não há a quem responder
    res.status(500).json({ error: String(err) });
  }
});
```

## Erros comuns

**Não repassar o `ctx.signal` a uma tool lenta.** O motivo mais comum de "o abort
não funciona".

**Usar `abort()` para "terminamos".** Ele rejeita. Você quer `stop()`.

**Limpar depois do `await run()` em vez de no `onDispose`.** Uma execução
abortada nunca chega naquela linha.

**Esquecer o `app.dispose()` num servidor.** Plugins seguram o processo vivo — o
`thenaFlow()` mantém um servidor aberto.

## Relacionado

- [Streaming](/pt/fundamentals/streaming) — o `RunHandle`
- [Orçamentos](/pt/techniques/budgets)
- [Contexto](/pt/reference/context) — `signal`, `abort`, `stop`, `onDispose`
