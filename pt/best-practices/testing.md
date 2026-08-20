# Testes

O modelo é não determinístico, lento e custa dinheiro. Bons testes de agente são
os que não envolvem ele.

Três camadas, da mais barata para a mais cara.

## 1. Tools, como funções comuns

Uma tool que recebe só `@input()` não precisa de nada do framework:

```ts
import { ReadFileTool } from "../src/tools/read-file.tool";

test("trunca arquivos grandes", async () => {
  const tool = new ReadFileTool();
  const saida = await tool.execute({ path: "fixtures/grande.txt" });
  expect(saida).toContain("[truncado]");
});
```

É aqui que a maior parte da sua lógica deveria morar, e é o principal argumento
prático para manter as tools puras — veja
[Projetar tools](/pt/techniques/tool-design).

Teste o schema também, já que ele é uma fronteira de verdade:

```ts
test("rejeita caminho fora do projeto", () => {
  const schema = getToolMetadata(ReadFileTool).schema;
  expect(schema.safeParse({ path: "../../etc/passwd" }).success).toBe(false);
});
```

## 2. O formato do workflow, com agentes stubados

Uma classe de agente com método `run(input, ctx)` assume o passo inteiro — sem
chamada ao modelo, sem hooks. Isso torna a estrutura do workflow testável:

```ts
const rodadas: number[] = [];

class StubRevisor {
  constructor(@state() private readonly s: RevisaoState) {}
  async run() {
    this.s.aprovado = ++this.s.rodadas >= 3;
    rodadas.push(this.s.rodadas);
    return "revisado";
  }
}

@Workflow({
  state: RevisaoState,
  steps: [loop({ steps: [StubRevisor], until: (_c, s: RevisaoState) => s.aprovado })],
})
class TesteWorkflow {}

test("para assim que é aprovado", async () => {
  await Thena.create(TesteWorkflow).run({ input: { message: "vai" } });
  expect(rodadas).toEqual([1, 2, 3]); // parou sozinho, não no teto
});
```

É assim que se testa a coisa com mais chance de estar errada — a condição de
parada — sem modelo.

## 3. A camada do modelo, falsificada

Um middleware `chat` substitui a chamada ao provider inteira:

```ts
await app.use({
  name: "modelo-falso",
  chat: async () => ({ content: "APROVADO", toolCalls: [] }),
});
```

Isso basta para a maioria dos testes: o agente roda, as tools rodam, o laço roda,
e nada toca a rede.

Quando você precisa que o modelo diga algo *diferente* a cada turno — para testar
que o agente se recupera de um erro de tool, por exemplo — devolva as respostas em
ordem:

```ts
const respostas = [
  { content: "", toolCalls: [{ name: "read_file", arguments: { path: "nao" } }] },
  { content: "", toolCalls: [{ name: "read_file", arguments: { path: "README.md" } }] },
  { content: "É um framework.", toolCalls: [] },
];

let turno = 0;
await app.use({ name: "roteirizado", chat: async () => respostas[turno++] });
```

Sem rede, determinístico, rápido — e testa o laço, a tool, a recuperação de erro e
a ligação entre eles, juntos.

## Asserte sobre o report, não sobre a prosa

`expect(resposta).toContain("...")` contra saída real de modelo é um teste
instável. Os dados estruturados são estáveis:

```ts
const eventos: ExecutionEvent[] = [];
await app.run({ input, log: (e) => eventos.push(e) });

const tools = eventos.filter((e) => e.kind === "tool" && e.phase === "end");
expect(tools).toHaveLength(2);
expect(tools[0].status).toBe("error"); // ele se recuperou de uma falha
```

"Ele chamou as tools certas, na ordem certa, e convergiu?" é uma pergunta real com
resposta estável. "Ele usou a palavra 'framework'?" não é.

## Falsifique o banco vetorial

O contrato do `VectorStore` são quatro métodos, então uma implementação em memória
deixa os testes de memória offline e determinísticos:

```ts
export class MemoryStore extends VectorStore {
  private pontos: VectorDocument[] = [];
  async ensureCollection() {}
  async upsert(docs: VectorDocument[]) { this.pontos.push(...docs); }
  async search({ vector, limit = 5 }: VectorSearch) { … }
  async remove() { this.pontos = []; }
}
```

Veja [Bancos vetoriais próprios](/pt/advanced/custom-vector-stores).

## Quando você testa contra um modelo de verdade

Às vezes é preciso — é ali que a qualidade do prompt de fato aparece. Mantenha
esses separados dos testes unitários:

```ts
test.skipIf(!process.env.RUN_MODEL_TESTS)("acha o ponto de entrada", async () => {
  …
});
```

Fixe o sampling, ou o teste é cara ou coroa:

```ts
sampling: { temperature: 0, seed: 42 }
```

E dê um `budget` a todo teste desses — uma suíte de testes é exatamente onde um
laço desgovernado passa despercebido até a fatura.

## O isolamento torna testes paralelos seguros

Cada execução abre o próprio contexto, então arquivos de teste rodam em paralelo
sem se contaminar — a suíte do próprio framework é configurada assim de propósito.

A exceção é o seu próprio estado de módulo. Um `let` no escopo de módulo dentro de
uma tool vai se intercalar entre testes paralelos, do mesmo jeito que se
intercala sob carga em produção.

## Sempre `dispose()`

```ts
afterEach(() => app.dispose());
```

Um plugin que abriu um servidor mantém o runner de teste vivo. O `thenaFlow()` num
teste é o culpado usual.

## Relacionado

- [Depuração](/pt/devtools/debugging)
- [Projetar tools](/pt/techniques/tool-design)
- [Escrever plugins](/pt/advanced/writing-plugins)
- [Arquitetura](/pt/best-practices/architecture)
