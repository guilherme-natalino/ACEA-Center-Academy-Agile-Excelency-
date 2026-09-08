# Segurança — Academia Agile

Este projeto adota uma camada de segurança no frontend inspirada no **OWASP Top 10:2025**. O Top 10 é um documento de conscientização e não transforma automaticamente um frontend estático em uma aplicação segura: controles críticos precisam existir também no backend, banco e infraestrutura.

## Mapeamento aplicado

| OWASP 2025 | Aplicação no projeto |
|---|---|
| A01 — Broken Access Control | UIDs Firebase são validados; Firestore restringe cada documento ao `request.auth.uid`. |
| A02 — Security Misconfiguration | `_headers` adiciona CSP, HSTS, `nosniff`, Referrer-Policy, Permissions-Policy, COOP e CORP. |
| A03 — Software Supply Chain Failures | SDKs Firebase são carregados de `www.gstatic.com` com origem explicitamente permitida na CSP; material de terceiros é restrito a hosts aprovados. |
| A04 — Cryptographic Failures | Apenas HTTPS é aceito para materiais externos; não há senha armazenada pela aplicação; nunca inserir service-role key no frontend. |
| A05 — Injection | Textos dinâmicos são escapados; URLs externas passam por allowlist; tabelas REST são allowlist. |
| A06 — Insecure Design | Segurança está separada em `security.js`; estado externo é normalizado antes de entrar no domínio. |
| A07 — Authentication Failures | Firebase Authentication é usado para autenticação; email e senha recebem validação client-side; mensagens de erro não expõem detalhes sensíveis. |
| A08 — Software or Data Integrity Failures | Perfil e dados de domínio são validados, limitados e normalizados antes de serem usados. |
| A09 — Security Logging and Alerting Failures | Logs locais não incluem tokens, senhas ou emails; Firebase Analytics só é ativado após consentimento opcional. Alertas de produção precisam ser implementados no backend. |
| A10 — Mishandling of Exceptional Conditions | `safeFetch`, `safeJson`, validação de dados e tratamento de erros evitam estados inesperados e vazamento de detalhes. |

## Limitação importante

A aplicação é uma SPA estática. Portanto, **controle de acesso, RLS, rate limiting, gerenciamento de segredos, validação server-side e auditoria/alertas de produção não podem ser garantidos apenas por JavaScript no navegador**.

No Firebase, as regras em `firestore.rules` devem ser publicadas junto com o banco. Os caminhos `profiles/{uid}`, `mastery/{uid}/concepts/{concept}` e `sessions/{uid}/items/{session}` só podem ser acessados pelo próprio UID autenticado. A configuração Web pode aparecer no frontend; credenciais de conta de serviço nunca devem aparecer.

O cadastro exige aceite explícito da Política de Privacidade e dos Termos de Uso em `data-policy.html`, confirmação de idade mínima de 18 anos e consentimento separado para Analytics. A aplicação registra a versão e a data do aceite no perfil. Solicitações de privacidade devem ser encaminhadas para `acaeacademiaagile@gmail.com`. Esse texto é uma base técnica e deve ser revisado por profissional jurídico antes de uso público.

O cadastro também exige confirmação de maioridade. A exclusão da conta remove os documentos próprios do Firestore e a conta do Firebase Authentication; a operação pode exigir uma nova autenticação por segurança. A preferência de Analytics pode ser alterada no menu da conta.

Fonte: OWASP Top 10:2025, documentação oficial: https://owasp.org/Top10/2025/
