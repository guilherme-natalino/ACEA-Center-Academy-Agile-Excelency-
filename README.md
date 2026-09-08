# CAAE - Academia Agile

Aplicacao web estatica para estudo de Agilidade, com treinamento adaptativo, metricas de dominio, conquistas, progressao por niveis e sincronizacao opcional com Firebase.

## Indice

- [Visao geral](#visao-geral)
- [Como executar](#como-executar)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como a aplicacao funciona](#como-a-aplicacao-funciona)
- [Onde editar cada coisa](#onde-editar-cada-coisa)
- [Dados e progresso](#dados-e-progresso)
- [Autenticacao e Firebase](#autenticacao-e-firebase)
- [Seguranca](#seguranca)
- [Testes](#testes)
- [Boas praticas para alteracoes](#boas-praticas-para-alteracoes)
- [Limites conhecidos](#limites-conhecidos)

## Visao geral

O projeto usa JavaScript puro e uma separacao inspirada em MVC:

- **Model:** banco de perguntas, perfil, progresso, regras de dominio, niveis e integracao com Firebase.
- **View:** renderizacao de telas e componentes no DOM.
- **Controller:** eventos, navegacao, sessoes de quiz, autenticacao e persistencia.

Nao existe build obrigatorio nem framework de frontend. O navegador carrega os quatro arquivos JavaScript na ordem definida no final de `index.html`.

## Como executar

### Abrir diretamente

Para uma verificacao rapida, abra `index.html` no navegador. A maior parte da aplicacao funciona localmente.

### Servidor local

Um servidor local e recomendado para evitar restricoes do navegador com arquivos locais e para testar recursos externos:

```text
python -m http.server 8000
```

Depois acesse `http://localhost:8000`. Tambem e possivel usar a extensao Live Server do VS Code.

### Testes

Nao ha `package.json`. Execute os testes diretamente com Node.js:

```text
node tests/ui-architecture.test.cjs
node tests/security.test.cjs
```

Os testes verificam a arquitetura, os contratos principais da interface, as regras de seguranca e partes importantes do fluxo de estudos.

### Deploy gratuito no Firebase

Depois de instalar o Firebase CLI, autentique e selecione o projeto:

```text
firebase login
firebase use aeca-agile-excellence
firebase deploy --only hosting,firestore:rules
```

No console do Firebase, ative **Authentication > Email/Password** e crie o Firestore antes do primeiro uso. O deploy usa `firebase.json` e publica apenas o frontend e as regras do Firestore.

## Estrutura do projeto

```text
index.html              Estrutura das telas e carregamento dos scripts
css/styles.css          Layout, cores, responsividade e componentes visuais
js/model.js             Dados, regras de negocio, estado e Firebase
js/view.js              Renderizacao do DOM
js/controller.js        Eventos, navegacao e fluxo das sessoes
js/security.js          Validacao, normalizacao, escaping e allowlists
assets/favicon.png      Imagem usada no favicon e na logo do cabecalho
assets/mascots/         Imagens dos niveis da Jornada
tests/                  Testes de arquitetura e seguranca
_headers                Headers para hospedagem estatica, como Netlify
SECURITY.md             Mapeamento de seguranca e limitacoes do frontend
firebase.json           Configuracao do Firebase Hosting e headers
firestore.rules         Regras de seguranca do Firestore
```

## Como a aplicacao funciona

### Inicializacao

1. O navegador carrega `security.js`, `model.js`, `view.js` e `controller.js`.
2. `boot()` carrega o perfil local.
3. As telas Estudos, Perfil e Metricas sao renderizadas.
4. A sessao Firebase e restaurada, quando existe.
5. O perfil remoto pode substituir o perfil local quando a conta esta conectada.

O ponto de entrada fica em `boot()` no final de `js/controller.js`.

### Navegacao

As telas ficam no mesmo HTML e usam a classe `screen`:

- `home`: Jornada e acoes principais.
- `study`: catalogo de materiais e perguntas por conceito.
- `metrics`: dominio, precisao e pontos de atencao.
- `profile`: historico, conquistas e reset.
- `support`: FAC, SAC e chamados privados do usuario.
- `quiz`: pergunta atual.
- `result`: resultado da sessao.

`showScreen()` em `js/controller.js` alterna a tela ativa e chama a renderizacao necessaria.

### Fluxo de uma resposta

1. O usuario escolhe uma alternativa.
2. `answer()` valida a posicao usando o estado do quiz.
3. A resposta atualiza `mastery`, `totalAnswered`, `totalCorrect`, XP e streak.
4. As conquistas aplicaveis sao verificadas.
5. O feedback e o material de revisao sao exibidos.
6. O perfil e salvo localmente e, quando aplicavel, sincronizado com o Firestore.

### Fluxo de uma sessao

- `startTraining()` cria um treinamento adaptativo.
- `startExam()` cria uma avaliacao de promocao.
- `startDaily()` cria o desafio diario.
- `startRecommended()` treina o conceito mais fraco.
- `studyConcept()` treina um conceito escolhido na tela Estudos.
- `studyGroup()` treina uma competencia escolhida em Pontos de atencao.
- `finishSession()` calcula o resultado, registra o historico e avalia a promocao.

## Onde editar cada coisa

### Textos e estrutura visual

Edite `index.html` para mudar titulos, subtitulos, textos fixos, secoes, botoes, `data-action`, `data-screen`, IDs, links de CSS/JavaScript, favicon e imagem da logo.

**Cuidado:** se um ID usado em `view.js` ou `controller.js` for removido, a tela pode deixar de funcionar.

### Cores, tamanhos e responsividade

Edite `css/styles.css` para alterar cores, fontes, espacamentos, bordas, cards, botoes, barras, navegacao, tooltips, hover e responsividade.

O CSS esta organizado por areas. Procure os comentarios `Top bar`, `Metrica`, `Responsivo`, `Journey`, `Quiz` e `Modal`.

### Perguntas

Edite `BANK_RAW` em `js/model.js` para adicionar ou alterar perguntas:

```js
{
	diff: 1,
	cat: 'Scrum',
	concept: 'Sprint Goal',
	q: 'Texto da pergunta',
	opts: ['Opcao A', 'Opcao B', 'Opcao C', 'Opcao D'],
	ans: 1,
	xp: 15,
	exp: 'Explicacao exibida depois da resposta.',
	vid: { t: 'Titulo do video', u: 'https://www.youtube.com/watch?v=XXXXXXXXXXX' }
}
```

Regras: `ans` e o indice correto de `opts` e comeca em `0`; `opts` deve ter quatro alternativas; `diff` influencia o XP; `concept` deve existir em `TOPICS`; e URLs de video precisam ser validas.

### Conceitos e competencias

Edite `TOPICS` em `js/model.js` para criar competencias, mover conceitos, alterar a ordem de Estudos e controlar o agrupamento usado em Metricas e Promocoes.

Se um conceito estiver em `BANK_RAW` mas nao estiver em `TOPICS`, `catGroup()` usa `Flow & Metricas` como fallback. O ideal e sempre cadastrar o conceito em `TOPICS`.

### Videos e materiais

Edite `MATERIALS` em `js/model.js` para trocar os videos da tela Estudos. Edite `RECOVERY_VIDEOS` para trocar os videos de recuperacao usados depois de respostas erradas.

### Niveis e promocao

Edite em `js/model.js`:

- `LEVELS`: nome, numero, cor e dificuldade maxima.
- `REQUIRED_BY_LEVEL`: competencias exigidas por promocao.
- `PROMOTION_SCORE`: percentual minimo geral.
- `REQUIRED_DOMAIN`: percentual minimo por competencia.
- `SESSION_SIZE` e `EXAM_SIZE`: quantidade de perguntas.

O fluxo de promocao termina em `finishSession()` no `controller.js`.

### Conquistas

Edite `ACH` em `js/model.js` para mudar ID, icone, nome ou descricao. Os gatilhos ficam principalmente em `answer()` e `finishSession()` no `controller.js`.

Ao criar uma conquista, use um ID novo e chame `unlock('id-da-conquista')` no ponto em que o criterio for atingido. As conquistas atuais cobrem respostas, sequencias, dias estudados, exploracao de competencias, sessoes perfeitas, dominio, Flow, User Stories, Kanban e promocao.

### Metricas

Edite `renderMetrics()` em `js/view.js` para mudar os indicadores do topo, o calculo do dominio medio, a lista de competencias, o limite de pontos de atencao e os botoes `Praticar`.

O calculo atual diferencia `Nao iniciado` de `0%`, usa respostas reais para o dominio medio e lista todas as competencias abaixo de 70%.

### Perfil e historico

Edite `renderProfile()` em `js/view.js` para alterar estatisticas, historico e conquistas. Edite `defaultProfile()` em `js/model.js` somente ao adicionar um novo campo persistido; nesse caso, atualize tambem `js/security.js` e `syncToCloud()`.

### Navegacao e botoes

Para adicionar uma acao:

1. Adicione o elemento em `index.html` com `data-action="nome-da-acao"`.
2. Adicione o caso correspondente ao `switch` de eventos em `js/controller.js`.
3. Crie a funcao da regra no controller ou no model, conforme a responsabilidade.
4. Atualize a view se a acao alterar a interface.
5. Adicione um teste.

Para adicionar uma tela, crie uma `section` com classe `screen` e ID, inclua o ID em `allowedScreens`, adicione a renderizacao em `showScreen()` e crie o botao com `data-screen`.

### FAC e SAC

Edite as perguntas dentro da `section#support` em `index.html`. Cada item usa `details` e `summary`, permitindo abrir respostas sem JavaScript adicional.

O formulario de chamados usa `submitSupportTicket()` em `js/controller.js`. Os chamados sao gravados em `support/{uid}/tickets/{ticketId}` e ficam acessiveis somente ao proprio usuario pelas regras em `firestore.rules`. Para alterar categorias, edite as `option` de `#supportCategory`.

### Email dos chamados com EmailJS

O chamado e salvo primeiro no Firestore e depois encaminhado para `acaeacademiaagile@gmail.com` pelo EmailJS. Para ativar o envio, crie uma conta gratuita no EmailJS, configure um servico de email e um template, e preencha `EMAILJS_CONFIG` em `js/model.js`:

```js
const EMAILJS_CONFIG = Object.freeze({
	publicKey: 'SUA_PUBLIC_KEY',
	serviceId: 'SEU_SERVICE_ID',
	templateId: 'SEU_TEMPLATE_ID',
	recipient: 'acaeacademiaagile@gmail.com'
});
```

O template deve usar estas variaveis: `{{to_email}}`, `{{from_email}}`, `{{ticket_id}}`, `{{category}}`, `{{subject}}`, `{{description}}` e `{{created_at}}`. A public key do EmailJS pode ficar no frontend; nunca coloque senha SMTP ou chave privada no codigo.

## Dados e progresso

### Armazenamento local

Visitantes nao gravam progresso permanente no navegador. Isso evita que outra pessoa usando o mesmo dispositivo veja respostas ou metricas anteriores. Depois do login ou cadastro, o progresso autenticado e salvo somente no Firestore.

Ao entrar em uma conta que ja tem dados na nuvem enquanto existe progresso na sessao atual, a aplicacao pergunta qual fonte deve permanecer: nuvem ou sessao atual.

Para zerar o progresso sincronizado, use **Zerar progresso** no Perfil. A funcao responsavel e `resetProgress()` em `js/controller.js`.

### Dominio

Cada conceito possui um objeto:

```js
{ seen: 0, correct: 0, last: 0, recovery: 0 }
```

O percentual e respostas corretas dividido por respostas vistas. O estado fica no perfil, nao no banco de perguntas.

### Estado da sessao

`state` guarda a sessao atual: `mode`, `questions`, `idx`, `results`, `sessionCorrect`, `sessionStreak`, `optionOrder` e `correctPosition`.

Nao use `state` para dados que precisam sobreviver ao recarregamento. Para isso, use `profile` e atualize a persistencia.

## Autenticacao e Firebase

As chamadas de autenticacao e Firestore ficam na fachada `sb` em `js/model.js`. O nome foi mantido para reduzir o impacto da migracao no restante do app.

O frontend usa a configuracao publica do Firebase. Ela nao e um segredo; a protecao real esta nas regras do Firestore e no Firebase Authentication. Solicitacoes de privacidade devem ser enviadas para `acaeacademiaagile@gmail.com`.

Operacoes principais: `signUp()`, `signIn()`, `signOut()`, `getUser()`, `getProfile()`, `getMastery()`, `upsertProfile()`, `upsertMastery()` e `insertSession()`.

Ao adicionar uma colecao ou campo remoto:

1. Atualize `firestore.rules` com a regra de propriedade do usuario.
2. Mantenha o caminho da colecao restrito ao UID autenticado.
3. Crie o metodo correspondente em `sb`.
4. Valide IDs e dados antes da chamada.
5. Atualize os testes de seguranca.

## Seguranca

`js/security.js` valida UIDs Firebase, emails e senhas, limita inteiros e dados de perfil, valida URLs externas, escapa texto e normaliza dados do armazenamento local e do servidor.

Regras para novas alteracoes:

- use `textContent` quando nao precisar de HTML;
- use `esc()` em valores inseridos em template strings HTML;
- nunca confie em objetos vindos de `localStorage`;
- nunca coloque service-role key, senha ou segredo no frontend;
- mantenha as regras do Firestore baseadas em `request.auth.uid`;
- valide toda URL externa antes de criar links ou iframes.

Headers ficam em `_headers`; o mapeamento detalhado esta em `SECURITY.md`.

## Testes

Execute antes de finalizar uma alteracao:

```text
node tests/ui-architecture.test.cjs
node tests/security.test.cjs
```

Atualize `tests/ui-architecture.test.cjs` ao mudar IDs, telas, acoes de controller, estrutura MVC, metricas ou conquistas.

Atualize `tests/security.test.cjs` ao mudar validacao, colecoes Firebase, headers, normalizacao, URLs, iframes ou dados externos.

## Boas praticas para alteracoes

1. Encontre a funcao que realmente decide o comportamento antes de editar.
2. Mantenha dados e regras em `model.js`, DOM em `view.js` e eventos em `controller.js`.
3. Reutilize `esc()`, `Security` e os helpers existentes.
4. Evite duplicar dados entre `BANK_RAW`, `TOPICS` e `MATERIALS`.
5. Execute os testes depois de cada mudanca relevante.
6. Teste no desktop e no mobile.
7. Nao apague mudancas de outros colaboradores sem revisar o diff.

## Limites conhecidos

- A aplicacao e frontend-first; autorizacao real depende das regras do Firestore.
- O progresso anonimo fica somente no navegador ate o usuario autenticar.
- Nao existe pipeline de build ou suite automatizada de navegador neste repositorio.
- O catalogo de perguntas e materiais fica embutido em `model.js`.
- O deploy pode ser feito pelo Firebase Hosting usando `firebase.json`; o arquivo `_headers` permanece como fallback para hosts que suportam o formato Netlify.
- O botao de notificacoes possui icone e tooltip, mas ainda nao possui fluxo de notificacoes implementado.

## Creditos e autoria

A autoria pode ser registrada no historico do Git, nesta secao ou em uma pagina de creditos. Nao e necessario adicionar uma assinatura em todos os arquivos de codigo.
