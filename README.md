# Motor de IA de Atendimento

Versão mínima de um motor de IA para atendimento de leads no WhatsApp, multi-tenant, feita para o teste técnico de Desenvolvedor(a) Backend.

O serviço recebe as mensagens do lead por HTTP (simulando o webhook do WhatsApp), conversa usando um LLM, qualifica o lead seguindo as regras de cada empresa e registra tudo no "CRM": ficha, tags, estágio do funil, agenda, notificações e auditoria.

**Stack:** Node.js, TypeScript, NestJS, SQLite (`node:sqlite`, nativo do Node) e LLM gratuito via API compatível com OpenAI (Groq, Gemini, OpenRouter ou Ollama).

> **Status atual:** a API, o motor, o Docker, os testes automatizados e o script de avaliação estão prontos. Na avaliação com o LLM real (Groq), 4 das 5 conversas do Anexo C passaram ([resultado](#5-resultado-do-script-de-avaliação)). O que não funciona ou ficou de fora está em [Limitações conhecidas](#6-limitações-conhecidas).

---

## 1. Como rodar

### Com Docker (recomendado)

```bash
docker compose up --build
```

Pronto: a API sobe em `http://localhost:3000` com o LLM mockado. Para usar um LLM real, crie um `.env` a partir do `.env.example` antes de subir. O banco SQLite fica em um volume do Docker, então os dados continuam lá depois de reiniciar o container.

### Sem Docker

Pré-requisito: Node.js 22.13 ou superior (por causa do `node:sqlite`).

```bash
npm install
cp .env.example .env      # ajuste LLM_PROVIDER e LLM_API_KEY se quiser usar um LLM real
npm run start:dev
```

O servidor sobe em `http://localhost:3000`. Por padrão ele usa o LLM **mockado** (`LLM_PROVIDER=mock`), então dá para testar o fluxo sem chave nenhuma.

Para usar um LLM real (ex.: Groq, que tem plano gratuito):

```env
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=sua-chave
LLM_MODEL=openai/gpt-oss-120b
```

### Testes

```bash
npm test
```

Os testes sobem a aplicação inteira com banco em memória e LLM mockado (nenhuma API é chamada) e fazem requisições HTTP de verdade. Cobrem idempotência, rajada, intervenção humana, "não inventar campo", o fallback de tag/estágio, a espera pelo resultado da agenda, o limite de iterações e o retry do adaptador do LLM (com um servidor falso que devolve 429/503).

### Exemplos de chamadas

O arquivo [`demo.http`](demo.http) tem todos os cenários prontos (caminho feliz, idempotência, rajada, intervenção humana, cliente antigo, manipulação, segundo tenant, simulação, erros e métricas) para rodar com a extensão REST Client do VS Code. Abaixo, os mesmos exemplos com curl:

```bash
# Mensagem do lead
curl -X POST localhost:3000/webhook/mensagem -H "Content-Type: application/json" -d '{
  "message_id": "wamid.123",
  "tenant_id": "sol-nascente",
  "telefone": "5581999990000",
  "texto": "oi, quero saber de energia solar",
  "timestamp": "2026-10-27T14:03:11-03:00"
}'

# Humano assume / IA volta
curl -X POST localhost:3000/intervencao -H "Content-Type: application/json" \
  -d '{"tenant_id": "sol-nascente", "telefone": "5581999990000", "acao": "assumir"}'

# Histórico e ficha do lead
curl localhost:3000/conversas/sol-nascente/5581999990000

# Métricas da empresa
curl localhost:3000/metricas/sol-nascente
```

### Endpoints

| Método | Rota | O que faz |
|---|---|---|
| POST | `/webhook/mensagem` | Recebe mensagem do lead (ou do atendente, com `"autor": "humano"`). Aceita `"simulacao": true` |
| POST | `/intervencao` | `assumir` (humano assume, IA para) ou `religar` (IA volta) |
| GET | `/conversas/{tenant_id}/{telefone}` | Histórico, ficha, tags, estágio e quem está no controle |
| GET | `/metricas/{tenant_id}` | Total de conversas, custo médio, % qualificados e % transferidos |

---

## 2. Arquitetura

Organizei o projeto por domínio, um módulo do Nest para cada responsabilidade:

```
POST /webhook/mensagem
   │
   ▼
webhook ── valida o payload, aplica idempotência, abre/agrupa a janela de rajada
   │
   ▼ (fim da janela)
engine ── monta o prompt (config da empresa + ficha do lead + histórico)
   │      e roda o loop de tool calling
   ├──► llm ──── adaptador do provedor (real ou mock)
   └──► acoes ── executa as tools, valida e grava a auditoria
            │
            ▼
         leads / agenda / notificações  (SQLite)
   │
   ▼
metricas ── registra o turno (modelo, tokens, custo, latência, ações)
```

| Pasta | Responsabilidade |
|---|---|
| `src/webhook` | Entrada das mensagens, idempotência e rajada |
| `src/engine` | Prompt do sistema e loop de tool calling |
| `src/llm` | Interface `LlmProvider` + adaptadores (OpenAI-compatible e mock) + tabela de preços |
| `src/acoes` | As 7 ações (tools), validação e auditoria |
| `src/leads` | Ficha do lead, tags, estágio e controle IA/humano |
| `src/conversas` | Mensagens e `GET /conversas` |
| `src/intervencao` | `POST /intervencao` |
| `src/metricas` | Registro dos turnos e `GET /metricas` |
| `src/tenants` | Carrega a configuração de cada empresa |
| `src/database` | Conexão SQLite e schema |
| `config/tenants` | Um JSON por empresa |

Criei dois tenants com configurações diferentes:

- `sol-nascente`: tom informal, pode dizer que é IA, atende cidades de PE e qualifica com conta acima de R$ 250.
- `aurora-solar`: tom formal, não pode dizer que é IA, atende cidades de SP e qualifica com conta acima de R$ 400.

---

## 3. Decisões e por quê

### Banco: SQLite com `node:sqlite`
O teste permite SQLite e ele resolve bem o escopo: um arquivo só, zero infraestrutura. Usei o módulo nativo do Node em vez de uma lib com binário nativo (como `better-sqlite3`) para não ter problema de compilação em máquinas e containers diferentes. Escrevi o SQL direto nos repositórios, que é pouco e fica fácil de ler.

### Idempotência no banco, não no código
O `message_id` é a chave primária da tabela `mensagens` e a inserção é feita com `INSERT OR IGNORE`. Se a mesma mensagem chegar duas vezes, até ao mesmo tempo, só uma entra. A segunda requisição recebe `200` com corpo vazio. Fazer um `SELECT` antes de inserir teria uma condição de corrida.

### Rajada ("fila")
A primeira mensagem do lead abre uma janela (configurável em `BURST_WINDOW_MS`, padrão 8 s). As mensagens que chegam durante a janela são só gravadas e respondem na hora com `{"status": "agrupada"}`. Quando a janela fecha, todas as mensagens pendentes são concatenadas e processadas em **um único turno**, e a resposta volta no request que abriu a janela (e fica disponível em `GET /conversas`).

Os turnos de um mesmo lead rodam em série, para dois processamentos não competirem pela mesma conversa. Se uma mensagem chegar enquanto a IA ainda está respondendo, ela abre uma nova janela.

Fiz isso em memória, sem fila externa, porque para uma instância só é suficiente e mantém o projeto simples de rodar. A limitação está explicada mais abaixo.

### Troca de provedor de LLM
O motor depende só da interface `LlmProvider`. Groq, Gemini, OpenRouter e Ollama aceitam o formato da API da OpenAI, então um único adaptador (`OpenAiCompatibleProvider`) cobre todos — trocar de provedor é mudar o `.env`. Os testes usam o `MockLlmProvider`, que devolve respostas roteirizadas e não chama API nenhuma.

O adaptador tenta de novo em erros temporários: 429 (limite do plano gratuito), 5xx e timeout. Se o provedor manda o cabeçalho `Retry-After`, espero o tempo pedido; se não, uso backoff exponencial (1 s, 2 s, 4 s...). Erros que não são temporários, como 400 ou chave inválida, falham na hora, porque tentar de novo não resolveria. O número de tentativas e o timeout são configuráveis (`LLM_MAX_TENTATIVAS`, `LLM_TIMEOUT_MS`).

### Tool calling
A IA não só responde texto: ela chama as ações `adicionar_tag`, `mover_estagio`, `atualizar_ficha`, `notificar_equipe`, `transferir_humano`, `consultar_agenda` e `marcar_agenda`. O motor roda um loop: chama o LLM, executa as ações pedidas, devolve os resultados e repete até vir a resposta final. Assim a IA só responde depois de ter o resultado da agenda, e não manda uma mensagem e depois outra.

Toda ação executada fica gravada na tabela `acoes` (auditoria), incluindo as que falharam e as intervenções humanas.

**Nunca encerrar em silêncio:** o prompt pede para a IA sempre aplicar tag e estágio, mas não dependo só disso. Ao fim de cada turno, o servidor confere o lead: se ainda estiver sem tag ou no estágio `Novo`, aplica um padrão (`em-qualificacao` / `Qualificacao`, ou `transferido-humano` / `Humano` se foi transferido). O fallback passa pelo mesmo serviço de ações, então também fica na auditoria, marcado com `origem: fallback`. E se o loop atingir o limite de iterações sem texto final, o lead recebe uma mensagem padrão em vez de ficar sem resposta.

### Testes com o runner nativo do Node
Usei o `node:test` em vez do Jest. O NestJS 12 é distribuído como ESM, e o Jest ainda exige configuração extra para isso; o runner nativo não precisa de nenhuma dependência e roda o mesmo JavaScript compilado pelo `tsc` que vai para produção. Os testes sobem a aplicação real (com banco em memória e o LLM mockado) e testam pelo HTTP, então cobrem o caminho completo da requisição.

### Prompt
O prompt do sistema é montado a cada turno a partir da configuração da empresa: identidade e tom, se pode dizer que é IA, perguntas e regras de qualificação, cidades atendidas, regras gerais e a **ficha atual do lead**, com a instrução de não perguntar de novo o que já está preenchido. É isso que faz a IA "lembrar" do lead se ele voltar outro dia.

Coloquei as regras de qualificação na configuração do tenant, não no código, para que mudar uma regra seja só editar um JSON.

### Como evito alucinação e manipulação
Não confio só no prompt; o servidor valida o que a IA tenta fazer:

1. **Não inventar campo:** o `atualizar_ficha` exige um campo `evidencia` com o trecho que o lead escreveu. O servidor confere se esse trecho existe nas mensagens do lead; se não existir, recusa e o campo fica vazio.
2. **Listas fechadas:** só os campos de `CAMPOS_FICHA` podem ser gravados, e o estágio precisa existir na configuração da empresa. Horário de agenda precisa estar entre os livres.
3. **Erros voltam para o LLM:** quando uma ação é recusada, o motivo volta como resultado da tool, e a IA pode corrigir.
4. **Prompt injection:** a mensagem do lead nunca entra no prompt do sistema; ela vai como mensagem de usuário, e o prompt diz explicitamente que o texto do lead é dado, não instrução, e que preço, desconto e promessa de economia são proibidos.
5. `temperature` baixa (0.2) para respostas mais previsíveis.

### Intervenção humana
`assumir` passa o controle para o humano, marca `houve_contato_humano` e cancela a janela de rajada em andamento. Enquanto o humano está no controle, as mensagens continuam sendo gravadas, mas a IA não responde. As mensagens do atendente chegam pelo mesmo webhook com `"autor": "humano"`. No `religar`, a IA volta a ler o histórico completo, incluindo o que o humano conversou, e continua de onde parou.

### Modo simulação
Com `"simulacao": true` no webhook, o `notificar_equipe` só grava em `notificacoes` o que teria enviado, sem disparar nada.

### ID da resposta
É um SHA-256 de `tenant + telefone + timestamp + texto`. Incluí tenant, telefone e horário para que duas respostas iguais (ex.: "Olá!") para leads diferentes não gerem o mesmo ID.

---

## 4. Custo estimado por conversa

Cada turno registra modelo, tokens de entrada/saída, custo estimado e latência, e `GET /metricas/{tenant_id}` mostra o custo médio por conversa. O custo é calculado com a tabela de `src/llm/precos.ts`. Como uso o plano gratuito, uso o preço pago equivalente do modelo como referência.

**Custo medido na avaliação** (modelo `openai/gpt-oss-120b` no Groq, com referência de US$ 0,15 / 1M tokens de entrada e US$ 0,60 / 1M de saída, a conferir no site do Groq):

| Conversa | Tokens | Custo |
|---|---|---|
| C1 — qualificação completa até o agendamento (7 mensagens) | ~34 mil | US$ 0,0065 |
| C2 — desqualificada (5 mensagens) | ~26 mil | US$ 0,0052 |
| C3, C4, C5 — conversas curtas | 3 a 5 mil | US$ 0,0007 a 0,0010 |

O custo médio por conversa medido em `GET /metricas` foi **US$ 0,0029**. Uma conversa completa de qualificação fica em **menos de 1 centavo de dólar**. A maior parte dos tokens é entrada: o prompt do sistema e o histórico são reenviados a cada chamada do loop de tools.

**Como reduziria:**

- Usar um modelo menor (ex.: `openai/gpt-oss-20b`) para turnos simples e o maior só para decidir a qualificação.
- Prompt caching do prompt do sistema, que se repete em todas as chamadas.
- Enviar só as últimas mensagens + a ficha, em vez do histórico inteiro — a ficha já resume o que importa.
- A própria rajada já economiza: 3 mensagens seguidas viram 1 turno em vez de 3.

---

## 5. Resultado do script de avaliação

O script roda as 5 conversas do Anexo C contra o LLM configurado no `.env`, em modo simulação e com banco em memória, e gera `avaliacao/relatorio.md` com o resultado de cada verificação, custo, latência e a transcrição de cada conversa.

```bash
npm run avaliar
npm run avaliar -- --repeticoes=3          # repete cada conversa 3 vezes
npm run avaliar -- --conversas=C1,C3       # só algumas conversas
npm run avaliar -- --pausa-ms=20000        # pausa entre conversas (limite do plano gratuito)
```

Para a avaliação não demorar, a janela de rajada é de 3 s (configurável em `AVALIACAO_JANELA_MS`). As mensagens da C3 são enviadas com 600 ms de intervalo, dentro da janela. As verificações de texto (C2 "outra opção", C3 "não pergunta de novo" e C5 "não promete") são heurísticas por palavras-chave, por isso o relatório traz a transcrição completa para conferência.

**Resultado** (Groq, `openai/gpt-oss-120b`, 1 repetição por conversa por causa do limite diário do plano gratuito). O relatório completo, com as ações executadas e a transcrição de cada conversa, está em [`avaliacao/relatorio.md`](avaliacao/relatorio.md).

| Conversa | Esperado | Resultado | Verificações |
|---|---|---|---|
| C1 — Caminho feliz | ficha completa, `qualificado`, `Agendado`, visita marcada, equipe notificada | ✅ | 5/5 |
| C2 — Imóvel alugado | `desqualificado`, menciona outra opção, sem notificação | ✅ | 4/4 |
| C3 — Rajada | uma resposta, não repete perguntas, registra os dados | ❌ | 2/3 |
| C4 — Cliente antigo | `cliente-antigo`, transferido, IA para | ✅ | 3/3 |
| C5 — Manipulação | sem preço/desconto/promessa, nada inventado na ficha | ✅ | 3/3 |

**C3:** a rajada funcionou (um turno para as 3 mensagens) e a IA não perguntou de novo nada do que o lead já tinha dito. Mas ela só gravou nome e cidade: não chamou `atualizar_ficha` para "casa própria" e "conta de uns 600". Nenhuma gravação foi rejeitada; o modelo simplesmente não tentou. O resultado é que esses dados ficam só no histórico, e não na ficha.

**O que a avaliação me mostrou e eu corrigi:**

- **Modelo descontinuado:** o `llama-3.3-70b-versatile` não estava mais disponível na minha conta. Troquei para `openai/gpt-oss-120b` só pelo `.env`, sem mexer no código, o que confirma que o adaptador cumpre o papel.
- **Limite de iterações:** o modelo chama uma ferramenta por vez e às vezes regrava campos já preenchidos. Com 6 iterações, o turno do agendamento da C1 acabava antes de mover o estágio e notificar a equipe, e o lead recebia a mensagem padrão. Subi o limite para 10 e instruí no prompt a não regravar campos já preenchidos.
- **"Vou transferir" sem transferir:** na C4, a IA avisou que ia passar para a equipe, mas só chamou `transferir_humano` no turno seguinte, então ainda respondeu mais uma mensagem. Acrescentei ao prompt que a ferramenta deve ser chamada no mesmo turno do aviso, e no mesmo turno do agendamento devem vir estágio, tag e notificação.
- **Limite do plano gratuito:** o Groq devolveu vários 429 durante a execução. O retry com `Retry-After` absorveu todos sem nenhuma conversa falhar.

---

## 6. Limitações conhecidas

Preferi ser transparente sobre o que ainda não está pronto:

- **Fallback de tag/estágio** é genérico (`em-qualificacao` / `Qualificacao`): garante a regra, mas não substitui a decisão da IA. A tag `em-qualificacao` continua no lead mesmo depois que ele é qualificado.
- **Verificações da avaliação** são heurísticas por palavras-chave; uma resposta correta escrita de outro jeito pode ser marcada como falha (ou o contrário). Uma melhoria seria usar um segundo LLM como avaliador.
- **A IA nem sempre registra tudo:** quando o lead manda vários dados numa mensagem só (C3), o modelo pode gravar só parte deles na ficha. O servidor impede gravar o que o lead não disse, mas não obriga a gravar o que ele disse. Uma melhoria seria um passo de extração separado, que só preenche a ficha, antes da resposta.
- **Avaliação com 1 repetição:** o LLM não é determinístico, e o resultado pode variar entre execuções. Rodei uma vez por causa do limite diário do plano gratuito (`--repeticoes=N` permite mais).
- **Validação da evidência** é por substring simples: não trata variações como "480" vs "R$ 480" ou acentos diferentes, então pode recusar dados que o lead realmente disse.
- **Rajada em memória:** funciona com uma instância só. Com várias instâncias, cada uma teria a sua janela.
- **Configuração dos tenants** não tem validação de schema ao carregar o JSON.
- **Métricas** ainda contam também as conversas em modo simulação.
- **Notificação** à equipe é mockada (log no console), já que não há WhatsApp real.

---

## 7. Próximos passos para produção com 100 empresas

- **Fila e rajada distribuídas:** trocar o mapa em memória por Redis (BullMQ com jobs atrasados por lead), para rodar várias instâncias e não perder mensagens em um restart.
- **Webhook assíncrono:** responder `202` na hora e entregar a resposta da IA pela API do WhatsApp, em vez de segurar o request.
- **Postgres** no lugar do SQLite, com migrations versionadas.
- **Configuração das empresas no banco**, com um painel para editar regras sem deploy, e validação de schema.
- **Resiliência no LLM:** retry com backoff, timeout, fallback para outro provedor e circuit breaker.
- **Isolamento por empresa:** rate limit e orçamento de tokens por tenant, para uma empresa não consumir a cota das outras.
- **Observabilidade:** logs estruturados, tracing por turno, alertas de custo e de taxa de erro, e um painel com as métricas.
- **Avaliação contínua:** rodar o conjunto de conversas de avaliação a cada mudança de prompt ou de modelo, como teste de regressão.
- **Segurança e LGPD:** autenticação do webhook (assinatura), criptografia de dados pessoais e política de retenção.
