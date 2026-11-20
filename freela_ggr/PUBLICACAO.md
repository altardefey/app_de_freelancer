# Publicação dos orçamentos, catálogo e documentos legais

## Ativação

1. Em um projeto Supabase de teste com o esquema atual do Freela, execute [service-and-legal.sql](supabase/service-and-legal.sql) no SQL Editor. Execute este arquivo depois de `schema.sql`, `security-hardening.sql`, `rate-limits.sql`, `freela-plus.sql` e `budget-workflow.sql`. A migração também cria o bucket privado `service-portfolio`.
2. Teste cadastro com confirmação por e-mail, novo aceite em uma conta existente, publicação com foto e abertura do portfólio por outra conta. Confira se o bucket não tem políticas genéricas que liberem arquivos de outros usuários. O app usa o Supabase atual e não exige chave adicional para fotos.
3. Depois da revisão jurídica, coordene a ativação no banco com a publicação do app e da API web. A partir da migração, versões antigas do app não conseguem cadastrar novas contas.
4. Gere um novo build de Android e iOS para incluir os módulos nativos. Em cada sistema, teste um orçamento presencial e um remoto. Escolha o WhatsApp na lista de apps, confira o PDF e selecione o cliente. O botão de mensagem abre uma conversa separadamente. Na web, abra a prévia, use Imprimir para salvar em PDF e anexe o arquivo manualmente.

O portfólio aceita até três fotos por serviço no plano gratuito e até dez no Freela+. O app redimensiona e recodifica cada foto em JPEG, sem copiar os metadados de origem. O bucket limita cada arquivo a 512 KiB. O proprietário pode enviar arquivos na própria pasta, e usuários autenticados podem ler imagens vinculadas aos anúncios. A API web mantém a sessão no servidor. A verificação de assinatura JPEG na API e o limite de MIME do Storage não equivalem a uma inspeção de conteúdo. Defina um procedimento para denúncia e retirada de fotos e para limpeza periódica de uploads sem vínculo, usando a API do Storage.

## Dados e bases legais a validar

| Dados identificados no código | Finalidade | Base legal possível |
| --- | --- | --- |
| E-mail, credenciais, identificador, tipo de conta, WhatsApp, CEP, rua, bairro, município, UF e serviços informados | Autenticação, perfil e busca regional | Execução de contrato ou procedimentos preliminares, apenas para os dados necessários |
| Dados do anúncio, região de atendimento e foto | Exibir o catálogo e o portfólio aos usuários | Execução de contrato para a publicação pedida pelo profissional. Avaliar autorização e direitos de terceiros retratados |
| Solicitações, propostas, histórico, avaliações e orçamentos avulsos. Um orçamento avulso pode conter nome e telefone de cliente | Gerir pedidos, elaborar orçamento e compartilhá-lo por escolha do profissional | Avaliar execução de contrato e procedimentos preliminares. Definir o papel do Freela e do profissional quanto aos dados de terceiros |
| Estado de sessão, cotas, verificações de segurança e registros operacionais | Manter a sessão, proteger contra abuso e diagnosticar falhas | Execução de contrato ou legítimo interesse documentado. Obrigação legal para registros quando exigidos |
| Identificador e situação da assinatura Freela+ | Ativar o plano e verificar o direito de acesso | Execução de contrato e obrigações legais aplicáveis |
| Identificador da conta, versão dos documentos e data e hora do servidor | Comprovar o aceite dos Termos e a ciência da Política | Avaliar exercício regular de direitos e obrigações de prestação de contas |

O Supabase opera a autenticação, o banco e o armazenamento. A aplicação web usa uma API na Vercel e cookies de sessão. Quando habilitado, o Turnstile participa da verificação. ViaCEP e IBGE recebem consultas de localização feitas no formulário. As lojas de apps e o RevenueCat participam da assinatura. O rascunho fica no aparelho. O WhatsApp recebe texto ou PDF quando o profissional escolhe compartilhar. O app acompanha pedidos e propostas, enquanto contratação e pagamento do serviço são acertados entre cliente e profissional.

## Antes de publicar os textos

- Identifique o controlador, os dados de contato oficiais e o encarregado, se aplicável. Valide as bases legais por finalidade, principalmente a necessidade do WhatsApp e do endereço no cadastro e o tratamento dos dados de clientes informados pelo profissional. [LGPD, arts. 6º, 7º, 9º, 18 e 41](https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html)
- Verifique os fornecedores e as regiões realmente contratadas, os prazos de retenção e descarte, os mecanismos de transferência internacional e o fluxo de atendimento a titulares. [Regulamento de Transferência Internacional da ANPD](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024)
- Valide a eventual obrigação de guardar registros de acesso, a moderação de anúncios e fotos e o procedimento de denúncia e retirada. [Marco Civil da Internet](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm) e [Tema 987 do STF](https://portal.stf.jus.br/jurisprudenciaRepercussao/tema.asp?num=987)
- Revise o alcance das responsabilidades do Freela, os direitos do consumidor e as regras aplicáveis ao Freela+. [Código de Defesa do Consumidor](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm)

A ciência da política fica separada do aceite contratual. O fluxo atual não inclui uma finalidade opcional que dependa de consentimento. Se uma finalidade desse tipo for criada, apresente sua opção separadamente, inicialmente desmarcada, e documente como revogar o consentimento. A implementação técnica não garante conformidade jurídica.

## Publicar nova versão dos documentos

Guarde o conteúdo integral de cada versão publicada. Para alterações relevantes, arquive a versão anterior no repositório, atualize `src/data/legalDocuments.ts` com novo identificador e adicione uma linha com a nova versão em `private.legal_releases`. Em uma transação, retire a marca `required` da anterior e ative-a na nova. Os registros de aceite anteriores ficam associados à versão original. A tela de revisão pede novo aceite na próxima abertura de sessão e solicita atualização caso o app ainda tenha a versão anterior.

## Cadastro direto e recuperação de senha

1. Aplique `supabase/signup-adult.sql` depois de `service-and-legal.sql`, junto com a publicação do app atualizado. O script exige autodeclaração de 18 anos ou mais em novos cadastros por e-mail. Contas existentes podem continuar entrando.
2. Para liberar a entrada logo após o cadastro, vá a **Authentication → Sign In / Providers → Email** e desligue **Confirm Email**. A configuração vale para o projeto inteiro. Com ela desligada, o Supabase cria a sessão sem verificar se a pessoa controla o e-mail informado. [Configuração de autenticação](https://supabase.com/docs/guides/auth/general-configuration)
3. Em **Authentication → Email Templates → Reset password**, use o assunto `Seu código para trocar a senha do Freela` e o conteúdo abaixo. Confirme o envio de recuperação a um endereço de teste. Para enviar ao público, configure um serviço SMTP no Supabase. [Modelos de e-mail](https://supabase.com/docs/guides/auth/auth-email-templates) e [SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

```html
<h2>Troque sua senha do Freela</h2>
<p>Volte ao Freela e digite este código no campo Código do e-mail.</p>
<p style="font-size: 28px"><strong>{{ .Token }}</strong></p>
<p>Se você não pediu para trocar sua senha, ignore este e-mail.</p>
```

## Conta, portfólio e WhatsApp por pedido

Aplique `supabase/account-portfolio-contact.sql` depois de `service-and-legal.sql` e publique a API e o app juntos. A migração preserva fotos de anúncios antigos. A validação de quantidade usa a assinatura registrada no banco. Após o fim da assinatura, o catálogo mostra até três fotos e o editor permite remover as excedentes.

O cliente escolhe se o profissional pode usar seu número do cadastro para enviar aquele orçamento. O banco libera esse número somente ao profissional do pedido após registrar a proposta. Pedidos anteriores continuam sem esse compartilhamento. Teste com duas contas e confira que abrir a conversa usa o número certo, sem expor o telefone no catálogo.

O WhatsApp abre com a mensagem pronta. Para anexar o PDF, salve o arquivo e selecione-o na conversa. O envio automático por uma conta comercial exigiria integração com a API do WhatsApp Business, credenciais próprias e revisão das regras de mensagens e do tratamento de dados.

## Configurações do perfil e categorias

Aplique `supabase/profile-settings.sql` depois de `account-portfolio-contact.sql`. Publique a API e o app juntos. O cliente pode editar os serviços de interesse e usá-los como filtro em Explorar. O profissional pode editar os tipos de serviço, o nome e a categoria de cada anúncio e os dados exibidos na página do anúncio.

O número de WhatsApp Business, os links, a bio, os serviços e a foto são opcionais. Quando preenchidos por um profissional com anúncio, ficam disponíveis a usuários autenticados. O telefone pessoal do cadastro continua separado. O script reutiliza o armazenamento privado do portfólio para as fotos de perfil.

## Cadastro, pedidos e orçamentos

Aplique `supabase/profile-settings.sql` se ainda estiver pendente. Depois, aplique `supabase/order-quotes.sql`, com `signup-adult.sql` já instalado. Publique o app e a API juntos. O novo cadastro exige primeiro nome e WhatsApp. A foto do cliente fica privada.

O pedido registra o primeiro nome, o WhatsApp e o preço fixo, se houver, a partir do cadastro e do anúncio. O profissional informa prazo ou disponibilidade e o valor quando o anúncio estiver a combinar. Salvar uma proposta consome a franquia de orçamentos existente. O telefone de pedidos antigos sem autorização continua protegido.

O botão Cancelar assinatura abre a gestão da loja de compra. O usuário confirma o cancelamento na loja. O app não encerra a cobrança por inatividade.

## Reserva de anúncios

Aplique `supabase/freela-plus.sql` e depois `supabase/service-booking.sql` para atualizar a cota e a disponibilidade. Aceitar uma proposta mantém o anúncio no catálogo e não interfere nos outros pedidos. Com dez orçamentos no mês, todos os anúncios do profissional exibem “Indisponível no momento” até o primeiro dia do próximo mês, no horário de Brasília.

Se houver anúncios antigos com mais de um pedido aceito ou em andamento, resolva essas reservas antes de aplicar a migração. Para publicar, o profissional precisa informar o primeiro nome na Conta.
