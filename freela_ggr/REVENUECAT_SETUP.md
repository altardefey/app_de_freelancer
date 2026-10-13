# Freela+ · ativação da cobrança

## O que está implementado
- Interface React Native com Rubik e tema claro.
- Login, cadastro, catálogo, pedidos, painel profissional, conta, criação de orçamento e Freela+.
- Cinco **orçamentos criados pelo profissional** por mês civil, no fuso America/Sao_Paulo. Solicitações de clientes não consomem essa franquia.
- Freela+ mensal: preço planejado R$ 14,99; o app mostra o preço localizado real devolvido pela loja.
- Orçamentos do profissional ficam em professional_quotes; pedidos de clientes continuam em budgets.
- Contador transacional no banco, por usuário e mês. Não depende do relógio do aparelho nem de um booleano enviado pelo cliente.
- Tentativas repetidas usam request_id. Não criam outro orçamento nem gastam outra unidade.
- O histórico permanece após expiração/cancelamento. A franquia não acumula.
- Rascunho do orçamento salvo localmente por conta. Compartilhamento usa a folha nativa, em texto (não PDF).
- Compra e restauração via RevenueCat; liberação de acesso somente após verificação no servidor.

## O que ainda precisa ser configurado
Nenhum projeto de RevenueCat, produto de loja ou banco remoto foi modificado nesta implementação. São necessárias suas contas, chaves e um build nativo. Não colocar segredos neste repositório nem em EXPO_PUBLIC_*.

### 1. Banco Supabase
Para banco existente, execute supabase/freela-plus.sql **depois** das migrações atuais.
Para banco novo: schema.sql → security-hardening.sql → rate-limits.sql → freela-plus.sql.
Reaplicar security-hardening.sql remove grants da coluna details: se reaplicar, execute freela-plus.sql por último.
A migração não altera pedidos antigos nem converte pedidos de clientes em orçamentos de profissionais.
A nova interface depende dessa migração; publique banco e função antes do app.

### 2. Produtos e RevenueCat
1. Cadastre o app no Google Play Console e/ou App Store Connect. Ajuste o application ID Android (o atual é com.anonymous.freela_ggr) e defina ios.bundleIdentifier em app.json para os IDs reais das lojas.
2. Crie uma assinatura renovável de **um mês**, por exemplo freela_plus_monthly, e configure **R$ 14,99 no Brasil**. Nos outros países, configure os preços desejados.
3. Crie o projeto no RevenueCat e conecte as lojas com as credenciais solicitadas.
4. Importe o produto e associe ao entitlement exato **freela**.
5. Crie uma Offering, marque-a como atual e adicione o produto ao package **Monthly ($rc_monthly)**.
6. Escolha conscientemente a política de restauração/transferência entre contas nas configurações do RevenueCat. Teste com duas contas Freela; o app identifica cada comprador pelo UUID do Supabase, nunca pelo e-mail.
7. Copie as chaves SDK públicas iOS e Android para EXPO_PUBLIC_REVENUECAT_IOS_KEY e EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.
8. Publique os termos de uso e a política de privacidade reais do seu serviço. Configure EXPO_PUBLIC_TERMS_URL e EXPO_PUBLIC_PRIVACY_URL (HTTPS). A compra fica indisponível até existir oferta e esses links.

### 3. Verificação e webhook
A função supabase/functions/revenuecat-sync/index.ts atende à sincronização autenticada e aos webhooks.
No Supabase, configure os secrets:
- REVENUECAT_SECRET_KEY: chave secreta com acesso à API v1 GET /subscribers/{app_user_id}.
- REVENUECAT_WEBHOOK_AUTH: valor longo e aleatório, por exemplo Bearer seguido de um segredo gerado por você.
- REVENUECAT_ALLOW_SANDBOX: true **somente no projeto de homologação**; em produção, omita ou deixe false.
SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são disponibilizados pelo ambiente da Edge Function.

Faça login na CLI Supabase, vincule seu projeto e publique:
    npx supabase functions deploy revenuecat-sync

O arquivo supabase/config.toml desativa a validação JWT automática **apenas dessa função** porque RevenueCat usa outro cabeçalho. O código verifica o JWT com auth.getUser para chamadas do app; webhooks exigem o segredo exato. Nunca remover essas verificações.

No RevenueCat → Integrations → Webhooks:
- URL: https://SEU-PROJETO.supabase.co/functions/v1/revenuecat-sync
- Authorization: exatamente o valor de REVENUECAT_WEBHOOK_AUTH.
- Habilite os eventos de compra, renovação, cancelamento, expiração, reembolso e transferência.
- Envie o evento TEST e confirme HTTP 200.

O corpo do webhook não concede acesso. A função consulta o estado atual no RevenueCat, incluindo expiração/período de graça; trata as contas envolvidas em transferências e recusa sobrescrever uma verificação mais recente por uma chamada antiga. Falhas retornam 503 para permitir nova tentativa. Cancelamento mantém o acesso até a expiração devolvida pelo RevenueCat.

### 4. Build e teste nas lojas
    npx eas-cli login
    npx eas-cli build:configure
    npx eas-cli build --profile development --platform android
    npx expo start --dev-client

Há perfis development/preview/production em eas.json. iOS requer conta Apple e os identificadores corretos.
**Expo Go não realiza compras reais.** A interface web permite consultar plano e histórico; a compra foi implementada para Android/iOS, não RevenueCat Web Billing.
Na homologação, use contas sandbox das lojas e REVENUECAT_ALLOW_SANDBOX=true em um Supabase separado.

Valide no aparelho:
- Compra mensal, preço, restauração e compra cancelada pelo usuário.
- Pagamento pendente, ausência de internet e retomada.
- Atualização do plano após webhook e restauração.
- Expiração, cancelamento, reembolso e transferência.
- Cinco orçamentos grátis; sexto bloqueado; sexto permitido com assinatura verificada.
- Mesma conta em dois aparelhos; tentativa repetida após falha de conexão.
- Teclado e compartilhamento nativo em Android e iOS.

## Validação local feita
npm run check:types
npm run test:security
npm run test:freela-plus
npm run build:web
npm run test:ui

Os testes de interface usam API simulada e dados fictícios, sem criar contas ou compras reais.
As imagens em output/freela-redesign são capturas desse ambiente.
Os testes de assinatura simulam RevenueCat; não substituem uma compra sandbox no dispositivo.
Não há geração de PDF nem upload de anexos implementados; a interface não promete essas ações. Detalhes escritos em pedidos agora são salvos e mostrados ao profissional.

## Documentação oficial
- https://www.revenuecat.com/docs/getting-started/installation/expo
- https://www.revenuecat.com/docs/getting-started/entitlements
- https://www.revenuecat.com/docs/integrations/webhooks
- https://www.revenuecat.com/docs/api-v1

## Configuração recebida do seu painel
A chave Test Store enviada foi configurada em .env.local para iOS e Android (arquivo ignorado pelo Git).
O identificador de entitlement agora é **freela**, no app e na Edge Function. O product ID pode continuar freela_plus_monthly; produto e entitlement são identificadores diferentes.

O app configura o SDK ao entrar com uma conta profissional, usando o UUID do Supabase como appUserID. Logs VERBOSE são usados apenas no desenvolvimento.
“Assinar Freela+” abre o paywall nativo da Offering atual. Compra/restauração verificam CustomerInfo.entitlements.active.freela e sincronizam com o servidor antes de liberar a franquia ilimitada.
Fechar/cancelar o paywall não concede acesso. A página Freela+ foi mantida.

Para testar agora:
1. No painel RevenueCat, associe o produto mensal ao entitlement **freela** e ao package Monthly da Offering atual.
2. Crie/publique um Paywall nessa Offering. Confirme o preço de teste desejado.
3. Refaça o development build, pois react-native-purchases-ui foi adicionado. Use npx eas-cli build --profile development --platform android (ou ios), instale e execute npx expo start --dev-client.
4. Entre como profissional e abra Freela+ → Assinar Freela+.
5. Para a compra de teste liberar orçamentos no banco, publique a função revenuecat-sync atualizada, configure a chave secreta e webhook conforme acima e habilite REVENUECAT_ALLOW_SANDBOX=true no ambiente Supabase de homologação.

O Test Store dispensa configurar Apple/Google para simular compras, mas não substitui as chaves das lojas na publicação. O app bloqueia a chave test_ em builds de produção. Links legais não bloqueiam o teste em development; são exigidos para a compra em produção.
Não foi efetuada compra nem alterado o painel RevenueCat. O paywall e a configuração do servidor ainda precisam ser confirmados na sua conta.

Referências:
- https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store
- https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls
