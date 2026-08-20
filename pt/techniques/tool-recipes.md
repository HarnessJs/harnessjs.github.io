# Receitas de tools

Uma tool é uma classe com três campos e um método. Copie, mude o corpo, pronto.

O ThenaJS não publica pacote de tools — não teria o que publicar.

## Shell

```ts
import { Tool } from "@thenajs/core";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const run = promisify(exec);

@Tool({
  name: "shell",
  description: "Executa um comando shell e devolve a saída.",
  schema: z.object({ command: z.string() }),
})
export class ShellTool {
  async execute({ command }: { command: string }) {
    const { stdout } = await run(command);
    return stdout;
  }
}
```

::: danger Isto dá execução de comando ao modelo
Na sua máquina, tudo bem. Num serviço que lê entrada de terceiro, não — veja
[endurecendo](#endurecendo-para-producao).
:::

## Buscar uma página

```ts
import { Tool } from "@thenajs/core";
import { z } from "zod";

@Tool({
  name: "fetch_page",
  description: "Busca uma página web e devolve o texto dela.",
  schema: z.object({ url: z.string() }),
})
export class FetchPageTool {
  async execute({ url }: { url: string }) {
    const html = await (await fetch(url)).text();
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}
```

## Ler um arquivo

```ts
import { Tool } from "@thenajs/core";
import { readFile } from "node:fs/promises";
import { z } from "zod";

@Tool({
  name: "read_file",
  description: "Lê um arquivo do projeto. Use antes de responder sobre código.",
  schema: z.object({ path: z.string() }),
})
export class ReadFileTool {
  execute({ path }: { path: string }) {
    return readFile(path, "utf8");
  }
}
```

## Chamar a sua API

```ts
import { Tool } from "@thenajs/core";
import { z } from "zod";

@Tool({
  name: "buscar_pedido",
  description: "Busca um pedido pelo id e devolve o status.",
  schema: z.object({ pedidoId: z.string() }),
})
export class BuscarPedidoTool {
  async execute({ pedidoId }: { pedidoId: string }) {
    const pedido = await (await fetch(`${API}/pedidos/${pedidoId}`)).json();
    return `Pedido ${pedidoId}: ${pedido.status}.`;
  }
}
```

## Endurecendo para produção

Tudo acima funciona. O que segue é o que você acrescenta **quando** o caso pedir
— e cada item resolve um problema concreto, não é cerimônia.

### Trunque a saída

O maior custo escondido. Uma tool que devolve 4 KB doze vezes manda ~50 KB de
conteúdo velho na última chamada, e você paga por isso a cada turno.

```ts
const MAX = 4_000;
return texto.length <= MAX ? texto : `${texto.slice(0, MAX)}\n… [truncado]`;
```

### Escreva o erro que o modelo lê

Sem `try`, o `ENOENT` cru vira a observação — e ele descreve uma syscall, não o
que fazer em seguida.

```ts
catch {
  return { content: `Não existe arquivo em "${path}". Confira o caminho.`, isError: true };
}
```

Isso **não** derruba a execução: o modelo lê e tenta outra coisa. Para o que ele
não conserta — banco fora do ar, credencial expirada — use
`throw new FatalToolError("…")`.

### Repasse o `signal`

Sem isso, cancelar a execução não interrompe a sua tool; ela só tem efeito entre
os passos.

```ts
async execute(@input() { url }: { url: string }, @context() ctx: Context) {
  const res = await fetch(url, { signal: ctx.signal });
}
```

### Ponha timeout no que pode pendurar

```ts
await run(command, { timeout: 30_000 });
```

### Estreite o schema

Cada restrição é uma classe de erro que o modelo não consegue produzir:

```ts
schema: z.object({
  url: z.string().url(),
  servico: z.enum(["api", "worker", "web"]),
});
```

### Allowlist, se for shell com entrada não confiável

```ts
const PERMITIDOS = new Set(["git", "ls", "cat"]);

const programa = command.trim().split(/\s+/)[0] ?? "";
if (!PERMITIDOS.has(programa)) return { content: "não permitido", isError: true };

// Sem esta linha a lista não vale nada: `git status; rm -rf /` começa com `git`.
if (/[;&|`$><]/.test(command)) return { content: "sem encadeamento", isError: true };
```

Isso limita **quais programas** rodam, não o que um permitido faz — o `cat` lê
qualquer arquivo que o processo alcance. Para entrada não confiável de verdade, a
fronteira é um contêiner, não um regex.

## Relacionado

- [Projetar tools](/pt/techniques/tool-design) — por que a `description` decide
  se a tool é usada
- [Erros](/pt/fundamentals/errors) — observação e `FatalToolError`
- [Segurança](/pt/best-practices/security) — menor privilégio
