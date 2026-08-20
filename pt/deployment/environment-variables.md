# Variáveis de ambiente

**O ThenaJS não lê nenhuma.** Não existe `THENA_*` para aprender, nem convenção
de `.env`, nem fallback implícito para `OPENAI_API_KEY`.

Isso é deliberado. O framework nunca busca um global, que é o que permite dois
providers no mesmo processo usarem duas chaves diferentes — e o que faz o
[multi-tenancy](/pt/deployment/multi-tenancy) funcionar.

## De onde a configuração realmente vem

| Configuração | Onde |
| --- | --- |
| chave de API, host, modelo | a sua classe ou factory de provider |
| log, report, mascaramento, bancos vetoriais | `ThenaConfig` |
| orçamento, cancelamento, sobrescritas por execução | `app.run({ … })` |

Variável de ambiente é assunto da sua aplicação, e você lê onde quiser:

```ts
export class GptProvider extends OpenAIProvider {
  constructor() {
    super({
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    });
  }
}
```

## Falhe na subida, não no meio da execução

`process.env.X!` vira `undefined` em silêncio e falha na primeira chamada ao
modelo — um turno adentro de uma execução que já gastou dinheiro.

Valide uma vez, no boot:

```ts
// src/env.ts
import { z } from "zod";

export const env = z
  .object({
    OPENAI_API_KEY: z.string().min(1),
    OLLAMA_HOST: z.string().url().default("http://localhost:11434"),
    QDRANT_URL: z.string().url().optional(),
  })
  .parse(process.env);
```

```ts
import { env } from "../env";

super({ apiKey: env.OPENAI_API_KEY, model: "gpt-4o-mini" });
```

O Zod já é dependência, já que os schemas das tools usam ele.

## O que pertence ao ambiente

- credenciais — chaves de API, chave do banco vetorial
- endpoints — o host do Ollama, um gateway interno
- o nome do modelo, quando ele muda entre ambientes
- as suas próprias feature flags

## O que não pertence

**Prompts.** Eles pertencem a arquivos `.md` ao lado do agente, que é o ponto
inteiro da separação. Um prompt numa variável de ambiente não dá para diffar,
revisar nem ler como prosa.

**Orçamentos e limites.** Eles pertencem à execução, e normalmente derivam do
tenant ou do plano, e não do deployment.

**Segredos que você passa ao modelo.** Uma chave de API que chega a um prompt
chega ao report também. O mascaramento pega os formatos conhecidos como rede de
proteção, mas a correção é não colocar ali — use o
[`run({ data })`](/pt/fundamentals/state-and-context#memory-e-data).

## Em contêineres

Forneça como variáveis de ambiente de verdade, em vez de um `.env` assado na
imagem:

```yaml
services:
  agent:
    image: meu-agente
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OLLAMA_HOST: http://ollama:11434
```

`localhost` dentro de um contêiner é o contêiner. Um Ollama local é um serviço à
parte e precisa do nome de serviço dele, ou do endereço do host.

## Desenvolvimento local

O framework não tem carregador de `.env`. O Node 20.6+ tem um embutido:

```bash
node --env-file=.env dist/main.js
```

Ou `tsx --env-file=.env src/main.ts` em desenvolvimento. De qualquer forma, o
`.env` vai para o `.gitignore` — o projeto gerado pelo CLI já ignora.

## Relacionado

- [Configuração](/pt/get-started/configuration)
- [Produção](/pt/deployment/production)
- [Segurança](/pt/best-practices/security)
- [Multi-tenancy](/pt/deployment/multi-tenancy)
