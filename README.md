# Hubday — Desafio Técnico de Engenharia

> Aplicação multi-tenant de agendamento de serviços, com disponibilidade autoritativa no backend e garantia criptográfica/relacional contra concorrência e vazamento entre empresas no PostgreSQL.

---

## Sumário

- [Visão Geral e Arquitetura](#visão-geral-e-arquitetura)
- [Instruções para Execução Local (Subir do Zero)](#instruções-para-execução-local-subir-do-zero)
- [Modelagem e Regras de Integridade](#modelagem-e-regras-de-integridade)
- [Concorrência e Proteção contra Double Booking](#concorrência-e-proteção-contra-double-booking)
- [Multi-tenancy e Segurança](#multi-tenancy-e-segurança)
- [Documentação Técnica da API](#documentação-técnica-da-api)
- [Gerenciamento de Dados (Criar, Resetar, Migrations e Seed)](#gerenciamento-de-dados-criar-resetar-migrations-e-seed)
- [Testes Automatizados (Unitários, Integração e E2E)](#testes-automatizados-unitários-integração-e-e2e)
- [Ambiente e Execução 100% Local](#ambiente-e-execução-100-local)
- [Cenários de Avaliação do Desafio](#cenários-de-avaliação-do-desafio)
- [Trade-offs e Próximos Passos](#trade-offs-e-próximos-passos)
- [Uso de IA](#uso-de-ia)

---

## Visão Geral e Arquitetura

O projeto resolve o problema central de agendamento em um contexto SaaS multi-tenant: permitir que clientes agendem serviços com profissionais em horários de fato livres, reagendem ou cancelem, com isolamento absoluto entre empresas e sem risco de *double booking*.

### Organização do Monorepo

```
hubday/
├── apps/
│   ├── api/          # Backend NestJS 11 + Fastify + Drizzle ORM + PostgreSQL
│   └── web/          # Frontend React 18 + Vite + TanStack Query + Tailwind CSS + Material UI
├── packages/
│   └── contracts/    # Tipos e esquemas Zod compartilhados (Single Source of Truth)
├── docs/             # ADRs arquiteturais (DECISIONS.md) e estado da entrega (STATE.md)
└── docker-compose.yml# Serviços de banco principal (5432) e teste com tmpfs (5433)
```

### Camadas e Boundaries

```
┌────────────────────────────────────────────────────────┐
│               apps/web (React 18 + Vite)               │
│      TanStack Query · Material UI + Tailwind CSS       │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP (REST + JSON / Bearer JWT)
                           ▼
┌────────────────────────────────────────────────────────┐
│             apps/api (NestJS 11 + Fastify)             │
│   ClsMiddleware (TenantContext via AsyncLocalStorage)  │
│   JwtAuthGuard ──► ZodValidationPipe ──► Services      │
│   AllExceptionsFilter (Formato padronizado de erro)    │
└──────────────────────────┬─────────────────────────────┘
                           │ Drizzle ORM / SQL Puro
                           ▼
┌────────────────────────────────────────────────────────┐
│             PostgreSQL 16 (docker-compose)             │
│      GiST Exclusion Constraint (btree_gist)            │
│      Composite Foreign Keys (id, company_id)           │
└────────────────────────────────────────────────────────┘
```

- **packages/contracts**: Define o contrato estrito (`@hubday/contracts`) de requisições, respostas e erros em Zod com `.strict()` para impedir campos arbitrários (*mass-assignment*).
- **Boundary de autoridade**: O cliente web é puramente declarativo; ele nunca calcula regras de negócio ou disponibilidade. A disponibilidade é sempre derivada dinamicamente pelo backend através do endpoint `GET /availability` e revalidada no ato da persistência.
- **Ciclo de vida da requisição**:
  1. `ClsMiddleware` inicializa o contexto assíncrono via `AsyncLocalStorage`.
  2. `JwtAuthGuard` valida o token Bearer e preenche o contexto seguro `{ userId, companyId, role }`.
  3. `ZodValidationPipe` assegura conformidade de tipos e regras estruturais em runtime.
  4. Services operam queries no Drizzle estritamente filtradas por `companyId`.
  5. `AllExceptionsFilter` intercepta qualquer erro (de domínio, validação ou SQLSTATE do PostgreSQL) e entrega respostas previsíveis e higienizadas com `requestId`.

---

## Instruções para Execução Local (Subir do Zero)

### Pré-requisitos
- **Node.js** >= 20.11 (testado no v20 e v24)
- **pnpm** >= 10 (`corepack enable` ou `npm i -g pnpm`)
- **Docker** e **Docker Compose**

### Opção 1: Subir Tudo com 1 Único Comando (Docker — Recomendado para Avaliação)

Se você tem Docker e Docker Compose instalados, pode subir a aplicação inteira (Banco, API, Migrations, Seed e Frontend) com apenas **um único comando**, sem precisar configurar Node ou pnpm na sua máquina:

```bash
docker compose up --build
```
*(ou se preferir rodar em segundo plano: `docker compose up --build -d` ou `pnpm up`)*

> 🚀 **O que acontece automaticamente:**
> 1. O PostgreSQL sobe e aguarda o healthcheck ficar pronto.
> 2. O contêiner da **API** roda as migrations versionadas e aplica o seed das duas empresas fictícias automaticamente.
> 3. A **API NestJS** inicia em `http://localhost:3000`.
> 4. O contêiner **Web** compila a SPA React e a serve via Nginx de produção em `http://localhost:5173`.
> 5. Para parar tudo: `docker compose down` (ou `pnpm down`).

---

### Opção 2: Desenvolvimento Local com Hot-reload (Node.js + pnpm)

Se preferir rodar os processos na sua máquina com hot-reload ativo:

```bash
# 1. Copiar variáveis de ambiente de exemplo
cp .env.example .env

# 2. Instalar as dependências do monorepo
pnpm install

# 3. Subir apenas os contêineres do banco (PostgreSQL 5432 e banco de teste 5433)
pnpm db:up

# 4. Executar as migrations versionadas no banco principal
pnpm migrate

# 5. Popular o banco com o seed idempotente (contendo 2 empresas fictícias)
pnpm seed

# 6. Iniciar a API e a Aplicação Web em paralelo
pnpm dev
```

Após iniciar:
- **Web App**: [http://localhost:5173](http://localhost:5173)
- **API**: [http://localhost:3000](http://localhost:3000)
- **Swagger UI**: [http://localhost:3000/docs](http://localhost:3000/docs) (OpenAPI JSON em `/docs-json`)

### Usuários e Empresas Disponíveis no Seed

Senha para todos os usuários cadastrados: `hubday-dev` *(fictícia para desenvolvimento)*.

| Empresa | Fuso Horário | Usuários Cadastrados | Perfil |
|---|---|---|---|
| **Aurora Estudio** | `America/Sao_Paulo` | `owner@aurora.test` | Administrador / Owner |
| | | `staff@aurora.test` | Equipe / Staff |
| **Northwind Clinic** | `America/New_York` | `owner@northwind.test` | Administrador / Owner |
| | | `staff@northwind.test` | Equipe / Staff |

---

## Modelagem e Regras de Integridade

O banco modela as seguintes entidades principais: `companies`, `users`, `professionals`, `services`, `customers`, `availability_rules` e `appointments`.

### Onde cada regra de integridade foi aplicada

1. **Chaves Estrangeiras Compostas (Composite Foreign Keys)**:
   - Todas as tabelas que pertencem a uma empresa expõem `UNIQUE (id, company_id)`.
   - As tabelas filhas (como `appointments` e `availability_rules`) referenciam seus pais com chaves compostas `FOREIGN KEY (professional_id, company_id) REFERENCES professionals(id, company_id)`.
   - **Garantia**: Torna matematicamente impossível referenciar o profissional de uma empresa com o serviço ou cliente de outra empresa no próprio nível físico do banco.
2. **Restrições de Verificação (CHECK Constraints)**:
   - `appointments_time_order_check`: Garante que `starts_at < ends_at`.
   - `availability_rules_minute_order_check`: Garante que `start_minute < end_minute`.
   - `availability_rules_weekday_check`: Garante que o dia da semana esteja entre 0 (domingo) e 6 (sábado).
   - `services_duration_minutes_check`: Garante que `duration_minutes > 0`.
   - `users_role_check`: Garante papéis válidos (`owner`, `staff`, `viewer`).
3. **Fusos Horários e Instantes**:
   - Todos os instantes no banco são armazenados como `timestamp with time zone` (UTC).
   - A empresa define seu fuso IANA (ex: `America/Sao_Paulo`), utilizado pelo motor de slots para interpretar as janelas de expediente diárias dos profissionais.
4. **Status do Agendamento**:
   - Enum `appointment_status`: `'scheduled'`, `'cancelled'`, `'completed'`. Apenas `'scheduled'` é considerado ativo para bloqueio de agenda.

---

## Concorrência e Proteção contra Double Booking

A autoridade final contra conflitos de horário reside na base de dados, utilizando uma restrição de exclusão GiST (*Exclusion Constraint*) suportada pela extensão `btree_gist`:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
EXCLUDE USING gist (
  company_id WITH =,
  professional_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&
) WHERE (status = 'scheduled');
```

### O que acontece quando duas requisições disputam o mesmo horário?

1. As duas requisições chegam quase simultaneamente e passam pela checagem de expediente em memória (ambas estão no horário comercial do profissional).
2. Cada requisição abre uma transação atômica no PostgreSQL e tenta inserir o registro de agendamento.
3. O índice GiST avalia o operador de sobreposição temporal `&&` para o mesmo `company_id` e `professional_id`.
4. A primeira requisição a comitar tem seu registro salvo com sucesso (**HTTP 201 Created**).
5. A segunda transação é rejeitada pelo PostgreSQL com o erro de violação de exclusão **SQLSTATE 23P01**.
6. A API intercepta o erro `23P01` e o converte determinística e imediatamente para **HTTP 409 Conflict** (`APPOINTMENT_CONFLICT`), informando ao cliente que o horário acabou de ser preenchido.
7. O número de agendamentos válidos no banco permanece rigorosamente em 1.

### Vantagens dessa abordagem:
- **Intervalo Semiaberto `[)`**: Um agendamento que termina às 10:00 e outro que se inicia às 10:00 não geram falso conflito (`10:00` não sobrepõe `[09:30, 10:00)`).
- **Cancelamento e Reagendamento Limpos**: Graças à cláusula parcial `WHERE (status = 'scheduled')`, quando um agendamento é cancelado, a restrição de exclusão é imediatamente aliviada para aquele intervalo, tornando o horário livre novamente no mesmo instante.

---

## Multi-tenancy e Segurança

1. **Autoridade do Contexto de Empresa**:
   - O `companyId` é lido **exclusivamente a partir do token JWT verificado**, injetado na requisição pelo `JwtAuthGuard` dentro de uma instância segura de `TenantContext` (`nestjs-cls`).
   - Nenhum valor de `company_id` vindo via `body`, `query`, `headers` ou rota tem permissão para substituir o contexto autenticado.
2. **Prevenção de Acesso Cruzado e Enumeração**:
   - Todas as queries do Drizzle incluem cláusulas `eq(table.companyId, tenant.companyId)`.
   - Se um usuário autenticado da empresa A tentar ler, reagendar ou cancelar um agendamento da empresa B passando seu ID pela URL, a query não localiza o registro no escopo do tenant e retorna **HTTP 404 Not Found** (e não 403), impedindo que invasores descubram se um determinado ID existe ou não em outra empresa.
3. **CORS e Higienização**:
   - CORS restrito a origens explicitamente configuradas em `WEB_ORIGIN`, com métodos liberados `GET, HEAD, POST, PATCH`.
   - O filtro global de exceções mascara qualquer detalhe de banco ou stack trace em respostas de erro 500.

---

## Documentação Técnica da API

A documentação interativa Swagger está disponível em `http://localhost:3000/docs` (ou em formato bruto OpenAPI em `/docs-json`).

### Principais Endpoints

| Método | Endpoint | Autenticação | Descrição |
|---|---|---|---|
| `POST` | `/auth/login` | Pública | Autentica usuário e retorna JWT com `{ userId, companyId, role }` |
| `GET` | `/health` | Pública | Healthcheck da aplicação e verificação de conexão com o PostgreSQL |
| `GET` | `/professionals` | Bearer JWT | Lista profissionais pertencentes à empresa autenticada |
| `GET` | `/services` | Bearer JWT | Lista serviços e suas durações em minutos |
| `GET` | `/customers` | Bearer JWT | Lista clientes cadastrados na empresa |
| `GET` | `/availability` | Bearer JWT | Consulta slots disponíveis por profissional, serviço e data (`YYYY-MM-DD`) |
| `GET` | `/appointments` | Bearer JWT | Lista agendamentos com filtros opcionais por status e datas |
| `POST` | `/appointments` | Bearer JWT | Cria um agendamento (autoritativo, com proteção de concorrência) |
| `GET` | `/appointments/:id` | Bearer JWT | Busca detalhes de um agendamento |
| `PATCH` | `/appointments/:id` | Bearer JWT | Reagenda um agendamento ativo para um novo horário |
| `POST` | `/appointments/:id/cancel` | Bearer JWT | Cancela um agendamento e libera o horário no calendário |

### Formato Padronizado de Erro

Todas as respostas de erro seguem o contrato estrito:

```json
{
  "code": "APPOINTMENT_CONFLICT",
  "message": "That time slot is no longer available",
  "statusCode": 409,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "details": [
    { "path": "startsAt", "message": "Conflito de horário detectado" }
  ]
}
```

O `requestId` é retornado tanto no corpo da resposta quanto no header HTTP `x-request-id` para fins de correlação e observabilidade.

---

## Gerenciamento de Dados (Criar, Resetar, Migrations e Seed)

O projeto separa o banco de aplicação (porta 5432) do banco de testes (porta 5433).

### Comandos de Dados

| Comando | Descrição |
|---|---|
| `pnpm db:up` | Inicia os contêineres PostgreSQL (`hubday_db` na 5432 e `hubday_db_test` na 5433) |
| `pnpm db:down` | Encerra os contêineres do banco |
| `pnpm migrate` | Aplica as migrations versionadas em `apps/api/drizzle/` no banco principal |
| `pnpm seed` | Executa o seed idempotente com duas empresas completas |

### Como Resetar o Banco do Zero

Se precisar limpar completamente os dados e recriar o ambiente:

```bash
# Opção A: Reset rápido via Seed (Truncate em cascata e recarga)
pnpm seed

# Opção B: Reset total com destruição de volumes Docker
docker compose down -v
pnpm db:up
# Aguarde 3 segundos para o postgres inicializar
pnpm migrate
pnpm seed
```

---

## Testes Automatizados (Unitários, Integração e E2E)

### Comandos de Teste

| Comando | O que executa |
|---|---|
| `pnpm typecheck` | Checagem de tipos estática em todos os pacotes (`contracts`, `api`, `web`) |
| `pnpm test` | **38 testes** unitários e de integração no Vitest utilizando o banco isolado (porta 5433 com tmpfs) |
| `pnpm test:e2e` | **10 testes E2E** no Playwright com navegador Chromium real (fluxos completos de agendamento e responsividade) |
| `pnpm build` | Compilação de produção de todos os pacotes |

### Suíte Vitest (38 testes aprovados)
- **Isolamento de tenant**: Validação de consultas, tentativas de cruzamento de IDs e verificação de 404.
- **Concorrência**: Disparos simultâneos disputando a mesma vaga -> 1 vitória (201), 1 conflito (409).
- **Adjacência**: Agendamentos contíguos (`fim == início`) sem conflito.
- **Ciclo de vida**: Agendar, reagendar, conflito com rollback transacional e cancelamento liberando vaga.
- **Slot Engine**: Cálculo de janelas de regras, exclusão de horários passados e estabilidade em fusos/DST.

### Suíte E2E Playwright (10 testes aprovados)
- Executa fluxo real no navegador: Login -> Escolha de profissional e serviço -> Seleção de data no calendário -> Escolha de horário livre -> Agendamento -> Reagendamento para outro horário -> Cancelamento.
- Validação de layout e responsividade sem quebras nos viewports: `320×568` (mobile pequeno), `390×844` (iPhone), `1366×768` (desktop) e `844×390` (landscape).
- Validação de mensagens amigáveis em português para erros de validação e conflito.

---

## Ambiente e Execução 100% Local

- **Sem Dependências Externas**: Não há necessidade de credenciais de nuvem (AWS, GCP, Supabase remoto), serviços de autenticação externa (Auth0, Clerk) ou envio de e-mails/SMS reais.
- **Execução Confinada**: Toda a infraestrutura roda localmente através dos contêineres Docker definidos no `docker-compose.yml` e das portas locais 3000 (API), 5173 (Web), 5432 (PostgreSQL) e 5433 (PostgreSQL Testes).

---

## Cenários de Avaliação do Desafio

Mapeamento direto dos 5 cenários descritos na página 4 do documento:

| # | Cenário do Documento | Como o projeto atende e como testar |
|---|---|---|
| **01** | **Subir do zero** | Execute `cp .env.example .env`, `pnpm install`, `pnpm db:up`, `pnpm migrate`, `pnpm seed` e `pnpm dev`. O sistema estará 100% operacional. |
| **02** | **Isolamento** | O seed cria `Aurora Estudio` e `Northwind Clinic`. Acesse com `owner@aurora.test` e confirme que os agendamentos da Northwind não aparecem. O teste `tenant-isolation.test.ts` valida programmaticamente o bloqueio e o retorno 404. |
| **03** | **Concorrência** | Validado no teste `concurrency.test.ts` e na interface: duas requisições paralelas para o mesmo slot resultam em um agendamento e um erro 409 amigável no frontend sem duplicação no banco. |
| **04** | **Ciclo do agendamento** | No app web ou no teste `lifecycle.test.ts`: ao criar um agendamento, o horário sai da lista de disponibilidade; ao cancelar, o horário retorna imediatamente para a lista de vagas. |
| **05** | **Falhas previsíveis** | Envio de body incompleto ou com campos desconhecidos resulta em 400 estruturado; agendamento no passado ou fora de horário resulta em 422; conflito resulta em 409. O frontend exibe mensagens claras em português. |

---

## Trade-offs e Próximos Passos

Decisões de escopo adotadas visando manter a solução pequena, robusta e focada nas invariantes centrais:

1. **Reagendamento in-place com transação**: O reagendamento atualiza a linha existente dentro de uma transação com rollback se houver conflito. Em um cenário empresarial expandido, adotaria-se uma tabela de auditoria/histórico de alterações (`appointment_revisions` ou CDC).
2. **Tokens JWT dev-only**: Em produção, utilizaria-se rotação de refresh tokens e expiração curta com chaves assimétricas RS256/EdDSA.
3. **Notificações Assíncronas**: Notificações por e-mail/WhatsApp foram deixadas fora do caminho síncrono da requisição para não atrasar o tempo de resposta HTTP. Como próximo passo, um worker com BullMQ / Redis consumiria eventos de agendamento criado/cancelado.
4. **Lista de Espera**: A modelagem suporta extensão natural com uma tabela `waiting_lists` indexada por `(company_id, professional_id, date)`. Ao ocorrer um cancelamento, um hook poderia notificar o primeiro cliente da fila.

---

## Uso de IA

O desenvolvimento deste desafio utilizou assistência de Inteligência Artificial para:
- Apoio no design de testes de concorrência com requisições assíncronas paralelas.
- Scaffolding inicial de schemas Drizzle a partir das invariantes de banco estabelecidas.
- Sugestão de testes de responsividade em múltiplos viewports para o Playwright.

**Critérios de validação humana e controle técnico**:
- Todas as decisões arquiteturais (como o uso de `btree_gist` e restrições de exclusão no banco de dados, chaves compostas e `nestjs-cls`) foram dirigidas pelas diretrizes do desafio e registradas em `docs/DECISIONS.md`.
- Toda geração de código foi estritamente auditada por gates automatizados (`pnpm typecheck`, `pnpm test` e `pnpm test:e2e`).
