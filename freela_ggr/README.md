# Freela

Aplicativo em React Native para conectar clientes a profissionais de serviços locais. Clientes encontram serviços por categoria e região, enviam pedidos e avaliam trabalhos concluídos. Profissionais acompanham pedidos, criam orçamentos e compartilham os valores com seus clientes.

**Status:** em desenvolvimento. Os fluxos abaixo estão implementados no código, mas as migrações e a integração de cobrança precisam ser configuradas no ambiente remoto antes da publicação. Nenhuma compra real foi feita nos testes locais.

## Funcionalidades

- Login com Supabase Auth, confirmação de e-mail e escolha de perfil.
- Cadastro em quatro etapas: perfil, localização, serviços e dados de acesso.
- Catálogo com pesquisa, sugestão de busca, categorias e localização por CEP/estado/cidade/bairro.
- Pedidos de clientes com detalhes salvos no banco e disponíveis para o profissional.
- Painel profissional com histórico, pedidos recebidos e atualização de status.
- Criação de orçamento com cliente, descrição, valor e WhatsApp opcional.
- Rascunho de orçamento salvo no aparelho, separado por conta.
- Compartilhamento do orçamento em texto pela interface nativa do aparelho.
- Avaliação de serviços concluídos.
- Página de conta e página Freela+.

A interface usa verde nas ações, roxo na identidade, superfícies claras e tipografia Rubik. Os componentes compartilhados ficam em src/ui.

## Planos

| Recurso | Grátis | Freela+ |
| --- | --- | --- |
| Orçamentos criados pelo profissional | 5 por mês | Ilimitados |
| Histórico e compartilhamento | Sim | Sim |
| Mensalidade prevista no Brasil | R$ 0 | R$ 14,99 |

A franquia grátis renova no primeiro dia de cada mês, no fuso de Brasília (America/Sao_Paulo). Não acumula. Pedidos enviados por clientes não consomem a franquia do profissional.

O limite é validado no banco, com contador por conta e mês. Envios repetidos do mesmo orçamento usam um identificador para evitar registros e consumo duplicados. O histórico continua disponível após o fim da assinatura.

O preço mostrado na oferta vem da loja; configure o produto mensal em R$ 14,99 no painel correspondente.

## RevenueCat

A integração usa react-native-purchases e react-native-purchases-ui:

- O entitlement configurado é **freela**.
- O SDK identifica a conta pelo UUID do Supabase.
- O botão de assinatura apresenta o paywall da Offering atual.
- Compra e restauração consultam o entitlement e pedem confirmação ao servidor.
- O acesso ilimitado depende do estado verificado no banco, não apenas da resposta do aparelho.
- A chave Test Store recebida foi configurada em .env.local para iOS e Android. Esse arquivo não é versionado.
- Chaves test_ são usadas somente em builds de desenvolvimento; não ativam cobrança real.
- Logs detalhados ficam restritos ao desenvolvimento.
- A web permite consultar o plano; o fluxo de compra foi implementado para Android/iOS.

**Ainda é necessário:** configurar/publicar o paywall e a oferta no painel, aplicar a migração, publicar a Edge Function e configurar os segredos/webhook. Para testar a liberação do plano com Test Store, habilite o sandbox no Supabase de homologação.

Siga o [guia de configuração do RevenueCat](REVENUECAT_SETUP.md). Ele separa teste, publicação nas lojas e verificação no servidor.

## Stack

- Expo 57, React 19 e React Native 0.86.
- Expo Router e TypeScript.
- Supabase Auth, Postgres e Edge Functions.
- RevenueCat SDK e Paywalls.
- Rubik, Expo Vector Icons e componentes nativos.
- AsyncStorage para rascunhos e SecureStore para sessão nativa.
- Playwright para interface e PGlite para regras do banco em testes locais.

## Rodar localmente

Use Node.js 22 ou superior e npm. Copie .env.example para .env.local e preencha suas configurações. Não há fallback de credenciais no código.

    npm install
    npm run web

A web com a API local abre em **http://localhost:3000**. Esse comando gera a versão web e inicia o servidor que trata os cookies da sessão. A prévia isolada do Metro não substitui essa API.

Para desenvolvimento nativo:

    npm start

Para testar o paywall depois de adicionar o módulo nativo:

    npx eas-cli build --profile development --platform android
    npx expo start --dev-client

Instale o development build no aparelho. Para iOS, use o perfil correspondente e os identificadores da sua conta Apple. **Expo Go não realiza compras reais.** A exportação do pacote JavaScript não substitui a compilação e o teste no dispositivo.

## Ambiente

As variáveis estão descritas em [.env.example](.env.example).

| Variáveis | Onde são usadas |
| --- | --- |
| EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY | Cliente nativo; URL HTTPS e chave pública do Supabase |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e APP_ORIGIN | API web |
| EXPO_PUBLIC_TURNSTILE_SITE_KEY | Verificação de segurança |
| EXPO_PUBLIC_REVENUECAT_IOS_KEY e EXPO_PUBLIC_REVENUECAT_ANDROID_KEY | SDK das respectivas plataformas |
| EXPO_PUBLIC_TERMS_URL e EXPO_PUBLIC_PRIVACY_URL | Links legais HTTPS para publicação |
| REVENUECAT_SECRET_KEY e REVENUECAT_WEBHOOK_AUTH | Somente nos secrets da Edge Function |
| REVENUECAT_ALLOW_SANDBOX | true somente no servidor de homologação |

Segredos de servidor nunca devem usar o prefixo EXPO_PUBLIC_ nem entrar no Git.

## Banco de dados

Aplique os arquivos no SQL Editor do Supabase nesta ordem:

1. supabase/schema.sql
2. supabase/security-hardening.sql
3. supabase/rate-limits.sql
4. supabase/freela-plus.sql

Em um banco já configurado com os três primeiros arquivos, aplique apenas freela-plus.sql. Se reaplicar security-hardening.sql, aplique freela-plus.sql por último para restaurar as permissões da coluna de detalhes.

Principais tabelas:

| Tabela | Finalidade |
| --- | --- |
| profiles | Perfil e localização |
| services | Catálogo |
| budgets | Pedidos de clientes relacionados ao profissional |
| completed_jobs | Serviços concluídos e avaliações |
| professional_quotes | Orçamentos criados pelo profissional |
| freela_subscriptions | Estado da assinatura verificado pelo servidor |
| private.quote_usage | Contador mensal protegido |

A função revenuecat-sync confirma a identidade do usuário ou a autorização do webhook e consulta o RevenueCat antes de atualizar o plano. Sua publicação é uma etapa separada da atualização do app.

Veja também [limites de gravação](supabase/RATE_LIMITS.md) e [revisão de segurança](SECURITY_REVIEW.md).

## Validação

| Comando | O que verifica |
| --- | --- |
| npm run check:types | TypeScript |
| npm run test:security | API, sessão, RLS, validação e limites de gravação |
| npm run test:freela-plus | Franquia mensal, assinatura, expiração, identidade e resultados do paywall |
| npm run build:web | Exportação web e ajuste de scripts para a política de segurança |
| npm run test:ui | Login, navegação, rascunhos, criação, limite e telas estreitas |
| npm run security:secrets | Padrões de possíveis segredos em arquivos e histórico |

Execute build:web antes de test:ui. A configuração atual do Playwright usa Microsoft Edge instalado.

Os testes de interface usam API simulada e dados fictícios. Os testes de assinatura simulam RevenueCat. Eles não substituem compras sandbox e testes de teclado, restauração e compartilhamento em Android/iOS.

As capturas de revisão visual ficam em output/freela-redesign. O pacote JavaScript Android pode ser validado com:

    npx expo export --platform android --output-dir output/native-check

## Estrutura

    src/app/                      Rotas do Expo Router
    src/screens/                  Telas do aplicativo
    src/ui/                       Cores, tipografia e componentes compartilhados
    src/components/               Componentes de apoio
    src/context/                  Sessão e estado do plano
    src/data/                     Catálogo, pedidos, orçamentos e uso mensal
    src/lib/                      Supabase, API web e RevenueCat
    src/security/                 Validação de entrada
    api/gateway.ts                API web com sessão em cookies
    supabase/                     Schema, permissões e regras do banco
    supabase/functions/           Sincronização com RevenueCat
    scripts/                      Build e testes locais
    tests/                        Testes de interface

## Pendências de publicação

- Aplicar as migrações e publicar a função de sincronização no projeto remoto.
- Confirmar produto mensal, Offering atual e paywall publicado no RevenueCat.
- Configurar webhook, chaves de produção e links legais.
- Definir os identificadores definitivos do app nas lojas.
- Testar compra, restauração, cancelamento, expiração, pagamento pendente e troca de conta em aparelho.
- Implementar criação/edição de serviços para profissionais.
- Implementar PDF e upload de anexos, caso entrem no escopo; o fluxo atual compartilha texto.
- Remover componentes antigos sem uso e concluir a revisão de acessibilidade nativa.

## Comentários no código

Siga o padrão já usado no projeto: português, frases curtas, diretas e geralmente iniciadas em minúscula. Explique a regra ou o motivo da decisão, sem apenas repetir o que o código faz. Use // em TypeScript/JavaScript e -- em SQL.

## Alterações de 13/10/2026

- Revisão dos fluxos de envio, mensagens de erro, teclado, tema e preservação de formulários.
- Reformulação das telas em React Native.
- Implementação de criação, histórico, rascunho e compartilhamento de orçamentos.
- Implementação da franquia de cinco orçamentos mensais e da página Freela+ por R$ 14,99/mês.
- Integração do RevenueCat, chave Test Store local, entitlement freela e paywall nativo.
- Verificação da assinatura no servidor, isolamento por conta e proteção contra confirmações antigas.
- Adição de testes de interface, banco, assinatura e paywall.
- Atualização da documentação e padronização dos comentários adicionados.

## Licença

Veja [LICENSE](LICENSE).
