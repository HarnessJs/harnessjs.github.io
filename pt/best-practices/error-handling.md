# Tratamento de erros

A posição do framework: **falha de tool é observação, todo o resto é exceção.** A
maior parte da boa prática aqui é decidir, para cada falha, qual das duas ela é.

## A pergunta a fazer

*Uma próxima ação diferente teria chance de dar certo?*

| Falha | Resposta | Faça |
| --- | --- | --- |
| caminho errado, 404, query malformada | sim | devolva `{ content, isError: true }` |
| credencial ruim, banco morto, um bug | não | `throw new FatalToolError(…)` |
| o modelo pediu uma tool que não existe | sim | nada — já é tratado |
| um hook ou middleware falhou | não | deixe propagar |

Errar isso é caro numa direção e confuso na outra: uma falha fatal tratada como
recuperável queima turnos retentando o que não pode funcionar, e uma falha
recuperável tratada como fatal mata uma execução que o modelo teria consertado
sozinho.

## Escreva a observação, não vaze a exceção

```ts
// ✗ o modelo lê uma syscall
async execute({ path }: { path: string }) {
  return readFile(path, "utf8");
}

// ✓ o modelo lê uma instrução
async execute({ path }: { path: string }) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return { content: `Não existe arquivo em "${path}". Confira o caminho.`, isError: true };
  }
}
```

A mensagem de erro de um driver é escrita para humano, é verbosa o bastante para
entupir o contexto, e pode carregar uma connection string ou um host interno — que
então vai para o modelo **e** para o report em disco.

## O `FatalToolError` mantém a mensagem original fora

```ts
try {
  return await db.query(sql);
} catch (err) {
  throw new FatalToolError("banco indisponível", { cause: err });
}
```

A execução encerra com a sua mensagem. O `cause` é preservado para os seus logs,
então você não perde nada operacionalmente enquanto o contexto do modelo fica
limpo.

## Degrade em vez de morrer

O `onError` transforma um crash em resposta parcial:

```ts
async onError(error: Error, ctx: Context) {
  ctx.meta({ falhou: error.name });      // continua visível no report
  return "Não consegui completar esse passo.";
}
```

Bom para um ramo de um `parallel` que não pode derrubar os outros. Ruim como
captura genérica — um agente que engole tudo reporta sucesso enquanto não produz
nada.

Repare no `ctx.meta()`: um erro tratado que não deixa rastro é como uma
degradação silenciosa vira mistério.

## Negue de forma recuperável, não fatal

Um `throw` no `beforeTool` encerra a execução. Quando o modelo deveria poder
tentar outra coisa, use um middleware de tool:

```ts
tool: async (inv, next) => {
  if (inv.name === "deploy" && !permitido(inv.run)) {
    return { content: "Deploy não é permitido nesta execução.", isError: true };
  }
  return next();
};
```

A diferença é "esta execução acabou" versus "tente outra coisa".

## Sempre limpe no `onDispose`

```ts
const conn = await pool.acquire();
ctx.onDispose(() => conn.release());
```

Código depois do `await app.run()` não executa quando a execução é abortada. O
`onDispose` roda em todo encerramento — sucesso, erro, abort — na ordem inversa.

É o único lugar correto para qualquer coisa que precisa ser liberada.

## Trate a rejeição

Desde a 0.9, o `app.run()` rejeita em vez de engolir:

```ts
try {
  await app.run({ input, budget: { maxCostUsd: 1, mode: "throw" } });
} catch (err) {
  if (err instanceof BudgetExceededError) {
    metricas.incrementar(`budget.${err.info.reason}`);
    return respostaParcial();
  }
  if (exec.signal.aborted) return; // cliente saiu; não há a quem responder
  throw err;
}
```

Três desfechos distintos que vale separar: parada por orçamento, cancelamento, e
falha de verdade. Tratar os três como 500 é um problema de monitoramento.

## Parar não é falhar

`ctx.stop()` e `mode: "stop"` **resolvem**. Uma execução que bateu no teto é
idêntica a uma que terminou, o que é intencional — e significa que você precisa do
`onExceeded` se quiser saber:

```ts
budget: {
  maxCostUsd: 0.5,
  onExceeded: (info) => logger.warn({ reason: info.reason }, "orçamento estourou"),
}
```

O mesmo para laços: o `onExhausted` é o que distingue "convergiu" de "acabaram os
turnos".

## Retente a rede, não o raciocínio

Dois mecanismos diferentes, fáceis de confundir:

| | `retry` do provider | O laço do agente |
| --- | --- | --- |
| Repete | a chamada HTTP | o raciocínio do modelo |
| Porque | a rede falhou | uma tool devolveu erro |
| Custa | uma tentativa, mesmos tokens | um turno inteiro a mais |

Uma falha de tool **não** dispara a política de retry. E defina o `timeoutMs` —
uma requisição pendurada nunca rejeita, então o retry nunca dispara, que é a
execução que morre com `fetch failed` depois de ~300 segundos.

## Erros comuns

**Capturar tudo no `onError` e devolver uma string.** A execução "tem sucesso" com
uma resposta inútil.

**Deixar o `err.message` virar a observação.** Verboso, feito para humano, e às
vezes sensível.

**Lançar para negar uma tool.** Encerra a execução; normalmente você queria
`isError`.

**Limpar depois do `await run()`.** Nunca roda em abort.

**Supor que um erro de tool matou a execução.** Quase certamente não matou —
procure um `FatalToolError`, ou um erro lançado fora de uma tool.

## Relacionado

- [Erros](/pt/fundamentals/errors)
- [Projetar tools](/pt/techniques/tool-design)
- [Cancelamento](/pt/techniques/cancellation)
- [Orçamentos](/pt/techniques/budgets)
