# FREELA

Aplicativo em desenvolvimento para conectar clientes a profissionais de serviços locais. A ideia é permitir que clientes encontrem profissionais por categoria e localização, solicitem orçamentos e avaliem serviços concluídos. Profissionais, por sua vez, acompanham pedidos recebidos e atualizam o status dos orçamentos.

> Status: WIP. O projeto ainda não está pronto para produção. Há telas funcionais, integração inicial com Supabase e fluxo de cadastro/login em evolução, mas ainda existem partes temporárias e regras de negócio a validar.

## O que já existe

- Tela inicial com escolha entre cliente e profissional.
- Cadastro em etapas com:
  - tipo de perfil;
  - localização;
  - serviços de interesse/oferecidos;
  - contato, e-mail e senha;
  - checklist visual de senha segura.
- Login com Supabase Auth.
- Catálogo de serviços vindo do banco.
- Solicitação de orçamento salva no Supabase.
- Painel do profissional com orçamentos do banco.
- Lista de serviços concluídos e avaliação apenas para itens em `completed_jobs`.
- Layout responsivo para web/mobile via Expo e React Native.

## Ainda falta

- Refinar políticas do Supabase para regras reais de cliente/profissional.
- Melhorar fluxo de confirmação de e-mail em desenvolvimento.
- Criar tela completa de criação/edição de serviços para profissionais.
- Relacionar orçamentos ao profissional correto.
- Remover telas antigas ou experimentais que não fazem parte do fluxo final.
- Adicionar testes automatizados.
- Revisar acessibilidade, estados vazios e mensagens de erro.
- Preparar build/deploy.

## Stack

- Expo 57
- React 19
- React Native 0.86
- Expo Router
- TypeScript
- Supabase Auth + Database
- React Native Reanimated
- Expo Blur / Glass effects

## Como rodar localmente

Pré-requisitos:

- Node.js instalado
- npm instalado
- projeto Supabase criado

Instale as dependências:

```bash
npm install
```

Rode o app:

```bash
npm run web
```

Ou, se quiser escolher a plataforma pelo Expo:

```bash
npm start
```

Durante o desenvolvimento web, o app costuma abrir em:

```text
http://localhost:8081
```

## Configuração do Supabase

O cliente Supabase fica em:

```text
src/lib/supabase.ts
```

Para desenvolvimento, o projeto atualmente possui valores fallback no código. O ideal é configurar variáveis de ambiente:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Depois, rode o schema no SQL Editor do Supabase:

```text
supabase/schema.sql
```

Esse schema cria:

- `profiles`
- `services`
- `budgets`
- `completed_jobs`
- políticas RLS iniciais
- trigger para criar perfil automaticamente a partir do Supabase Auth
- dados iniciais de serviços

### Observação sobre cadastro por e-mail

Em desenvolvimento, o Supabase pode bloquear novos cadastros por limite de envio de e-mails (`email rate limit exceeded`). Isso acontece antes de criar o usuário em `Authentication > Users`.

Para continuar testando, existem duas opções:

- aguardar o limite temporário liberar;
- desativar temporariamente a confirmação por e-mail em `Authentication > Sign In / Providers > Email`.

## Scripts úteis

```bash
npm start
```

Inicia o Expo.

```bash
npm run web
```

Inicia o app no navegador.

```bash
npm run android
```

Inicia o app no Android.

```bash
npm run ios
```

Inicia o app no iOS.

```bash
npx tsc --noEmit
```

Valida TypeScript sem gerar build.

## Estrutura principal

```text
src/
  app/                 Rotas do Expo Router
  components/          Componentes reutilizáveis
  context/             Estado de sessão/autenticação
  data/                Integrações, catálogos e dados auxiliares
  lib/                 Clientes externos, como Supabase
  navigation/          Roteamento por perfil
  screens/             Telas principais do app
  types/               Tipos compartilhados
  utils/               Funções utilitárias

supabase/
  schema.sql           Estrutura inicial do banco
```

## Fluxo atual

1. Usuário escolhe se é cliente ou profissional.
2. Usuário faz login ou abre o cadastro.
3. Cadastro coleta perfil, localização, serviços e credenciais.
4. Supabase Auth cria o usuário.
5. Perfil é salvo em `profiles`.
6. Cliente vê serviços do banco e pode solicitar orçamento.
7. Profissional vê orçamentos salvos no banco.

## Notas de desenvolvimento

- O projeto é WIP e pode ter mudanças grandes de estrutura.
- Algumas telas herdadas do template/experimentos ainda podem existir.
- O app prioriza web durante o desenvolvimento, mas a base é Expo/React Native.
- Se uma tela parecer travada por erro de fonte no Expo Web, recarregue a página. Há tratamento no `_layout`, mas o overlay do Expo pode manter estado antigo até reload.

## Licença

Veja o arquivo `LICENSE`.
