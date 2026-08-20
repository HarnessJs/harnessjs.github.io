# Mascaramento

Mascaramento de segredo no conteúdo capturado — prompt, resposta, I/O das tools e
mensagem de erro — antes de qualquer coisa chegar ao report, ao log ou a um
plugin.

**Vem ligado.** Um arquivo em disco, sem retenção nem controle de acesso, é o
pior lugar para um segredo aparecer por descuido.

## O que o default pega

O `redactSecrets` conhece um conjunto de padrões conhecidos:

- headers de autorização `Bearer …`
- connection string com senha
- chaves no estilo OpenAI (`sk-…`)
- tokens do GitHub (`ghp_…`)
- JWT
- campos nomeados como `api_key`, `password`

```ts
export const config: ThenaConfig = { redact: true }; // o default
```

## Configurando

```ts
type RedactConfig = false | ((field: string, value: string) => string);
```

| Valor | Efeito |
| --- | --- |
| ausente | `redactSecrets`, os padrões conhecidos |
| `false` | **desliga** — só se o report nunca sair da sua máquina |
| função | substitui o default inteiro |

O argumento `field` diz o que está sendo mascarado (`"prompt"`, `"response"`,
I/O de tool, erro), então uma regra pode valer para um tipo de conteúdo e não
para os outros.

## Acrescentar padrões sem perder os de fábrica

Uma função **substitui** o default em vez de estendê-lo. Componha
explicitamente:

```ts
import { redactSecrets } from "@thenajs/core";

const ID_INTERNO = /\bACC-\d{8}\b/g;

export const config: ThenaConfig = {
  redact: (field, value) => redactSecrets(value).replace(ID_INTERNO, "ACC-********"),
};
```

Esquecer de chamar o `redactSecrets` dentro da sua função desliga em silêncio tudo
que ele cobria — o erro mais provável desta página.

## O que ele não consegue fazer

Mascaramento é regex sobre texto. Ele pega coisas com **formato reconhecível**.

Não pega o nome de um cliente, um endereço, uma anotação livre, uma URL interna,
ou um segredo sem formato distintivo. Não existe regex para "dado pessoal".

Para execuções sobre dado pessoal real, a ferramenta não é um padrão melhor — é
não gravar o texto:

```ts
await app.run({ input, report: { content: false } });
```

Isso mantém a árvore, as durações e a telemetria, e descarta todo prompt,
resposta e payload de tool. Você continua tendo o formato da execução, o custo e
os tempos; só não consegue ler o que foi dito.

## Onde vale

| Destino | Mascarado |
| --- | --- |
| `report` (HTML e JSON) | sim |
| `log`, inclusive `"verbose"` | sim |
| payload de `onEvent` de plugin | sim |
| o contexto do próprio modelo | **não** |
| `run({ data })` | não se aplica — nunca é capturado |

A terceira linha importa para quem escreve plugin: o que chega ao `onEvent` já
vem mascarado, então você não consegue desmascarar, e não deveria montar uma
segunda camada de mascaramento por cima.

A quarta é a importante: o mascaramento protege **o que é gravado**, não o que é
enviado. Um segredo que você põe num prompt continua indo para o modelo. Manter
coisas longe do modelo é para o que o
[`run({ data })`](/pt/fundamentals/state-and-context#memory-e-data) serve.

## Usando fora do framework

O `redactSecrets` é exportado e é um `string => string` comum:

```ts
import { redactSecrets } from "@thenajs/core";

logger.info(redactSecrets(algumTexto));
```

Útil quando a sua tool loga alguma coisa por conta própria, num caminho que o
framework nunca vê.

## Custo

O mascaramento roda por campo capturado, só no caminho de gravação. Numa execução
sem `report`, `log` nem plugin, nada é capturado e nada é mascarado.

Se você tem um caminho muito quente e mediu que isso importa, `false` desliga —
mas releia a primeira frase desta página antes.

## Relacionado

- [`ThenaConfig`](/pt/reference/thena-config)
- [Segurança](/pt/best-practices/security)
- [Report](/pt/devtools/report)
