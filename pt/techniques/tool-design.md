# Projetar tools

Uma tool que o modelo nunca chama é pior que tool nenhuma: custa contexto a cada
turno e não faz nada. A maioria dos problemas de tool é problema de descrição.

## A descrição é prompt

O modelo decide a partir dela, literalmente.

```ts
description: "Operações de arquivo.";                                     // vago
description: "Lê um arquivo do projeto. Use antes de responder sobre código."; // decidível
```

Escreva como instrução para um colega que não vê o seu código: o que ela faz, e
**quando recorrer a ela**. O `.describe()` nos campos do schema também é lido:

```ts
schema: z.object({
  path: z.string().describe("caminho relativo à raiz do projeto, ex.: src/main.ts"),
});
```

## Faça o schema estreito

Cada restrição que você expressa é uma classe de falha que o modelo não consegue
produzir, pega antes de o seu código rodar:

```ts
schema: z.object({
  path: z.string(),
  linhas: z.number().int().min(1).max(500).default(100),
  modo: z.enum(["ler", "stat"]),
});
```

Um `enum` é melhor que uma string livre. Um `default` remove uma decisão.
Argumento inválido nunca chega no `execute` — o modelo é informado do erro e
tenta de novo.

## Devolva um orçamento, não uma mangueira

Saída de tool é a forma mais rápida de entupir a janela de contexto, e é o que
envelhece pior: o modelo raramente precisa de um arquivo inteiro dez turnos
depois.

```ts
const MAX_CHARS = 4000;

async execute({ path }: { path: string }) {
  const texto = await readFile(path, "utf8");
  return texto.length <= MAX_CHARS
    ? texto
    : `${texto.slice(0, MAX_CHARS)}\n… [truncado, ${texto.length} chars no total]`;
}
```

Dizer que truncou importa — senão o modelo trata um arquivo parcial como o
arquivo inteiro.

## Escreva o erro que o modelo lê

```ts
return { content: `Não existe arquivo em "${path}". Confira o caminho.`, isError: true };
```

`ENOENT: no such file or directory, open 'READMEE.md'` descreve uma syscall. A
versão acima diz ao modelo o que fazer em seguida. Veja
[Erros](/pt/fundamentals/errors).

E para o que o modelo não conserta, `FatalToolError` — que também mantém a
mensagem de um driver fora do contexto do modelo e do seu disco.

## Uma tool, um verbo

Uma tool `gerenciar_arquivos` com um parâmetro `acao` força o modelo a tomar duas
decisões de uma vez, e a segunda é invisível na lista de tools. Prefira:

```
read_file · write_file · list_files
```

A exceção é quando as operações realmente compartilham argumentos e só uma é
correta — uma busca com um filtro `tipo`, por exemplo.

## Mantenha função pura onde der

Por padrão o `execute` recebe só os argumentos validados, o que torna a tool
trivial de testar:

```ts
expect(await new ReadFileTool().execute({ path: "x.txt" })).toBe("olá");
```

Cada `@context()` e `@state()` que você acrescenta abre mão disso. Acrescente
quando precisar — repassar um signal, gravar no estado do fluxo, disparar uma
[execução aninhada](/pt/techniques/nested-runs) — e não por padrão.

## Repasse o signal

Qualquer coisa que demore:

```ts
async execute(@input() { url }: { url: string }, @context() ctx: Context) {
  const res = await fetch(url, { signal: ctx.signal });
  return res.text();
}
```

Sem isso, o cancelamento só tem efeito entre os passos.

## `data` para o que o modelo não deve ler

```ts
return {
  content: `Encontrei 42 ocorrências.`, // o que o modelo vê
  data: { ocorrencias, queryMs: 18 }, // para hooks, report, telemetria
};
```

Detalhe estruturado pertence aqui, e não serializado na observação.

## Entregue só o necessário

O array `tools` é a fronteira de segurança — o agente faz exatamente o que está
nele, e nada além. Um agente que lê conteúdo não confiável e segura uma tool com
efeito colateral é superfície de ataque. Uma tool de shell é o exemplo mais claro
— veja o aviso dela em [Receitas de tools](/pt/techniques/tool-recipes).

Prefira uma tool estreita a uma genérica: `reiniciar_servico(nome)` com um enum
de serviços conhecidos é melhor que `rodar_shell(comando)`.

## Diagnosticando "ele não usou minha tool"

1. **Leia a `description` como o modelo lê.** Ela diz *quando*?
2. **Confira se o prompt manda agir.** *"Antes de responder, leia os arquivos
   relevantes."*
3. **Confira o `toolCallSource` nos nós `chat` do report.** `"rescued"` significa
   que o modelo escreveu a chamada como texto e o framework recuperou — funciona,
   mas você está no limite do que aquele modelo dá conta.
4. **Conte as tools.** Vinte tools é uma escolha difícil para um modelo pequeno.

## Relacionado

- [Tools](/pt/fundamentals/tools) — a mecânica
- [`@Tool`](/pt/reference/tool)
- [Erros](/pt/fundamentals/errors)
- [Segurança](/pt/best-practices/security)
