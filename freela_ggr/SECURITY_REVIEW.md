# Revisão de segurança — 28/09/2026

As mudanças estão no código local. **Nenhuma configuração do Supabase ou da Vercel foi alterada remotamente.** Os testes locais não comprovam que a produção já está protegida.

## O que foi feito e o que falta

| Item pedido | Resultado |
| --- | --- |
| Esconder API keys | Removidas as configurações fixas do código; `.env.local` preserva a execução local e é ignorado pelo Git. Variáveis `EXPO_PUBLIC_*` continuam visíveis no aplicativo por definição. |
| Limpar secrets do Git | Verificados 3.250 arquivos/blobs atuais e históricos com padrões de credenciais. Nenhum segredo reconhecido; não houve reescrita do histórico. Isso não substitui um scanner completo nem cobre branches remotos não disponíveis localmente. |
| Public key do DB | O app e a API usam somente `sb_publishable_*`, sem senha de banco ou `service_role`. A chave pública não dá acesso administrativo; a proteção depende das permissões e do RLS. |
| Ativar RLS | Já existia no SQL. `supabase/security-hardening.sql` substitui as policies das quatro tabelas e restringe acesso por usuário. Falta aplicar no projeto remoto. |
| Criptografar dados | Sessões nativas passaram do AsyncStorage para SecureStore/Keychain/Keystore. Tráfego do Supabase exige HTTPS. Criptografia de infraestrutura é oferecida pelo provedor, mas não foi auditada nesta conta. Os campos do banco não receberam criptografia de aplicação nem ponta a ponta. |
| Auth server side | Na web, `api/gateway.ts` autentica no Supabase, valida o usuário no servidor e executa consultas com o JWT dele, preservando o RLS. O navegador não recebe os tokens. No nativo, o Auth e o banco Supabase continuam sendo o servidor que valida as operações. |
| Restringir acessos | SQL com permissões mínimas, perfil próprio, orçamentos somente entre participantes e avaliações do próprio usuário. O catálogo de serviços continua público por intenção do produto. |
| Bloquear mass assignment | A API rejeita campos extras e monta os objetos permitidos. O SQL impede alterar tipo de conta, dono, nota pública, promoção e campos administrativos. O profissional só altera o status do orçamento; o cliente só altera a avaliação do serviço concluído. |
| Cookies de sessão / HttpOnly | Web com `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/`, prefixo `__Host-` na Vercel e sem `Domain`. Validação exata de Origin e exigência de JSON protegem contra CSRF. Cookies são renovados pelo servidor; não há sessão no localStorage. |
| Hash nas senhas | Mantido o bcrypt com salt do Supabase. Não foi criado um segundo hash caseiro. Cadastro exige 12 a 72 caracteres e até 72 bytes na API; configure a mesma política no Supabase para proteger chamadas diretas. |
| Rate limit | Triggers do arquivo `rate-limits.sql` limitam gravações inclusive pela API direta. Auth e proteção de tráfego/leitura exigem os ajustes de painel descritos abaixo. |
| Bot protection | Turnstile integrado ao login, cadastro e reenvio. O servidor exige token em produção; a validação real precisa ser habilitada no Supabase. No nativo, a verificação abre em WebView restrita à página HTTPS do app. |
| Queries parametrizadas | Consultas usam o SDK Supabase/PostgREST, valores separados dos filtros e validação de UUID. Não há endpoint para executar SQL recebido do cliente. SQL dinâmico de migração só usa identificadores internos escapados. |
| Validação dos inputs | API valida tamanho, tipos, campos permitidos, e-mail, senha, telefone, UUID, estado, status e notas. Constraints no banco defendem chamadas diretas. Constraints novas são `NOT VALID`: protegem novas gravações sem apagar dados antigos; os registros antigos precisam de revisão separada. |
| Restringir uploads | Atualmente só existe seleção local de imagem, sem envio ao Storage. Seleção limitada a JPG/PNG/WebP, 5 MB e 20 MP. Não há endpoint de upload na nova API. Se adicionar uploads, faltam validação real do arquivo no servidor, bucket privado, policies, remoção de metadados e análise de conteúdo. MIME informado pelo cliente não é garantia de segurança. |
| Reduzir respostas de API | Colunas explícitas, listas limitadas a 100 registros, respostas de autenticação sem tokens/metadados pessoais e mensagens sem erros internos do banco. Paginação adicional ainda não existe. |
| Security headers | `vercel.json` inclui CSP, HSTS, nosniff, bloqueio de enquadramento, política de referência e permissões. Scripts inline da exportação são movidos para arquivos no build. Falta publicar e validar os cabeçalhos reais. |
| Forçar HTTPS | API exige HTTPS na Vercel, Supabase exige URL HTTPS, CSP atualiza recursos inseguros e HSTS está configurado. O redirecionamento HTTP→HTTPS do domínio deve ser conferido após o deploy. |
| Scan de dependências | `npm audit`: 14 alertas moderados antes; 3 depois. Corrigida a cadeia `xcode → uuid` com versão compatível, mantendo o Expo. Restam `decode-uri-component`, `query-string` e `expo-router` por um mesmo problema de processamento de URLs. Zero alertas altos/críticos nesta execução. |
| Não vazar conteúdo de usuários | RLS testado entre contas, telefone de orçamento sem permissão de leitura pelo app, API sem respostas de outros usuários, erros sem conteúdo sensível, telas desmontadas ao trocar de conta e sincronização de logout entre abas quando BroadcastChannel está disponível. |
| Segurança global | Defesa em camadas e testes automatizados. Ainda precisam de configuração: MFA nas contas administrativas, permissões da equipe, alertas, backups/restauração, política de retenção e firewall. Não existe configuração única que garanta segurança total. |
| Cache | API com `private, no-store` e cache de CDN desativado. HTML sem armazenamento; somente arquivos estáticos versionados do Expo recebem cache público longo. Tokens antigos do localStorage/AsyncStorage são removidos ao usar a nova versão. |

## Para ativar no Supabase

1. Se as tabelas já existem, **não rode novamente `schema.sql`**. Crie uma query nova, cole e execute `supabase/security-hardening.sql`. Ela substitui as policies das quatro tabelas conhecidas; revise se você adicionou policies próprias no painel.
2. Execute `supabase/rate-limits.sql`, mesmo que já tenha sido usado. Pode ser reaplicado sem zerar contadores. Não reaplique o antigo `rls-security-update.sql` depois: ele é anterior a essas restrições.
3. Em Authentication, mantenha a confirmação de e-mail e configure senha mínima de 12 caracteres, requisitos de complexidade e proteção contra senhas vazadas quando disponível no plano.
4. Crie um widget Cloudflare Turnstile para os domínios exatos da aplicação. No Supabase, em proteção contra bots, escolha Turnstile e informe **a secret key**. Essa secret key nunca deve entrar em variáveis `EXPO_PUBLIC_*` ou no Git.
5. Revise Authentication → Rate Limits e SMTP. O servidor web compartilha o IP de saída; os limites nativos do Auth não devem ser interpretados como uma cota individual perfeita de cada visitante do site.
6. Revise Site URL e Redirect URLs com os domínios HTTPS autorizados. Não habilite cadastro anônimo ou buckets públicos para anexos pessoais.

## Para publicar na Vercel

Use a pasta **`freela_ggr`** como Root Directory do projeto. O arquivo `vercel.json` já define o build e `dist` como saída; `api/gateway.ts` deve ser publicado como função, junto dos arquivos estáticos.

Configure as variáveis do exemplo `.env.example`:

- `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`: URL HTTPS e publishable key.
- `EXPO_PUBLIC_TURNSTILE_SITE_KEY`: **site key pública**, não secret key.
- `EXPO_PUBLIC_WEB_ORIGIN`: domínio HTTPS que também hospeda `/security-check.html`, usado no nativo.
- `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`: mesmos valores públicos, usados pelo servidor. Não use `service_role`.
- `APP_ORIGIN`: origem exata, como `https://app.exemplo.com`, sem barra final. Configure separadamente em previews; uma origem diferente é rejeitada.

Faça um novo build após mudar variáveis `EXPO_PUBLIC_*`. Sem Turnstile configurado, a autenticação de produção fica bloqueada por segurança.

No firewall da Vercel, configure uma regra de rate limit por IP para `/api/gateway` (ponto de partida: 120 requisições/minuto, ajustando ao uso real) e proteção de bots. Isso protege o tráfego da função; não substitui as policies ou os limites do Supabase. **Não foi criado um limitador em memória**, pois ele não seria compartilhado entre instâncias.

Depois do deploy, valide login/cadastro/reenvio, renovação da sessão, logout entre abas, CAPTCHA real, RLS com duas contas, bloqueio por excesso, cookies, CSP e redirecionamento HTTP→HTTPS. A integração nativa com SecureStore/WebView precisa ser testada em aparelho. A primeira execução da nova versão exige novo login porque a sessão antiga sem criptografia é descartada.

## Desenvolvimento e verificações

Use Node 22 ou superior. `npm run web` compila a web e inicia a API local em `http://localhost:3000`. `npm start` continua servindo para Expo no aparelho; iniciar só o servidor estático do Expo não disponibiliza `/api/gateway`.

- `npm run check:types`
- `npm run test:security`
- `npm run build:web`
- `npm run security:secrets`
- `npm run security:audit`

Passaram os testes locais de API simulada, SQL real em PGlite, RLS entre contas, permissões por coluna, validação, rate limit, rollback, expiração e reaplicação. O teste de API usa Supabase simulado; PGlite não testa concorrência entre conexões de produção. Não foram feitos testes destrutivos nem escritas no Supabase remoto.

O alerta restante é [CVE-2026-45822](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr). A versão corrigida de `decode-uri-component` mudou para ESM; forçá-la diretamente na cadeia CommonJS instalada quebra a interface esperada. É necessário atualizar a integração do roteador com testes de navegação antes de considerar essa pendência encerrada. `npm audit` continua retornando erro enquanto os alertas existirem.

Fontes: [chaves do Supabase](https://supabase.com/docs/guides/api/api-keys), [segurança de senhas](https://supabase.com/docs/guides/auth/password-security), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [permissões por coluna](https://supabase.com/docs/guides/database/postgres/column-level-security), [segurança da infraestrutura Supabase](https://supabase.com/security), [TLS na Vercel](https://vercel.com/docs/cdn-security/encryption).
