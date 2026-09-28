# Ativação dos limites

1. No SQL Editor do projeto Supabase, execute `rate-limits.sql` depois de `schema.sql` (inclusive em instalações novas).
2. Em **Authentication > Rate Limits**, revise os limites nativos do Auth. Como ponto de partida, use 30 requisições de login/cadastro por IP a cada 5 minutos no campo correspondente a sign-in/sign-up. Mantenha pelo menos 60 segundos entre reenvios de confirmação. A cota global de e-mails depende do SMTP e do volume esperado; não desative a confirmação para contornar o limite.
3. Publique a versão atualizada do aplicativo para exibir as mensagens de bloqueio.

O SQL não configura o Auth. Os ajustes do painel precisam ser aplicados separadamente. Referência: https://supabase.com/docs/guides/auth/rate-limits

## Limites de gravação

| Ação | Limite por usuário |
| --- | --- |
| Criar orçamento | 5 em 10 minutos |
| Atualizar orçamento | 30 por minuto |
| Avaliar serviço concluído | 10 por minuto |
| Criar/editar perfil | 10 por minuto, por operação |
| Criar/editar/excluir serviço | 10 por minuto, por operação |

São janelas fixas iniciadas na primeira gravação. Os contadores usam a identidade autenticada, não um ID informado no corpo da requisição. Triggers protegem inclusive gravações diretas e lotes; um lote que excede a cota é inteiramente desfeito. O contador é atualizado atomicamente e sua tabela não pode ser acessada pelo aplicativo.

Ao exceder o limite, o banco retorna `PT429` (HTTP 429 no PostgREST) com `retry_after_seconds`. O app mostra o tempo e só confirma alterações após o banco aceitar. Erros do Auth também têm mensagem própria, sem instruções administrativas ao usuário.

Os limites contam linhas gravadas com sucesso; transações desfeitas não consomem cota. Não limitam leituras, tráfego total, tentativas inválidas ou operações administrativas sem usuário autenticado. As policies RLS existentes continuam necessárias. Há uma linha por usuário/ação, reutilizada a cada janela e removida ao excluir a conta.

## Verificação local

`npm run test:security` executa os testes, incluindo `scripts/test-rate-limits.cjs`, em PostgreSQL embutido via PGlite, com identidades Auth simuladas. A dependência já está nas ferramentas de desenvolvimento do projeto. Não usa o projeto de produção.

Ainda valide no projeto de homologação a integração HTTP, os limites do Auth e concorrência entre conexões reais antes de publicar. O teste embutido não substitui essa validação.
