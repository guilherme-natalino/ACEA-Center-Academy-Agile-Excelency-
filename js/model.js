// Model: application data, authentication facade, state and business rules.
// Security baseline: see security.js and SECURITY.md (OWASP Top 10:2025 mapping).

// Firebase Web configuration is public client configuration. Never put service-account keys here.
const FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyBnH0DG201aEqrhFsAA9Ega4tkft7tNXls',
  authDomain: 'aeca-agile-excellence.firebaseapp.com',
  projectId: 'aeca-agile-excellence',
  storageBucket: 'aeca-agile-excellence.firebasestorage.app',
  messagingSenderId: '185775942903',
  appId: '1:185775942903:web:23c964ed953ea22cee77f2',
  measurementId: 'G-DTSE13PL8X'
});

// Administrative access is also enforced by firestore.rules.
const ADMIN_EMAIL = 'guilhermealisson14@hotmail.com';

// EmailJS public configuration. Fill these IDs after creating the email template.
const EMAILJS_CONFIG = Object.freeze({
  publicKey: 'c3jH0aW9Rzzdge_6F',
  serviceId: 'service_q0pdy1n',
  templateId: 'template_vy1imab',
  recipient: 'acaeacademiaagile@gmail.com'
});

firebase.initializeApp(FIREBASE_CONFIG);
const firebaseAuth = firebase.auth();
const firestore = firebase.firestore();
const firebaseAnalytics = firebase.analytics();
firebaseAnalytics.setAnalyticsCollectionEnabled(false);
if (EMAILJS_CONFIG.publicKey && window.emailjs) window.emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
const firebaseUser = (user) => user && user.uid ? { id: user.uid, email: user.email || '' } : null;
const isAdminUser = () => Boolean(firebaseAuth.currentUser && firebaseAuth.currentUser.email === ADMIN_EMAIL && firebaseAuth.currentUser.emailVerified);

const sb = {
  async signUp(email, pass) {
    try { return { user: firebaseUser((await firebaseAuth.createUserWithEmailAndPassword(email, pass)).user) }; }
    catch (error) { return { error: { message: error.code || error.message } }; }
  },

  async signIn(email, pass) {
    try { return { user: firebaseUser((await firebaseAuth.signInWithEmailAndPassword(email, pass)).user) }; }
    catch (error) { return { error: { message: error.code || error.message } }; }
  },

  async resetPassword(email) {
    try {
      await firebaseAuth.sendPasswordResetEmail(email);
      return { ok: true };
    } catch (error) {
      return { error: { message: error.code || error.message } };
    }
  },

  async signOut() {
    try { await firebaseAuth.signOut(); }
    catch (error) { Security.log('Logout request failed', { message: error.code || error.message }); }
    localStorage.removeItem('firebase_user');
    localStorage.removeItem('supa_user');
  },

  async getUser() { return firebaseUser(firebaseAuth.currentUser); },

  async upsertProfile(data) {
    if (!firebaseAuth.currentUser || data.user_id !== firebaseAuth.currentUser.uid) return null;
    await firestore.collection('profiles').doc(data.user_id).set(data, { merge: true });
    return data;
  },

  async upsertMastery(rows) {
    const user = firebaseAuth.currentUser;
    if (!user) return null;
    const batch = firestore.batch();
    rows.filter((row) => row.user_id === user.uid).forEach((row) => {
      const ref = firestore.collection('mastery').doc(user.uid).collection('concepts').doc(row.concept);
      batch.set(ref, row, { merge: true });
    });
    await batch.commit();
    return rows;
  },

  async insertSession(data) {
    const user = firebaseAuth.currentUser;
    if (!user || data.user_id !== user.uid) return null;
    return (await firestore.collection('sessions').doc(user.uid).collection('items').add(data)).id;
  },

  async getProfile(userId) {
    if (!firebaseAuth.currentUser || userId !== firebaseAuth.currentUser.uid) return null;
    const snapshot = await firestore.collection('profiles').doc(userId).get();
    return snapshot.exists ? snapshot.data() : null;
  },

  async getMastery(userId) {
    if (!firebaseAuth.currentUser || userId !== firebaseAuth.currentUser.uid) return [];
    const snapshot = await firestore.collection('mastery').doc(userId).collection('concepts').get();
    return snapshot.docs.map((doc) => doc.data());
  },

  async createSupportTicket(data) {
    const user = firebaseAuth.currentUser;
    if (!user) return null;
    const reference = firestore.collection('support').doc(user.uid).collection('tickets').doc();
    const ticket = { ...data, user_id: user.uid, email: user.email || '' };
    await reference.set(ticket);
    return { id: reference.id, ...ticket };
  },

  async sendSupportEmail(ticket) {
    if (!window.emailjs || !EMAILJS_CONFIG.publicKey || !EMAILJS_CONFIG.serviceId || !EMAILJS_CONFIG.templateId) {
      return { sent: false, configured: false, reason: 'EmailJS não está configurado ou o SDK não carregou.' };
    }
    try {
      await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
        to_email: EMAILJS_CONFIG.recipient,
        from_email: ticket.email,
        ticket_id: ticket.id,
        category: ticket.category,
        subject: ticket.subject,
        description: ticket.description,
        created_at: ticket.created_at,
        reply_to: ticket.email
      });
      return { sent: true, configured: true };
    } catch (error) {
      Security.log('Support email failed', { message: error.message });
      return { sent: false, configured: true, reason: error.text || error.message || 'EmailJS rejeitou o envio.' };
    }
  },

  async getSupportTickets(userId) {
    if (!firebaseAuth.currentUser || userId !== firebaseAuth.currentUser.uid) return [];
    const snapshot = await firestore.collection('support').doc(userId).collection('tickets').orderBy('created_at', 'desc').limit(10).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, path: doc.ref.path, ...doc.data() }));
  },

  async getAdminTickets() {
    if (!isAdminUser()) return [];
    const snapshot = await firestore.collectionGroup('tickets').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, path: doc.ref.path, ...doc.data() }))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  },

  async updateAdminTicket(ticket, response, status) {
    if (!isAdminUser() || !ticket?.path) return false;
    await firestore.doc(ticket.path).update({ response: String(response || '').trim(), status, answered_at: new Date().toISOString() });
    return true;
  },

  async submitRequesterReply(ticket, reply) {
    const user = firebaseAuth.currentUser;
    if (!user || !ticket?.path || ticket.user_id !== user.uid || ticket.status === 'closed') {
      return { ok: false, reason: 'Chamado inválido ou já encerrado.' };
    }
    const trimmed = String(reply || '').trim();
    if (trimmed.length < 3) {
      return { ok: false, reason: 'Sua resposta deve ter pelo menos 3 caracteres.' };
    }
    try {
      await firestore.doc(ticket.path).update({
        requester_reply: trimmed,
        status: 'answered',
        requester_replied_at: new Date().toISOString()
      });
      return { ok: true };
    } catch (error) {
      Security.log('Support requester reply failed', { message: error.message });
      return { ok: false, reason: error.message || 'Não foi possível enviar sua resposta.' };
    }
  },

  async closeSupportTicket(ticket) {
    const user = firebaseAuth.currentUser;
    if (!user || !ticket?.path || ticket.user_id !== user.uid || ticket.status === 'closed') return { ok: false, reason: 'Chamado inválido ou já encerrado.' };
    try {
      await firestore.doc(ticket.path).update({ status: 'closed', closed_at: new Date().toISOString() });
      return { ok: true };
    } catch (error) {
      Security.log('Support ticket close failed', { message: error.message });
      return { ok: false, reason: error.message || 'Falha de permissão ou conexão.' };
    }
  },

  async clearProgress(userId) {
    const user = firebaseAuth.currentUser;
    if (!user || user.uid !== userId) return false;
    const paths = [
      firestore.collection('mastery').doc(userId).collection('concepts'),
      firestore.collection('sessions').doc(userId).collection('items')
    ];
    for (const collection of paths) {
      const snapshot = await collection.get();
      let batch = firestore.batch();
      let count = 0;
      for (const document of snapshot.docs) {
        batch.delete(document.ref);
        count += 1;
        if (count === 400) {
          await batch.commit();
          batch = firestore.batch();
          count = 0;
        }
      }
      if (count) await batch.commit();
    }
    return true;
  },

  async deleteAccount(userId) {
    const user = firebaseAuth.currentUser;
    if (!user || user.uid !== userId) return false;

    const paths = [
      firestore.collection('mastery').doc(userId).collection('concepts'),
      firestore.collection('sessions').doc(userId).collection('items'),
      firestore.collection('support').doc(userId).collection('tickets')
    ];
    for (const collection of paths) {
      const snapshot = await collection.get();
      let batch = firestore.batch();
      let count = 0;
      for (const document of snapshot.docs) {
        batch.delete(document.ref);
        count += 1;
        if (count === 400) {
          await batch.commit();
          batch = firestore.batch();
          count = 0;
        }
      }
      if (count) await batch.commit();
    }

    await firestore.collection('profiles').doc(userId).delete();
    await user.delete();
    localStorage.removeItem('firebase_user');
    localStorage.removeItem('analytics-consent');
    firebaseAnalytics.setAnalyticsCollectionEnabled(false);
    return true;
  }
};

let currentUser = null;

// Restores the Firebase session and uses local storage only as a display fallback.
async function loadAuth() {
  await new Promise((resolve) => {
    const unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
      currentUser = firebaseUser(user);
      if (currentUser) localStorage.setItem('firebase_user', JSON.stringify(currentUser));
      else localStorage.removeItem('firebase_user');
      unsubscribe();
      resolve();
    });
  });
}

const BANK_RAW=[
{diff:1,cat:"Flow Metrics",concept:"Lead Time",q:"O que mede o Lead Time em um sistema Kanban?",opts:["Tempo de trabalho ativo do time","Tempo total do pedido à entrega","Itens entregues por semana","Bugs em produção"],ans:1,xp:15,exp:"Lead Time começa quando o cliente solicita o item e termina quando é entregue. Inclui filas, espera e trabalho ativo. É a métrica que o cliente realmente sente.",vid:{t:"Lead Time vs Cycle Time in Kanban",u:"https://www.youtube.com/watch?v=xm7t7OJGps4"}},
{diff:1,cat:"Flow Metrics",concept:"Cycle Time",q:"O que é Cycle Time?",opts:["Duração de uma sprint","Tempo em que o time trabalha ativamente no item até Done","Quantidade de ciclos por mês","Duração de uma cerimônia Scrum"],ans:1,xp:15,exp:"Cycle Time começa quando o time toca ativamente o item (In Progress) e termina em Done. É menor que o Lead Time, que inclui espera no backlog.",vid:{t:"Lead Time vs Cycle Time in Kanban",u:"https://www.youtube.com/watch?v=xm7t7OJGps4"}},
{diff:1,cat:"Flow Metrics",concept:"WIP",q:"WIP (Work In Progress) representa o quê no board Kanban?",opts:["Itens concluídos na semana","Itens em andamento simultâneo no fluxo","Total do backlog","Membros ativos do time"],ans:1,xp:15,exp:"WIP é a quantidade de itens sendo trabalhados ao mesmo tempo. WIP alto = multitasking excessivo = lead time longo = baixa previsibilidade.",vid:{t:"Kanban e o Limite de WIP",u:"https://www.youtube.com/watch?v=tINK8GXgPIk"}},
{diff:1,cat:"Flow Metrics",concept:"Throughput",q:"O que mede o Throughput de um time ágil?",opts:["Tempo de entrega por item","Quantidade de itens entregues por unidade de tempo","Eficiência do processo em %","Número de bloqueios"],ans:1,xp:15,exp:"Throughput = itens entregues / semana. É a taxa de saída real do sistema. Diferente de Velocity (story points subjetivos), Throughput conta apenas itens concluídos.",vid:{t:"WIP — Work in Progress, o que é?",u:"https://www.youtube.com/watch?v=OfrGQtFa3lU"}},
{diff:1,cat:"Flow Metrics",concept:"Flow Efficiency",q:"O que é Flow Efficiency?",opts:["Eficiência de código em linhas/hora","% do Lead Time com trabalho ativo (vs. espera)","Features entregues por sprint","Taxa de aproveitamento de reuniões"],ans:1,xp:15,exp:"Flow Efficiency = Tempo ativo ÷ Lead Time total. Se um item leva 10 dias mas só 2 tiveram trabalho ativo, a FE é 20%. Média de mercado: 15-40%.",vid:{t:"Lead Time VS Cycle Time — DevOps and Kanban",u:"https://www.youtube.com/watch?v=fRqUhj3mj70"}},
{diff:1,cat:"Scrum",concept:"Velocity",q:"O que é Velocity no Scrum?",opts:["Velocidade física do time","Soma de story points entregues por sprint","Número de deploys/semana","Tempo médio da daily"],ans:1,xp:15,exp:"Velocity é a soma de story points dos itens Done ao final de cada sprint. Serve para planejamento interno. Nunca deve ser usada para comparar times.",vid:{t:"Agile Story Points & Velocity Explained",u:"https://www.youtube.com/watch?v=Und8DgcUQf8"}},
{diff:1,cat:"Scrum",concept:"Sprint Goal",q:"O que é Sprint Goal?",opts:["Número de story points planejados","Objetivo de negócio que a sprint deve atingir","Data de término da sprint","Lista de itens do Sprint Backlog"],ans:1,xp:15,exp:"Sprint Goal é o objetivo de negócio da sprint — a razão de existir daquele conjunto de trabalho. Um bom Sprint Goal orienta as decisões do time quando algo inesperado acontece.",vid:{t:"Sprint Goal — como escrever",u:"https://www.youtube.com/results?search_query=Sprint+Goal+Scrum+how+to+write"}},
{diff:1,cat:"Scrum",concept:"Definition of Done",q:"O que é Definition of Done (DoD)?",opts:["Lista de tarefas de um item","Critérios que um item DEVE atender para ser considerado completo","Data de entrega da sprint","Número mínimo de testes"],ans:1,xp:15,exp:"DoD é um acordo formal sobre o que 'Done' significa para o time. Itens que não atendem à DoD não podem ser considerados prontos.",vid:{t:"Definition of Done — Scrum Guide",u:"https://www.youtube.com/results?search_query=Definition+of+Done+Scrum+Guide"}},
{diff:1,cat:"Kanban",concept:"WIP limits",q:"O que é um WIP limit?",opts:["Número máximo de membros no time","Quantidade máxima de itens em andamento num estado","Prazo máximo de entrega","Limite de bugs por sprint"],ans:1,xp:15,exp:"WIP limit é o número máximo de itens permitidos em andamento num estado. Quando atingido, nenhum item novo pode entrar naquele estado até que um saia. Isso cria pull e expõe gargalos.",vid:{t:"Kanban e o Limite de WIP",u:"https://www.youtube.com/watch?v=tINK8GXgPIk"}},
{diff:1,cat:"EBM",concept:"EBM - Current Value",q:"Quantos Key Value Areas (KVAs) o EBM possui?",opts:["2","3","4","5"],ans:2,xp:15,exp:"EBM tem 4 KVAs: Current Value (CV), Unrealized Value (UV), Time to Market (T2M) e Ability to Innovate (A2I). Cada um mede um ângulo diferente do valor entregue.",vid:{t:"EBM — Evidence-Based Management",u:"https://www.youtube.com/results?search_query=EBM+Evidence+Based+Management+Scrum"}},
{diff:1,cat:"DORA",concept:"DORA - Deployment Frequency",q:"O que é MTTR no contexto DORA/SRE?",opts:["Minimum Time To Release","Mean Time To Restore — tempo médio para restaurar serviço após incidente","Maximum Throughput To Release","Monthly Time To Review"],ans:1,xp:15,exp:"MTTR (Mean Time to Restore) mede o tempo médio desde a detecção do incidente até a restauração completa do serviço. Times de elite DORA: MTTR < 1 hora.",vid:{t:"DORA Metrics Explained",u:"https://www.youtube.com/shorts/6UrG6FvtSik"}},
{diff:1,cat:"Kanban",concept:"Políticas explícitas de priorização",q:"O que é uma política explícita no Kanban?",opts:["Regra secreta do gestor","Regras visíveis e acordadas pelo time sobre como o trabalho flui no board","Um SLA com o cliente","Uma política de RH"],ans:1,xp:15,exp:"Políticas explícitas são regras VISÍVEIS no board que governam como o trabalho entra, flui e sai. Ex: 'Só entram itens com critérios de aceite definidos'. Tornam o processo transparente.",vid:{t:"Kanban Explicit Policies",u:"https://www.youtube.com/results?search_query=Kanban+explicit+policies+prioritization"}},
{diff:1,cat:"Melhoria Contínua",concept:"PDCA",q:"O que é o ciclo PDCA aplicado a times ágeis?",opts:["Plan-Deploy-Check-Archive","Plan-Do-Check-Act — ciclo de melhoria contínua: planejar, executar, medir, ajustar","People-Data-Coach-Adapt","Product-Delivery-Ceremony-Assessment"],ans:1,xp:15,exp:"PDCA (Deming): Plan (definir hipótese de melhoria), Do (experimentar), Check (medir resultado com dados), Act (padronizar se funcionou). É o ciclo de aprendizado das retrospectivas eficazes.",vid:{t:"PDCA — Ciclo de melhoria contínua",u:"https://www.youtube.com/results?search_query=PDCA+continuous+improvement+agile"}},
{diff:1,cat:"Histórias de Usuário",concept:"INVEST",q:"O que é o critério INVEST para User Stories?",opts:["Indicador de valor de negócio","Acrônimo que define boas histórias: Independent, Negotiable, Valuable, Estimable, Small, Testable","Framework de estimativa em poker","Checklist de aceite para deploy"],ans:1,xp:15,exp:"INVEST: Independent (sem dependências fortes), Negotiable (o como é discutível), Valuable (entrega valor real), Estimable (equipe consegue estimar), Small (cabe numa sprint), Testable (tem critérios claros).",vid:{t:"INVEST User Stories",u:"https://www.youtube.com/results?search_query=INVEST+user+stories+Agile"}},
// diff 2
{diff:2,cat:"Lei de Little",concept:"Lei de Little",q:"Lei de Little: Lead Time = WIP ÷ Throughput. Se WIP = 20 e Throughput = 4/semana, qual o Lead Time?",opts:["4 semanas","5 semanas","80 semanas","16 dias"],ans:1,xp:25,exp:"20 ÷ 4 = 5 semanas. A Lei de Little é matemática — não é estimativa. Se reduzir WIP para 12 mantendo throughput, Lead Time cai para 3 semanas.",vid:{t:"Lei de Little — Kanban",u:"https://www.youtube.com/watch?v=CdI6J7bhWpU"}},
{diff:2,cat:"CFD",concept:"CFD",q:"No CFD (Cumulative Flow Diagram), faixas paralelas de largura constante indicam:",opts:["Gargalo crítico","Fluxo saudável e estável — entradas e saídas equilibradas","Scope creep crescente","Throughput zero"],ans:1,xp:25,exp:"Faixas paralelas com largura constante = fluxo em equilíbrio: taxa de entrada ≈ taxa de saída. Lead Time estável e previsível. Qualquer faixa engrossando sinaliza gargalo.",vid:{t:"Cumulative Flow Diagram Explained",u:"https://www.youtube.com/watch?v=o260BbRb63E"}},
{diff:2,cat:"Flow Metrics",concept:"Flow Efficiency",q:"Flow Efficiency de 20% significa que:",opts:["20% dos itens entregues no prazo","80% do tempo o item estava esperando em filas ou bloqueios","Time 20% abaixo da capacidade","20 bugs por sprint"],ans:1,xp:25,exp:"Flow Efficiency = Tempo ativo / Lead Time total. 20% significa que apenas 1/5 do tempo houve trabalho ativo. Os outros 80% foram espera.",vid:{t:"Lead Time VS Cycle Time — DevOps and Kanban",u:"https://www.youtube.com/watch?v=fRqUhj3mj70"}},
{diff:2,cat:"Scrum",concept:"Velocity",q:"Qual a principal vantagem do Burnup Chart em relação ao Burndown?",opts:["Mais fácil de configurar no Jira","Mostra escopo total e mudanças nele, tornando scope creep visível","Conta bugs e dívida técnica","Funciona com story points > 5"],ans:1,xp:25,exp:"Burnup mostra duas linhas: trabalho concluído (sobe) e escopo total. Quando o scope creep acontece, a linha de escopo sobe — visível para todos. O Burndown esconde isso.",vid:{t:"Burnup Chart and Burndown Chart in Scrum",u:"https://www.youtube.com/watch?v=4J7fbgLk_ZQ"}},
{diff:2,cat:"SLE & Percentis",concept:"SLE",q:"O SLE (Service Level Expectation) usa qual percentil como referência padrão?",opts:["Percentil 50 (mediana)","Percentil 75","Percentil 85","Percentil 99"],ans:2,xp:25,exp:"O P85 é o padrão do SLE: '85% dos itens deste tipo são entregues em até X dias.' Usar P85 em vez de P50 dá uma garantia mais robusta — apenas 15% dos itens ultrapassarão o prazo.",vid:{t:"Service Level Expectation — SLE Kanban",u:"https://www.youtube.com/results?search_query=Service+Level+Expectation+SLE+Kanban"}},
{diff:2,cat:"DORA",concept:"DORA - Change Failure Rate",q:"Times de elite DORA têm Change Failure Rate (CFR) de quanto?",opts:["Menos de 5%","Entre 16% e 30%","Entre 31% e 45%","Acima de 60%"],ans:0,xp:25,exp:"Times de elite têm CFR < 5%. Times de baixo desempenho chegam a 46-60%. Em fintech, cada falha de deploy pode impactar transações — CFR deve ser monitorado como métrica de negócio.",vid:{t:"DORA — Change Failure Rate",u:"https://www.youtube.com/results?search_query=DORA+Change+Failure+Rate+DevOps"}},
{diff:2,cat:"EBM",concept:"EBM - Current Value",q:"No EBM, o Current Value (CV) é representado por qual conjunto de métricas?",opts:["Velocity e story points","NPS, satisfação do cliente, receita e retenção","Frequência de deploy e Lead Time","Code coverage e dívida técnica"],ans:1,xp:25,exp:"CV mede o valor que o produto entrega HOJE. Métricas: NPS, taxa de retenção, CSAT, receita recorrente. CV é sempre visto pelos olhos do cliente — não do processo interno.",vid:{t:"EBM Current Value — KVA",u:"https://www.youtube.com/results?search_query=EBM+Current+Value+Scrum+KVA"}},
{diff:2,cat:"Estatística",concept:"Média, mediana e outliers",q:"O que é a mediana de Cycle Time e por que é preferível à média?",opts:["Soma dividida pela quantidade","Valor central da distribuição ordenada — mais robusta que a média pois não é distorcida por outliers","Sempre igual ao P85","Útil só para distribuições simétricas"],ans:1,xp:25,exp:"Se 90% dos itens levam 5 dias e 10% levam 60 dias, a média pode ser 10 dias — representando poucos itens reais. A mediana (P50) representa melhor a experiência típica.",vid:{t:"Mean vs Median — Statistics for Agile",u:"https://www.youtube.com/results?search_query=mean+median+outliers+statistics+kanban"}},
{diff:2,cat:"Estatística",concept:"Variabilidade",q:"Por que reduzir variabilidade do Cycle Time é mais valioso que reduzir a média?",opts:["A variabilidade é o número total de dias","Variabilidade (desvio-padrão) mede dispersão — alta variabilidade = previsões menos confiáveis, independente da média","A variabilidade é o número de outliers acima do P85","Variabilidade e média são indicadores equivalentes"],ans:1,xp:25,exp:"Um time que sempre entrega em 5-7 dias (baixa variabilidade) é mais previsível que um que entrega em 2 ou 20 dias (alta variabilidade), mesmo que ambos tenham a mesma média.",vid:{t:"Process Variability — Agile Flow",u:"https://www.youtube.com/results?search_query=process+variability+agile+flow+kanban"}},
{diff:2,cat:"Kanban e Priorização",concept:"Política Expedite",q:"Em qual situação a classe Expedite pode ser usada no Kanban?",opts:["Para itens que podem esperar até a próxima revisão","Para itens urgentes que podem ultrapassar o limite de WIP","Para itens que precisam apenas de aprovação do PO","Para itens planejados para a próxima Sprint"],ans:1,xp:25,exp:"Expedite é para emergências reais, como incidente em produção ou compliance crítico. Pode violar o limite de WIP, mas deve ser rara para não desorganizar o fluxo.",vid:{t:"Kanban Expedite Policy",u:"https://www.youtube.com/results?search_query=Kanban+Expedite+class+of+service"}},
{diff:2,cat:"Melhoria Contínua",concept:"Pareto",q:"O que é o Diagrama de Pareto e como se usa em retrospectivas de fluxo?",opts:["Diagrama de pizza de bugs","Gráfico de barras decrescente que identifica quais categorias geram 80% dos problemas — priorizando onde atuar","Gráfico de velocidade acumulada","Radar de skills do time"],ans:1,xp:25,exp:"Princípio de Pareto (80/20): 80% dos problemas vêm de 20% das causas. No fluxo: se 70% dos bloqueios vêm de 'aguardando aprovação', atacar essa causa tem 10x mais impacto.",vid:{t:"Diagrama de Pareto",u:"https://www.youtube.com/results?search_query=Pareto+chart+continuous+improvement"}},
{diff:2,cat:"Histórias de Usuário",concept:"Critérios de aceitação",q:"O que são critérios de aceitação e por que são essenciais?",opts:["Estimativas de esforço","Condições específicas e testáveis que uma story deve atender para ser aceita pelo PO","Aprovações formais de compliance","Critérios de contratação"],ans:1,xp:25,exp:"Critérios de aceitação transformam ambiguidade em clareza testável. Sem critérios, o time pode implementar algo tecnicamente correto mas não o que o cliente esperava — causando retrabalho.",vid:{t:"User Story Acceptance Criteria",u:"https://www.youtube.com/results?search_query=user+story+acceptance+criteria+agile"}},
{diff:2,cat:"Histórias de Usuário",concept:"Estrutura de User Story",q:"O que é a estrutura 'Como [persona], Quero [ação], Para [valor]'?",opts:["Template de bug report","Formato que captura: quem se beneficia, o que acontece, e por que — orientando ao valor de negócio","Especificação técnica de sistema","Formato de Sprint Goal"],ans:1,xp:25,exp:"A estrutura de User Story (Mike Cohn) garante o 'porquê'. O 'Para' é o valor real — sem ele, o time pode implementar sem entender o propósito. Ex: 'Para agir antes que a janela de denúncia ao regulador expire.'",vid:{t:"User Stories — como escrever bem",u:"https://www.youtube.com/results?search_query=user+stories+how+to+write+agile"}},
// diff 3
{diff:3,cat:"Lei de Little",concept:"Lei de Little",q:"Time SRE entrega 6 itens/semana com WIP=18. Para reduzir o Lead Time pela metade mantendo Throughput, qual deve ser o novo WIP?",opts:["9 itens","12 itens","3 itens","6 itens"],ans:0,xp:35,exp:"LT atual = 18 ÷ 6 = 3 semanas. Para LT = 1,5 semana: WIP = LT × Throughput = 1,5 × 6 = 9 itens. Exige WIP limits disciplinados e cultura de terminar antes de começar.",vid:{t:"Lei de Little — cálculo prático",u:"https://www.youtube.com/watch?v=CdI6J7bhWpU"}},
{diff:3,cat:"Aging WIP",concept:"Aging WIP",q:"O Aging WIP cruza o percentil 85 do Cycle Time histórico. O que isso indica e qual a ação correta?",opts:["Item performando bem — manter","Item em risco de outlier — investigar bloqueios e fazer 'swarm'","Item deve ser cancelado automaticamente","WIP limit foi violado"],ans:1,xp:35,exp:"Quando um item supera o P85 do Cycle Time, está na cauda da distribuição. Ação imediata: investigar bloqueios, fazer 'swarm' (todos focam), comunicar proativamente o stakeholder.",vid:{t:"Aging WIP — Kanban",u:"https://www.youtube.com/results?search_query=Aging+WIP+Kanban+outliers"}},
{diff:3,cat:"Monte Carlo",concept:"Monte Carlo",q:"A Simulação de Monte Carlo usa qual dado histórico para prever datas de entrega?",opts:["Média de story points das últimas 10 sprints","Distribuição histórica do Throughput semanal","Cycle Time médio dividido pelo número de devs","Velocity multiplicada pelo WIP médio"],ans:1,xp:35,exp:"Monte Carlo usa a distribuição real de Throughput (itens entregues/semana nos últimos 3 meses) para simular milhares de cenários. Resultado: '85% de chance de entregar 50 itens em 9 semanas.'",vid:{t:"Monte Carlo Forecasting in KanbanFlow",u:"https://www.youtube.com/watch?v=DBW5Sk6DK2o"}},
{diff:3,cat:"CFD",concept:"CFD",q:"No CFD, como você identifica visualmente o Lead Time de um item?",opts:["Pela altura total do eixo Y","Pela distância horizontal entre a entrada e saída de um estado no eixo do tempo","Pela largura vertical de todas as faixas","Pela inclinação da linha de Done"],ans:1,xp:35,exp:"No CFD a distância horizontal entre o momento que um item entrou num estado e o momento que saiu = Lead Time naquele estado. O CFD contém LT, WIP e Throughput num único gráfico.",vid:{t:"CFD — leitura avançada",u:"https://www.youtube.com/watch?v=-ElzoFV2QBI"}},
{diff:3,cat:"Scrum",concept:"Velocity",q:"Por que Velocity baseada em story points é arriscada como KPI de desempenho?",opts:["Jira não suporta story points","Cria incentivo para inflar estimativas e esconde problemas de qualidade e fluxo","Story points só funcionam para times Kanban","Scrum.org proibiu story points em 2023"],ans:1,xp:35,exp:"Quando Velocity vira KPI, times aprendem a jogá-la: estimam conservadoramente, dividem stories grandes. Velocity sobe, mas Lead Time e qualidade pioram. Throughput (itens/semana) é mais honesto.",vid:{t:"Story Points & Velocity — os riscos",u:"https://www.youtube.com/watch?v=HmtNG3YZWwk"}},
{diff:3,cat:"EBM",concept:"EBM - Ability to Innovate",q:"A A2I (Ability to Innovate) no EBM diminui principalmente quando:",opts:["Time entrega muitos story points","Alta dívida técnica, incidentes recorrentes e retrabalho consomem a capacidade do time","PO prioriza features de alto valor","Time adota pair programming"],ans:1,xp:35,exp:"A2I mede quanto da capacidade real está disponível para inovar. Dívida técnica, incidentes (baixo MTBF) e retrabalho corroem a A2I. MTBF, Deployment Frequency e % tempo em bugfix são bons proxies.",vid:{t:"EBM — Ability to Innovate (A2I)",u:"https://www.youtube.com/results?search_query=EBM+Ability+to+Innovate+A2I"}},
{diff:3,cat:"DORA",concept:"DORA - Deployment Frequency",q:"MTTR (Mean Time to Restore) mede qual aspecto da operação?",opts:["Tempo médio entre deploys","Tempo médio para restaurar o serviço após incidente em produção","Frequência de post-mortems","Taxa de mudanças rejeitadas em code review"],ans:1,xp:35,exp:"MTTR é o tempo desde a detecção do incidente até a restauração do serviço. Times de elite DORA: MTTR < 1 hora. Baixo MTTR indica runbooks documentados, automação de rollback e blameless post-mortem.",vid:{t:"DORA Metrics — MTTR e SRE",u:"https://www.youtube.com/shorts/6UrG6FvtSik"}},
{diff:3,cat:"Kanban e Priorização",concept:"Classes de serviço",q:"O que são classes de serviço no Kanban?",opts:["Categorias de qualidade de código","Categorias de itens com diferentes políticas de priorização e SLEs","Níveis de acesso ao board","Tipos de reuniões de planejamento"],ans:1,xp:35,exp:"Classes de serviço (Expedite, Fixed Date, Standard, Intangible) permitem tratar itens diferentes de forma diferente. Um item Expedite pode violar WIP limits. Cada classe tem seu próprio SLE e política.",vid:{t:"Kanban Classes of Service",u:"https://www.youtube.com/results?search_query=Kanban+classes+of+service"}},
{diff:3,cat:"Estatística",concept:"Coeficiente de variação",q:"O que é o coeficiente de variação (CV) e como se interpreta num histograma de Cycle Time?",opts:["Custo de variação do projeto","CV = desvio-padrão ÷ média. CV > 1 indica alta variabilidade relativa — processo instável","CV = máximo - mínimo do histograma","CV = percentual de itens acima do P85"],ans:1,xp:35,exp:"CV < 0.5 = processo estável (boa base para SLE). CV entre 0.5-1 = moderadamente variável. CV > 1 = processo instável — provavelmente há outliers sistêmicos. Ação: investigar causas de variação antes de comprometer SLEs.",vid:{t:"Coefficient of Variation — Statistics",u:"https://www.youtube.com/results?search_query=coefficient+of+variation+statistics"}},
{diff:3,cat:"Melhoria Contínua",concept:"5 Porquês",q:"Como os 5 Porquês se aplicam na análise de um item com Aging WIP muito alto?",opts:["São usados para estimar story points","Perguntando 'por quê' iterativamente até chegar à causa raiz — cada iteração aprofunda a análise além do sintoma","Determinam quem culpar pelo atraso","São uma técnica de estimativa do SAFe"],ans:1,xp:35,exp:"5 Porquês (Sakichi Toyoda): cada 'por quê' leva a uma causa mais profunda. Um item com Aging WIP alto tem um SINTOMA ('está bloqueado') mas a causa raiz pode ser: política de aprovação, falta de critérios, processo não revisado.",vid:{t:"5 Porquês — Root Cause Analysis",u:"https://www.youtube.com/results?search_query=5+Whys+root+cause+analysis"}},
{diff:3,cat:"Melhoria Contínua",concept:"Ishikawa",q:"O que é o Diagrama de Ishikawa e como se usa em times ágeis?",opts:["Gráfico de tendência de Lead Time","Diagrama de causa-e-efeito (espinha de peixe) para identificar causas raiz de problemas recorrentes","Diagrama de fluxo do processo","Mapa de skills do time"],ans:1,xp:35,exp:"Ishikawa (espinha de peixe) mapeia causas possíveis de um problema em categorias (pessoas, processo, tecnologia). Em times ágeis, é usado na retrospectiva para ir além dos sintomas e encontrar causas raiz.",vid:{t:"Diagrama de Ishikawa",u:"https://www.youtube.com/results?search_query=Ishikawa+fishbone+root+cause"}},
{diff:3,cat:"Kanban e Priorização",concept:"Replenishment",q:"O que é Replenishment Meeting e como garante que o backlog alimente o fluxo de forma saudável?",opts:["Retrospectiva quinzenal do backlog","Cadência onde o time decide quais itens entram no fluxo respeitando WIP limits, classes de serviço e capacidade disponível","Sprint Planning adaptado para Kanban","Revisão do roadmap com stakeholders"],ans:1,xp:35,exp:"Replenishment Meeting: o time olha a capacidade disponível (WIP limit - itens atuais), revisa os itens candidatos do backlog (priorizados por CoD, classe de serviço) e seleciona apenas o que cabe. Mantém o pull saudável.",vid:{t:"Kanban Replenishment Meeting",u:"https://www.youtube.com/results?search_query=Kanban+replenishment+meeting"}},
{diff:3,cat:"Histórias de Usuário",concept:"Fatiamento vertical",q:"O que é fatiamento vertical de histórias (Vertical Slicing)?",opts:["Dividir por camadas técnicas (front, back, banco)","Dividir pelo valor de negócio entregável — cada fatia atravessa todas as camadas técnicas e entrega valor independente","Separar bugs de features no backlog","Dividir stories > 8 pontos em tasks técnicas"],ans:1,xp:35,exp:"Fatiamento vertical: cada fatia atravessa todas as camadas e entrega valor independente. Oposto ao fatiamento horizontal (por camada técnica, sem valor isolado). Histórias verticais entram no sprint e podem ser testadas pelo usuário.",vid:{t:"Vertical Slicing — User Stories",u:"https://www.youtube.com/results?search_query=vertical+slicing+user+stories"}},
{diff:3,cat:"Flow Metrics",concept:"Flow Efficiency",q:"Como calcular a Flow Efficiency usando dados do Jira?",opts:["FE = Story Points ÷ Dias de sprint","FE = ΣTempo ativo (In Progress + In Review) ÷ Lead Time total × 100","FE = Throughput ÷ WIP × 100","FE = Itens concluídos ÷ Total de itens criados × 100"],ans:1,xp:35,exp:"Para calcular no Jira: some o tempo nos estados ativos (In Progress, In Review, In QA) e divida pelo Lead Time total. A maioria dos dashboards de fluxo (ActionableAgile, LinearB) calcula automaticamente. Valor típico em fintechs: 10-20%.",vid:{t:"Flow Efficiency — cálculo no Jira",u:"https://www.youtube.com/results?search_query=Flow+Efficiency+Jira+calculation+Kanban"}},
{diff:3,cat:"Melhoria Contínua",concept:"Experimentos de melhoria",q:"O que é um experimento de melhoria bem desenhado no contexto ágil?",opts:["Qualquer mudança de processo na próxima sprint","Um experimento tem: hipótese clara, métrica de sucesso definida antes, duração limitada, e apenas UMA mudança por vez para isolar o efeito","Uma reunião de inovação trimestral","Apenas para times de P&D"],ans:1,xp:35,exp:"Experimento eficaz: 'Hipótese: se limitarmos WIP em Review para 3, o Cycle Time médio cairá 20% em 4 semanas.' Múltiplas mudanças simultâneas = impossível saber qual funcionou. Experimentos isolados = aprendizado real.",vid:{t:"Experiments in Agile — melhoria contínua",u:"https://www.youtube.com/results?search_query=continuous+improvement+experiment+agile+kanban"}},
// diff 4
{diff:4,cat:"Monte Carlo",concept:"Monte Carlo",q:"Qual a diferença entre usar P50 e P85 em uma previsão Monte Carlo para comprometer data com stakeholders?",opts:["Nenhuma — nomes diferentes","P50 significa 50% de chance de cumprir (falhará metade das vezes); P85 significa 85% de chance — muito mais seguro para compromissos externos","P85 é sempre 2x mais lento que P50","P50 para Scrum e P85 só para Kanban"],ans:1,xp:45,exp:"P50 (mediana) = você cumprirá o prazo em 50% dos cenários — como lançar uma moeda. Para compromissos externos, P85 é o mínimo. Para releases com reguladores em fintech, P95 pode ser mais adequado.",vid:{t:"Monte Carlo — percentil certo",u:"https://www.youtube.com/watch?v=DBW5Sk6DK2o"}},
{diff:4,cat:"Flow Metrics",concept:"CFD",q:"Em um sistema Kanban maduro, qual combinação de métricas fornece a visão mais completa?",opts:["Velocity + Burndown + Story Points","CFD + Aging WIP + Monte Carlo + SLE + Throughput Scatter Plot","Lead Time médio + Bugs + Satisfação","Deployment Frequency + NPS + Sprint Goal"],ans:1,xp:45,exp:"A combinação completa: CFD (saúde do fluxo), Aging WIP (risco em itens), Monte Carlo (previsão probabilística), SLE (compromisso com cliente) e Throughput Scatter Plot (variabilidade). Nenhuma métrica isolada conta a história completa.",vid:{t:"Kanban Metrics — kit completo",u:"https://www.youtube.com/watch?v=o260BbRb63E"}},
{diff:4,cat:"SLE & Percentis",concept:"SLE",q:"Time tem Cycle Time P85=12 dias. SLE='85% em até 12 dias'. Um item está há 14 dias em andamento. Qual a ação correta?",opts:["Aguardar — 14 dias próximo do esperado","Encerrar o item e recriar","Ativar protocolo: SLE violado — investigar bloqueio, fazer swarm e comunicar proativamente o stakeholder","Recalcular o SLE com os últimos 30 dias"],ans:2,xp:45,exp:"14 dias > P85 (12 dias): o time falhou o compromisso de serviço. A ação é imediata: investigar bloqueios, fazer 'swarm', comunicar proativamente. Aging WIP acima do SLE é alarme de qualidade de fluxo.",vid:{t:"SLE — Service Level Expectation na prática",u:"https://www.youtube.com/results?search_query=Service+Level+Expectation+SLE+Kanban"}},
{diff:4,cat:"EBM",concept:"EBM - Unrealized Value",q:"Como o Unrealized Value (UV) do EBM orienta a estratégia de product discovery?",opts:["UV mede código não deployado","UV é o gap entre a satisfação atual do cliente e a satisfação máxima possível — revela onde investir para capturar mais valor","UV conta features canceladas no backlog","UV é sinônimo de dívida técnica"],ans:1,xp:45,exp:"UV é a oportunidade não capturada: o que o produto PODERIA gerar se atendesse plenamente as necessidades. Métricas: pesquisas de satisfação máxima, análise de churn, features de concorrentes que você não tem.",vid:{t:"EBM — Unrealized Value",u:"https://www.youtube.com/results?search_query=EBM+Unrealized+Value+Scrum"}},
{diff:4,cat:"DORA",concept:"DORA - Deployment Frequency",q:"Time Cloud/SRE tem Deployment Frequency de 1 deploy por quinzena e MTTR de 4 horas. Qual o nível DORA e o principal risco?",opts:["Elite — MTTR < 1 dia é excelente","Médio/Low — deploys quinzenais são em lote com alto risco de falha em cascata","Alto desempenho — 1 deploy seguro é melhor que vários com risco","DORA não se aplica a times de infra"],ans:1,xp:45,exp:"Deployment Frequency quinzenal classifica o time como Low/Medium. Deploys grandes têm CFR maior porque mais mudanças são agrupadas. A solução é CI/CD robusto, testes automatizados e feature flags.",vid:{t:"DORA — Deployment Frequency e segurança",u:"https://www.youtube.com/results?search_query=DORA+deployment+frequency+safe+DevOps"}},
{diff:4,cat:"Kanban e Priorização",concept:"Custo de atraso",q:"O que é o Custo de Atraso (Cost of Delay) e como muda a priorização?",opts:["Custo de atrasar o início de uma sprint","Valor de negócio que se perde a cada semana que uma feature não está em produção — permite priorizar pelo impacto financeiro real, não pelo esforço","Taxa de juros sobre investimento em produto","Custo de consultores para acelerar"],ans:1,xp:45,exp:"Cost of Delay (Don Reinertsen): 'Quanto custa cada semana que essa feature não existe?' Feature com CoD de R$50k/semana deve ser priorizada sobre outra com R$10k/semana, independente do esforço. WSJF usa CoD ÷ Duração.",vid:{t:"Cost of Delay — Kanban e Priorização",u:"https://www.youtube.com/results?search_query=Cost+of+Delay+Kanban+WSJF"}},
{diff:4,cat:"Estatística",concept:"Scatter plot e correlação",q:"Como um Scatter Plot de Cycle Time difere de um histograma e quando cada um é mais útil?",opts:["São gráficos idênticos com nomes diferentes","Histograma mostra distribuição de frequência; Scatter plot mostra cada item individualmente no tempo — o scatter revela padrões temporais que o histograma esconde","Scatter só funciona com mais de 100 itens","Histograma é sempre preferível"],ans:1,xp:45,exp:"Histograma: 'Qual a distribuição típica de tempo?' — bom para SLE. Scatter plot: 'Quando os outliers acontecem?' — bom para identificar eventos sistêmicos. Juntos revelam O QUÊ (histograma) e QUANDO/POR QUÊ (scatter).",vid:{t:"Scatter Plot vs Histogram — Flow Analytics",u:"https://www.youtube.com/results?search_query=scatter+plot+histogram+kanban+flow+analytics"}},
{diff:4,cat:"Histórias de Usuário",concept:"Story Mapping",q:"O que é Story Mapping e quando usar?",opts:["Forma de estimar stories em mapa mental","Técnica que organiza as stories por jornada do usuário (eixo X) e prioridade (eixo Y) — revelando o MVP para cada release","Diagrama de fluxo de dados do produto","Mapa de dependências entre épicos"],ans:1,xp:45,exp:"User Story Mapping (Jeff Patton): o eixo horizontal é a sequência de atividades do usuário (backbone); o eixo vertical é o nível de detalhe e prioridade. Fatiar horizontalmente revela o MVP de cada release.",vid:{t:"User Story Mapping — Jeff Patton",u:"https://www.youtube.com/watch?v=uj3PlPDAlHU"}},
{diff:4,cat:"Histórias de Usuário",concept:"3Cs e colaboração",q:"O que são os 3Cs de User Stories (Card, Conversation, Confirmation)?",opts:["Framework de estimativa de stories","Card é o lembrete da conversa; Conversation é o diálogo que gera o entendimento real; Confirmation são os critérios de aceite que o confirmam — juntos garantem que a história seja uma promessa de conversa","Os 3Cs definem o ciclo de vida de um sprint","Os 3Cs são uma técnica de validação de deploy"],ans:1,xp:45,exp:"Ron Jeffries: a história no cartão é apenas o lembrete da conversa que precisa acontecer. Times que tratam o cartão como especificação completa param de conversar — e perdem o alinhamento.",vid:{t:"3Cs User Stories",u:"https://www.youtube.com/results?search_query=3Cs+user+stories+conversation+confirmation"}},
{diff:4,cat:"Melhoria Contínua",concept:"Otimização sistêmica",q:"Qual é a diferença entre otimização local e sistêmica em contextos ágeis?",opts:["Local é sempre melhor — mais focada","Otimização local melhora uma parte mas pode degradar o todo; sistêmica considera o impacto em todo o fluxo — a restrição do sistema, não da etapa mais rápida","São sinônimos em ágil","Sistêmica só se aplica a times grandes"],ans:1,xp:45,exp:"TOC (Goldratt): melhorar uma etapa que não é a restrição não melhora o fluxo total. Se o gargalo é Review e você acelera Development, o WIP em Review só aumenta. Foque na restrição atual do sistema inteiro.",vid:{t:"Systems Thinking — otimização sistêmica",u:"https://www.youtube.com/results?search_query=systems+thinking+optimization+agile"}},
// diff 5
{diff:5,cat:"Agile Coaching",concept:"Flow Efficiency",q:"Como um Agile Coach usa Flow Efficiency de 12% para gerar mudança sistêmica com a liderança?",opts:["Apresenta como prova que o time precisa trabalhar mais horas","Converte em impacto financeiro: 88% do tempo é espera por aprovações/silos, quantificando o custo do SISTEMA — não do time","Usa para justificar contratação de mais devs","Apresenta como benchmark negativo comparando com outros times"],ans:1,xp:60,exp:"Coaching sistêmico: 12% de FE = 88% de desperdício gerado pelo sistema. O coach traduz: 'Cada feature que deveria levar 2 semanas leva 16 por aprovações cruzadas. Se resolvermos as dependências, lançamos 5x mais experimentos por trimestre.'",vid:{t:"Agile Coaching — métricas para liderança",u:"https://www.youtube.com/results?search_query=agile+coaching+metrics+leadership+flow"}},
{diff:5,cat:"Agile Coaching",concept:"Métricas sem comparação de times",q:"Um VP quer usar Lead Time médio como OKR de 'agilidade'. Como o coach deve responder?",opts:["Aprovar — Lead Time médio é bom","Aceitar e adicionar Velocity para balancear","Desafiar: Lead Time médio esconde variabilidade; propor P85 do Lead Time + Throughput + métrica de outcome (NPS ou T2M)","Rejeitar qualquer OKR baseado em fluxo"],ans:2,xp:60,exp:"O coach educa: Lead Time médio pode parecer estável enquanto variabilidade explode. Para OKR organizacional: P85 Lead Time (consistência) + Throughput (capacidade) + outcome (NPS, T2M). Sem outcome, otimiza processo sem resultado de negócio.",vid:{t:"OKRs e métricas ágeis",u:"https://www.youtube.com/results?search_query=OKR+agile+metrics+outcome+output"}},
{diff:5,cat:"Agile Coaching",concept:"Aging WIP",q:"Dois times com Throughput similar — Time B tem 80% do WIP concentrado em itens muito antigos. O que o coach investiga primeiro?",opts:["Adicionar mais pessoas ao Time B","Investigar dependências externas, DoD ambíguo ou política implícita de priorização que impede a conclusão","Redefinir o Sprint Goal do Time B","Comparar velocidades em story points"],ans:1,xp:60,exp:"Concentração de Aging WIP sinaliza patologia sistêmica. Causas: dependências externas não gerenciadas; DoD ambíguo; política implícita de priorização; silos técnicos. O coach facilita diagnóstico usando CFD + Aging WIP juntos.",vid:{t:"Aging WIP concentrado — diagnóstico sistêmico",u:"https://www.youtube.com/results?search_query=aging+WIP+blocked+items+Kanban+coaching"}},
{diff:5,cat:"Agile Coaching",concept:"DORA e outcomes",q:"Time SRE tem MTTR em queda (bom) mas Deployment Frequency também em queda (ruim). Como o coach interpreta?",opts:["MTTR em queda é suficiente","O time está com medo de fazer deploys após incidentes (fear-driven): deploys maiores e espaçados = maior risco = mais incidentes = ciclo vicioso","Os dados se cancelam — sistema estável","MTTR melhorou porque terceirizaram deploys"],ans:1,xp:60,exp:"Fear-driven deployment frequency: após incidentes o time fica conservador → deploys maiores → maior blast radius → mais incidentes → mais medo. O AC quebra o ciclo com: blameless post-mortem, feature flags, melhoria de CI/CD.",vid:{t:"Fear-driven deployment — SRE e DORA",u:"https://www.youtube.com/results?search_query=fear+driven+deployment+frequency+SRE"}},
{diff:5,cat:"EBM",concept:"Coaching orientado a outcomes",q:"Como o EBM pode demonstrar ROI de investimento em agilidade para um conselho executivo?",opts:["Mostrando o aumento de story points","Correlacionando melhoria em T2M e A2I com impacto mensurável em CV (receita, NPS, retenção)","Apresentando certificações ágeis do time","Comparando Velocity com outros times"],ans:1,xp:60,exp:"A narrativa EBM para o board: 'Investimos em CI/CD e reduzimos T2M de 6 semanas para 2 (A2I melhorou). Resultado em CV: +15% NPS, +8% retenção, 3x mais experimentos.' Conecta práticas ágeis a resultados de negócio.",vid:{t:"EBM — ROI da transformação ágil",u:"https://www.youtube.com/results?search_query=EBM+ROI+agile+transformation+business+outcomes"}},
{diff:5,cat:"Melhoria Contínua",concept:"Otimização sistêmica",q:"O que é 'Otimização Sistêmica' em termos de Teoria das Restrições aplicada ao Agile Coaching?",opts:["Local é sempre melhor — mais focada","O gargalo define o ritmo de todo o sistema: melhorar etapas que não são a restrição não aumenta o throughput total","São sinônimos com origens diferentes","Sistêmica só se aplica a organizações com 500+ pessoas"],ans:1,xp:60,exp:"TOC de Goldratt no coaching: identificar a restrição (estado com maior WIP, via CFD), explorar sua capacidade máxima antes de aumentar, subordinar todo o resto à restrição. O coach facilita essa análise e prioriza intervenções pelo impacto sistêmico.",vid:{t:"Theory of Constraints — Agile",u:"https://www.youtube.com/results?search_query=theory+of+constraints+agile+kanban"}},
{diff:5,cat:"Histórias de Usuário",concept:"BDD e Given When Then",q:"Como o Agile Coach usa 'Given-When-Then' (BDD) para melhorar critérios de aceite?",opts:["BDD é só para QA","BDD transforma critérios vagos em exemplos concretos e testáveis: Given (contexto), When (ação), Then (resultado). O coach facilita workshops para que PO e time escrevam exemplos reais ANTES de codar","BDD é um framework de deploy automatizado","O coach usa BDD para medir velocity do time de QA"],ans:1,xp:60,exp:"BDD como prática de colaboração: ao escrever 'Dado que o cliente tem saldo de R$100, Quando faz saque de R$150, Então o sistema exibe mensagem de saldo insuficiente', o time alinha entendimento ANTES de implementar — reduzindo bugs de interpretação.",vid:{t:"BDD e Given When Then",u:"https://www.youtube.com/results?search_query=BDD+Given+When+Then+user+stories"}}
];


const MATERIALS={"Lead Time":["Lead Time vs Cycle Time","https://www.youtube.com/watch?v=xm7t7OJGps4"],"Cycle Time":["Lead Time vs Cycle Time","https://www.youtube.com/watch?v=xm7t7OJGps4"],"Throughput":["Throughput — Kanban","https://www.youtube.com/watch?v=OfrGQtFa3lU"],"WIP":["WIP / Work in Progress","https://www.youtube.com/watch?v=tINK8GXgPIk"],"WIP limits":["Kanban e o Limite de WIP","https://www.youtube.com/watch?v=tINK8GXgPIk"],"Aging WIP":["Aging WIP — Kanban","https://www.youtube.com/results?search_query=Aging+WIP+Kanban"],"Flow Efficiency":["Flow Efficiency","https://www.youtube.com/watch?v=fRqUhj3mj70"],"Lei de Little":["Lei de Little — Kanban","https://www.youtube.com/watch?v=CdI6J7bhWpU"],"CFD":["Cumulative Flow Diagram","https://www.youtube.com/watch?v=o260BbRb63E"],"Monte Carlo":["Monte Carlo Forecasting","https://www.youtube.com/watch?v=DBW5Sk6DK2o"],"Percentis":["Percentis P85 — SLE","https://www.youtube.com/results?search_query=percentile+P85+SLE+Kanban"],"SLE":["Service Level Expectation","https://www.youtube.com/results?search_query=SLE+Kanban"],"Distribuição de Lead Time":["Lead Time Distribution","https://www.youtube.com/results?search_query=Lead+Time+distribution+Kanban"],"Scatter plot e correlação":["Scatter Plot — Flow","https://www.youtube.com/results?search_query=scatter+plot+flow+kanban"],"Média, mediana e outliers":["Mean vs Median","https://www.youtube.com/results?search_query=mean+median+outliers+kanban"],"Variabilidade":["Process Variability","https://www.youtube.com/results?search_query=process+variability+agile"],"Coeficiente de variação":["Coefficient of Variation","https://www.youtube.com/results?search_query=coefficient+of+variation+statistics"],"Distribuições e histogramas":["Histogramas","https://www.youtube.com/results?search_query=histogram+kanban"],"Interpretação de percentis":["Percentis","https://www.youtube.com/results?search_query=percentiles+kanban"],"Média versus P85":["Média vs P85","https://www.youtube.com/results?search_query=P85+lead+time+kanban"],"Políticas explícitas de priorização":["Kanban Explicit Policies","https://www.youtube.com/results?search_query=Kanban+explicit+policies"],"Classes de serviço":["Classes of Service","https://www.youtube.com/results?search_query=Kanban+classes+of+service"],"Expedite e classes de serviço":["Expedite","https://www.youtube.com/results?search_query=Kanban+Expedite+class"],"Política Expedite":["Política Expedite","https://www.youtube.com/results?search_query=Kanban+Expedite+policy"],"Priorização por valor e risco":["Priorização","https://www.youtube.com/results?search_query=Kanban+prioritization+value"],"Custo de atraso":["Cost of Delay","https://www.youtube.com/results?search_query=Cost+of+Delay+Kanban"],"Replenishment":["Replenishment Meeting","https://www.youtube.com/results?search_query=Kanban+replenishment"],"PDCA":["PDCA","https://www.youtube.com/results?search_query=PDCA+continuous+improvement+agile"],"5 Porquês":["5 Whys","https://www.youtube.com/results?search_query=5+Whys+root+cause"],"Ishikawa":["Ishikawa","https://www.youtube.com/results?search_query=Ishikawa+fishbone"],"Pareto":["Pareto","https://www.youtube.com/results?search_query=Pareto+chart+improvement"],"Retrospectiva e foco":["Retrospectivas","https://www.youtube.com/results?search_query=agile+retrospective"],"Experimentos de melhoria":["Experimentos","https://www.youtube.com/results?search_query=continuous+improvement+experiment+agile"],"Experimentos e causalidade":["Experimentos e causalidade","https://www.youtube.com/results?search_query=agile+experiments+causality"],"Otimização sistêmica":["Systems Thinking","https://www.youtube.com/results?search_query=systems+thinking+optimization+agile"],"Estrutura de User Story":["User Stories","https://www.youtube.com/results?search_query=user+stories+Agile"],"INVEST":["INVEST","https://www.youtube.com/results?search_query=INVEST+user+stories"],"Qualidade de User Story":["Qualidade de User Stories","https://www.youtube.com/results?search_query=good+user+story"],"Critérios de aceitação":["Critérios de Aceitação","https://www.youtube.com/results?search_query=user+story+acceptance+criteria"],"Fatiamento vertical":["Vertical Slicing","https://www.youtube.com/results?search_query=vertical+slicing+user+stories"],"BDD e Given When Then":["BDD","https://www.youtube.com/results?search_query=BDD+Given+When+Then"],"Story Mapping":["User Story Mapping","https://www.youtube.com/watch?v=uj3PlPDAlHU"],"3Cs e colaboração":["3Cs User Stories","https://www.youtube.com/results?search_query=3Cs+user+stories"],"Histórias orientadas a valor":["User Stories orientadas a valor","https://www.youtube.com/results?search_query=user+stories+business+value"],"EBM - Current Value":["EBM Current Value","https://www.youtube.com/results?search_query=EBM+Current+Value+Scrum"],"EBM - Unrealized Value":["EBM Unrealized Value","https://www.youtube.com/results?search_query=EBM+Unrealized+Value"],"EBM - Time to Market":["EBM Time to Market","https://www.youtube.com/results?search_query=EBM+Time+to+Market"],"EBM - Ability to Innovate":["EBM A2I","https://www.youtube.com/results?search_query=EBM+Ability+to+Innovate"],"DORA - Deployment Frequency":["DORA Metrics","https://www.youtube.com/shorts/6UrG6FvtSik"],"DORA - Change Failure Rate":["DORA CFR","https://www.youtube.com/results?search_query=DORA+Change+Failure+Rate"],"DORA e outcomes":["DORA outcomes","https://www.youtube.com/results?search_query=DORA+metrics+outcomes"],"Métricas sem comparação de times":["Métricas — não compare times","https://www.youtube.com/results?search_query=agile+metrics+teams"],"Coaching orientado a outcomes":["Agile Coaching outcomes","https://www.youtube.com/results?search_query=agile+coaching+outcomes"],"Velocity":["Story Points & Velocity","https://www.youtube.com/watch?v=Und8DgcUQf8"],"Sprint":["Scrum Sprint","https://www.youtube.com/results?search_query=Scrum+Sprint"],"Sprint Goal":["Sprint Goal","https://www.youtube.com/results?search_query=Sprint+Goal+Scrum"],"Product Goal":["Product Goal","https://www.youtube.com/results?search_query=Scrum+Product+Goal"],"Definition of Done":["Definition of Done","https://www.youtube.com/results?search_query=Definition+of+Done+Scrum"],"Agile Coaching":["Agile Coaching","https://www.youtube.com/results?search_query=agile+coaching+competencies"]};

// Direct fallback videos cover each subject area when a question has no direct video.
const RECOVERY_VIDEOS=Object.freeze({
  flow: ['Métricas de fluxo no Kanban', 'https://www.youtube.com/watch?v=xm7t7OJGps4'],
  scrum: ['Scrum Guide 2020', 'https://www.youtube.com/watch?v=qJtd5jUJdFU'],
  kanban: ['Kanban e limites de WIP', 'https://www.youtube.com/watch?v=tINK8GXgPIk'],
  ebm: ['Evidence-Based Management', 'https://www.youtube.com/watch?v=W05lu7lHI40'],
  dora: ['DORA Metrics', 'https://www.youtube.com/watch?v=6UrG6FvtSik'],
  analysis: ['Cumulative Flow Diagram e fluxo', 'https://www.youtube.com/watch?v=o260BbRb63E'],
  improvement: ['PDCA e resolução de problemas', 'https://www.youtube.com/watch?v=E_oUSZBgRDM'],
  stories: ['User Story Mapping', 'https://www.youtube.com/watch?v=uj3PlPDAlHU'],
  coaching: ['Gestão orientada por evidências', 'https://www.youtube.com/watch?v=W05lu7lHI40']
});

const TOPICS=[['Scrum',['Sprint','Sprint Goal','Product Goal','Definition of Done','Velocity']],['Flow & Métricas',['Lead Time','Cycle Time','Throughput','WIP','WIP limits','Aging WIP','Flow Efficiency','Lei de Little','CFD','Monte Carlo','Percentis','SLE']],['Medição e Análise',['Média, mediana e outliers','Variabilidade','Coeficiente de variação','Distribuição de Lead Time','Scatter plot e correlação','Distribuições e histogramas','Interpretação de percentis','Média versus P85']],['Kanban e Priorização',['Políticas explícitas de priorização','Classes de serviço','Expedite e classes de serviço','Política Expedite','Priorização por valor e risco','Custo de atraso','Replenishment','WIP limits']],['Melhoria Contínua',['PDCA','5 Porquês','Ishikawa','Pareto','Retrospectiva e foco','Experimentos de melhoria','Experimentos e causalidade','Otimização sistêmica']],['Histórias de Usuário',['Estrutura de User Story','INVEST','Qualidade de User Story','Critérios de aceitação','Fatiamento vertical','BDD e Given When Then','Story Mapping','3Cs e colaboração','Histórias orientadas a valor']],['EBM',['EBM - Current Value','EBM - Unrealized Value','EBM - Time to Market','EBM - Ability to Innovate']],['DORA',['DORA - Deployment Frequency','DORA - Change Failure Rate','DORA e outcomes']],['Agile Coaching',['Métricas sem comparação de times','Coaching orientado a outcomes','Agile Coaching']]];
const LEVELS=[{n:1,label:'🌱 Scrum Master Júnior',color:'#6366f1',diffMax:2},{n:2,label:'⚙️ Scrum Master Pleno',color:'#3b82f6',diffMax:3},{n:3,label:'🔥 Scrum Master Sênior',color:'#06b6d4',diffMax:4},{n:4,label:'🧭 Agile Coach',color:'#10b981',diffMax:5},{n:5,label:'🏆 Especialista em Agile Coaching',color:'#f59e0b',diffMax:5}];
const REQUIRED_BY_LEVEL={1:['Scrum','Flow & Métricas'],2:['Kanban e Priorização','DORA','EBM'],3:['Medição e Análise','Melhoria Contínua'],4:['Histórias de Usuário','Agile Coaching']};
const MAX_SESSION_LIVES = 5;
const PROMOTION_SCORE=75,REQUIRED_DOMAIN=60,SESSION_SIZE=12,EXAM_SIZE=12;
const ACH=[
  ['first','🎮','Primeiro passo','Responda sua primeira pergunta.'],
  ['marathon','🏃','Maratona','Responda 25 perguntas.'],
  ['centurion','💯','Centurião','Responda 100 perguntas.'],
  ['streak5','🔥','5 em sequência','Acerte 5 questões consecutivas.'],
  ['streak10','🎯','Precisão cirúrgica','Acerte 10 questões consecutivas.'],
  ['streak7','📅','Constância','Estude por 7 dias seguidos.'],
  ['streakDays5','🔥','Fogo inicial','Mantenha 5 dias de atividade.'],
  ['streakDays10','🔥','Ritmo constante','Mantenha 10 dias de atividade.'],
  ['streakDays50','🏆','Lenda da jornada','Mantenha 50 dias de atividade.'],
  ['explorer','🧭','Explorador','Pratique 5 competências diferentes.'],
  ['perfect','⭐','Sessão perfeita','Conclua uma sessão com 100% de acertos.'],
  ['recover10','🩹','Recuperador','Recupere 10 erros.'],
  ['master90','🧠','Domínio 90','Chegue a 90% em um conceito.'],
  ['turnaround','🔄','Virada de jogo','Aumente o domínio de uma competência em 30 pontos.'],
  ['polymath','🌐','Polímata Ágil','Alcance 70% ou mais em todas as competências.'],
  ['flow','🌊','Mestre do Flow','90% em 5 conceitos de Flow.'],
  ['story','✍️','Story Crafter','80% em 5 conceitos de Histórias.'],
  ['kanban','🧭','Kanban Estratégico','80% em 5 conceitos de Kanban.'],
  ['coach','🏆','Olhar de Coach','Passe uma avaliação de promoção.']
];



// Returns the competency group for a concept.
function catGroup(concept) {
  for (const [group, concepts] of TOPICS) {
    if (concepts.includes(concept)) return group;
  }
  return 'Flow & Métricas';
}

// Checks whether every competency represented in the question bank reached the target.
function allCompetenciesMastered(target) {
  const groups = {};

  BANK.forEach((question) => {
    const group = catGroup(question.concept);
    groups[group] = groups[group] || { seen: 0, correct: 0 };
    const data = mastery(question.concept);
    groups[group].seen += data.seen;
    groups[group].correct += data.correct;
  });

  return Object.values(groups).every((group) => group.seen > 0 && (group.correct / group.seen) * 100 >= target);
}

// Counts competencies with at least one answered question.
function startedCompetencies() {
  const started = new Set();
  BANK.forEach((question) => {
    if (mastery(question.concept).seen > 0) started.add(catGroup(question.concept));
  });
  return started.size;
}

// Escapes text before it is inserted into HTML strings.
function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

// Converts approved YouTube URLs into privacy-enhanced embed URLs.
function toEmbedUrl(videoUrl) {
  try {
    const url = new URL(String(videoUrl || ''));
    const isYouTube = ['www.youtube.com', 'youtube.com', 'youtu.be'].includes(url.hostname.toLowerCase());
    const videoId = url.hostname === 'youtu.be'
      ? url.pathname.slice(1)
      : url.searchParams.get('v') || url.pathname.split('/')[2];
    return isYouTube && /^[\w-]{11}$/.test(videoId || '')
      ? 'https://www.youtube-nocookie.com/embed/' + videoId
      : '';
  } catch (error) {
    return '';
  }
}

// Chooses a direct video for the exact question when possible, otherwise for its subject area.
function recoveryVideoKey(question) {
  if (question.cat === 'Scrum') return 'scrum';
  if (question.cat === 'Kanban') return 'kanban';
  if (question.cat === 'EBM') return 'ebm';
  if (question.cat === 'DORA') return 'dora';
  if (question.cat === 'Estatística') return 'analysis';
  if (question.cat === 'Melhoria Contínua') return 'improvement';
  if (question.cat === 'Histórias de Usuário') return 'stories';
  if (question.cat === 'Agile Coaching') return 'coaching';
  return 'flow';
}

// Returns a direct, embeddable recovery video with no YouTube search fallback.
function materialFor(question) {
  const questionEmbedUrl = question.vid && toEmbedUrl(question.vid.u);
  const fallback = RECOVERY_VIDEOS[recoveryVideoKey(question)];
  const url = questionEmbedUrl ? question.vid.u : fallback[1];

  return {
    title: questionEmbedUrl ? question.vid.t : fallback[0] + ' — ' + question.concept,
    url: Security.safeExternalUrl(url),
    embedUrl: toEmbedUrl(url)
  };
}

// Assigns stable IDs to the question bank without modifying question content.
const BANK = BANK_RAW.map((question, index) => ({
  ...question,
  id: question.id || ('Q' + String(index + 1).padStart(3, '0'))
}));

// Detects answer choices that make the correct option too easy to identify.
function questionQualityIssues(question) {
  const options = Array.isArray(question?.opts) ? question.opts.map((option) => String(option)) : [];
  if (options.length !== 4 || !Number.isInteger(question?.ans) || !options[question.ans]) return ['Formato inválido'];

  const lengths = options.map((option) => option.length).sort((a, b) => a - b);
  const correctLength = options[question.ans].length;
  const averageLength = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
  const issues = [];

  if (correctLength > averageLength * 1.8 && correctLength - lengths[0] > 35) issues.push('Resposta correta muito longa');
  if (/\b(sempre|nunca|apenas|exclusivamente)\b/i.test(options[question.ans])) issues.push('Pista textual na resposta correta');
  return issues;
}

const QUESTION_QUALITY_REPORT = BANK.flatMap((question) => questionQualityIssues(question).map((issue) => ({ id: question.id, issue })));

// Creates a clean default profile used for new or reset users.
function defaultProfile() {
  return {
    level: 1,
    xp: 0,
    streak: 0,
    lastDay: null,
    bestStreak: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    recovered: 0,
    history: [],
    mastery: {},
    achievements: {},
    quizSeen: {},
    trainingCount: 0,
    promotionCount: 0,
    nome: '',
    sobrenome: '',
    unidade: '',
    consentVersion: null,
    consentAt: null,
    analyticsConsent: false,
    activityDays: {},
    daily: { date: null, done: false, score: 0 }
  };
}

let profile = defaultProfile();
let state = { mode: 'training', questions: [], idx: 0, results: [], sessionCorrect: 0, sessionStreak: 0, lives: MAX_SESSION_LIVES };
let syncTimer = null;

// Returns today's local date in the YYYY-MM-DD format used by progression rules.
function dayKey() {
  const date = new Date();
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

// Updates the streak when a new day is detected.
function ensureDay() {
  const days = Object.keys(profile.activityDays || {}).sort();
  const last = days[days.length - 1];
  if (!last) { profile.streak = 0; profile.lastDay = null; return; }
  const today = dayKey();
  const gap = Math.round((new Date(today + 'T12:00:00') - new Date(last + 'T12:00:00')) / 86400000);
  if (gap >= 2) profile.streak = 0;
  profile.lastDay = last;
}

// Records a real authenticated activity day and recalculates the current streak.
function recordActivity() {
  if (!currentUser) return;
  const today = dayKey();
  profile.activityDays[today] = true;
  const days = Object.keys(profile.activityDays).sort();
  let streak = 0;
  let cursor = today;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index] !== cursor) break;
    streak += 1;
    const previous = new Date(cursor + 'T12:00:00');
    previous.setDate(previous.getDate() - 1);
    cursor = previous.getFullYear() + '-' + String(previous.getMonth() + 1).padStart(2, '0') + '-' + String(previous.getDate()).padStart(2, '0');
  }
  profile.streak = streak;
  profile.bestStreak = Math.max(profile.bestStreak, streak);
  profile.lastDay = today;
}

// Applies streak milestones after a real authenticated use of the app.
function checkActivityAchievements() {
  if (!currentUser) return;
  if (profile.streak >= 5) unlock('streakDays5');
  if (profile.streak >= 7) unlock('streak7');
  if (profile.streak >= 10) unlock('streakDays10');
  if (profile.streak >= 50) unlock('streakDays50');
}

// Checks whether the second date is exactly one day after the first date.
function isYesterday(previous, current) {
  const first = new Date(previous + 'T12:00:00');
  const second = new Date(current + 'T12:00:00');
  return Math.round((second - first) / 86400000) === 1;
}

// Returns the mastery object for a concept and creates it when necessary.
function mastery(concept) {
  return profile.mastery[concept] || (profile.mastery[concept] = { seen: 0, correct: 0, last: 0, recovery: 0 });
}

// Calculates a concept mastery percentage.
function masteryPct(concept) {
  const data = mastery(concept);
  return data.seen ? Math.round((data.correct / data.seen) * 100) : 0;
}

// Calculates the adaptive score that prioritizes weak concepts.
function weakScore(question) {
  const data = mastery(question.concept);
  const percentage = data.seen ? data.correct / data.seen : 0.5;
  return (1 - percentage) * 100 + Math.random() * 35;
}

// Returns the maximum question difficulty available at the current level.
function levelBand() {
  return LEVELS[profile.level - 1].diffMax;
}

// Picks questions while avoiding recent repetitions whenever possible.
function uniquePick(pool, amount) {
  const used = new Set();
  const output = [];
  const unseen = pool.filter((question) => !profile.quizSeen[question.id]);
  const source = unseen.length >= amount ? unseen : unseen.concat(pool.filter((question) => !unseen.includes(question)));
  const sorted = [...source].sort((a, b) => weakScore(b) - weakScore(a));

  for (const question of sorted) {
    if (used.has(question.id)) continue;
    used.add(question.id);
    output.push(question);
    if (output.length === amount) break;
  }

  return output;
}

// Marks selected questions as seen so the adaptive picker can avoid repeats.
function markSeen(questions) {
  questions.forEach((question) => {
    profile.quizSeen[question.id] = Date.now();
  });
}

// Synchronizes the local profile with Firebase using server-owned user identity.
async function syncToCloud() {
  if (!currentUser || !Security.safeFirebaseUid(currentUser.id)) return;

  const userId = currentUser.id;
  try {
    await sb.upsertProfile({
      user_id: userId,
      level: profile.level,
      xp: profile.xp,
      streak: profile.streak,
      best_streak: profile.bestStreak,
      last_day: profile.lastDay,
      total_answered: profile.totalAnswered,
      total_correct: profile.totalCorrect,
      recovered: profile.recovered,
      achievements: profile.achievements,
      daily: profile.daily,
      training_count: profile.trainingCount,
      promotion_count: profile.promotionCount,
      nome: profile.nome,
      sobrenome: profile.sobrenome,
      unidade: profile.unidade,
      analytics_consent: profile.analyticsConsent,
      activity_days: profile.activityDays,
      consent_version: profile.consentVersion,
      consent_at: profile.consentAt
    });

    const rows = Object.entries(profile.mastery)
      .filter(([, data]) => data.seen > 0)
      .map(([concept, data]) => ({
        user_id: userId,
        concept,
        seen: data.seen,
        correct: data.correct,
        recovery: data.recovery || 0
      }));

    if (rows.length) await sb.upsertMastery(rows);
  } catch (error) {
    Security.log('Cloud sync failed', { message: error.message });
  }
}

// Fetches the authenticated user's cloud profile and mastery without applying it.
async function fetchCloudData() {
  if (!currentUser || !Security.safeFirebaseUid(currentUser.id)) return false;

  try {
    const [cloudProfile, masteryRows] = await Promise.all([
      sb.getProfile(currentUser.id),
      sb.getMastery(currentUser.id)
    ]);
    return { profile: cloudProfile, masteryRows };
  } catch (error) {
    Security.log('Cloud profile load failed', { message: error.message });
    return null;
  }
}

// Applies validated cloud data to the active profile.
function applyCloudData(cloudData) {
  if (!cloudData) return false;
  if (cloudData.profile) profile = Security.normalizeProfile(cloudData.profile, profile);

  if (cloudData.masteryRows.length) {
    cloudData.masteryRows.forEach((row) => {
        const concept = String(row.concept || '');
        if (!concept || !Number.isFinite(Number(row.seen)) || !Number.isFinite(Number(row.correct))) return;
        const seen = Security.clampInt(row.seen, 0, 1000000);
        profile.mastery[concept] = {
          seen,
          correct: Math.min(Security.clampInt(row.correct, 0, 1000000), seen),
          recovery: Security.clampInt(row.recovery, 0, 1000000),
          last: 0
        };
    });
  }
  setAnalyticsConsent(Boolean(profile.analyticsConsent));
  return Boolean(cloudData.profile || cloudData.masteryRows.length);
}

// Enables or disables optional usage analytics after explicit user choice.
function setAnalyticsConsent(granted) {
  const value = Boolean(granted);
  localStorage.setItem('analytics-consent', value ? 'granted' : 'denied');
  firebaseAnalytics.setAnalyticsCollectionEnabled(value);
  if (value) firebaseAnalytics.logEvent('analytics_consent_granted');
}

// Loads and applies the authenticated user's cloud profile and mastery data.
async function loadFromCloud() {
  return applyCloudData(await fetchCloudData());
}

// Saves authenticated progress to the cloud; visitor progress remains session-only.
function save() {
  if (!currentUser) {
    updateAll();
    return;
  }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncToCloud, 2000);
  updateAll();
}

// Builds an adaptive training session for the current level.
function buildTraining() {
  const maxDifficulty = levelBand();
  const pool = BANK.filter((question) => question.diff <= maxDifficulty);
  const selected = uniquePick(pool, SESSION_SIZE);

  if (selected.length < SESSION_SIZE) {
    for (const question of BANK) {
      if (!selected.find((item) => item.id === question.id)) selected.push(question);
      if (selected.length === SESSION_SIZE) break;
    }
  }

  return selected.map((question) => ({ ...question, context: 'training' }));
}

// Builds a promotion exam containing mandatory competency coverage.
function buildExam() {
  const requiredGroups = REQUIRED_BY_LEVEL[profile.level] || [];
  const picks = [];
  const perGroup = Math.max(1, Math.floor(EXAM_SIZE / Math.max(requiredGroups.length, 1)));

  requiredGroups.forEach((group) => {
    const pool = BANK.filter((question) => catGroup(question.concept) === group || question.cat === group);
    const selected = uniquePick(pool, perGroup)[0];
    if (selected && !picks.find((item) => item.id === selected.id)) picks.push({ ...selected, context: 'exam' });
  });

  const remaining = uniquePick(
    BANK.filter((question) => question.diff >= Math.max(2, profile.level) && !picks.find((item) => item.id === question.id)),
    EXAM_SIZE - picks.length
  );

  return [...picks, ...remaining].slice(0, EXAM_SIZE).sort(() => Math.random() - 0.5).map((question) => ({ ...question, context: 'exam' }));
}

// Checks whether every lesson concept in a target stage has been started.
function nextStageLessonsReady(targetLevel) {
  const requiredGroups = REQUIRED_BY_LEVEL[targetLevel] || [];
  if (!requiredGroups.length) return true;

  return requiredGroups.every((group) => {
    const concepts = BANK
      .filter((question) => catGroup(question.concept) === group)
      .map((question) => question.concept);
    return [...new Set(concepts)].every((concept) => mastery(concept).seen > 0);
  });
}

// Advances slowly inside the current level; promotion is the only way to cross a level marker.
function journeyProgressPercent() {
  if (profile.level >= LEVELS.length) return 100;

  const segment = 100 / (LEVELS.length - 1);
  const answeredTarget = Math.max(25, profile.level * 25);
  const gradualProgress = Math.min(0.95, profile.totalAnswered / answeredTarget);
  return Math.round(((profile.level - 1) * segment) + (gradualProgress * segment));
}

// Starts the standard adaptive training flow.
function startTraining() {
  ensureDay();
  state = { mode: 'training', questions: buildTraining(), idx: 0, results: [], sessionCorrect: 0, sessionStreak: 0, lives: MAX_SESSION_LIVES };
  markSeen(state.questions);
  save();
  openQuiz();
}

// Starts the promotion assessment when the user has not reached the final level.
function startExam() {
  if (profile.level >= 5) {
    alert('Você já está no nível máximo.');
    return;
  }

  ensureDay();
  state = { mode: 'exam', questions: buildExam(), idx: 0, results: [], sessionCorrect: 0, sessionStreak: 0, lives: MAX_SESSION_LIVES };
  markSeen(state.questions);
  save();
  openQuiz();
}

// Starts the daily challenge once per calendar day.
function startDaily() {
  ensureDay();
  const today = dayKey();
  if (profile.daily.date === today && profile.daily.done) {
    alert('Desafio de hoje já concluído! Volte amanhã.');
    return;
  }

  const seed = Number(today.replaceAll('-', ''));
  const pool = BANK.filter((question) => question.diff >= Math.max(2, profile.level));
  const questions = [];
  let index = pool.length ? seed % pool.length : 0;

  while (questions.length < 5 && pool.length) {
    const question = pool[index % pool.length];
    if (!questions.find((item) => item.id === question.id)) questions.push({ ...question, context: 'daily' });
    index += 17;
  }

  state = { mode: 'daily', questions, idx: 0, results: [], sessionCorrect: 0, sessionStreak: 0, lives: MAX_SESSION_LIVES };
  markSeen(state.questions);
  save();
  openQuiz();
}

// Starts a focused practice session on the user's weakest concept.
function startRecommended() {
  const weakConcept = getWeakConcept();
  if (!weakConcept) {
    startTraining();
    return;
  }

  const pool = BANK.filter((question) => question.concept === weakConcept).sort((a, b) => a.diff - b.diff);
  state = { mode: 'recommended', questions: uniquePick(pool, Math.min(8, pool.length)), idx: 0, results: [], sessionCorrect: 0, sessionStreak: 0, lives: MAX_SESSION_LIVES };
  markSeen(state.questions);
  save();
  openQuiz();
}

// Returns the concept with the lowest observed mastery percentage.
function getWeakConcept() {
  let weakest = null;
  let lowestScore = 101;

  for (const question of BANK) {
    const data = mastery(question.concept);
    const percentage = masteryPct(question.concept);
    if (data.seen && percentage < lowestScore) {
      lowestScore = percentage;
      weakest = question.concept;
    }
  }

  return weakest;
}

function getDailyMissions() {
  const missionBase = Math.min(5, Math.max(0, profile.totalAnswered % 5 + (state.questions.length ? state.sessionCorrect : 0)));
  return [
    { id: 'questions', label: 'Responder 5 questões', current: Math.min(5, missionBase), goal: 5, reward: '25 XP' },
    { id: 'review', label: 'Revisar um conceito fraco', current: getWeakConcept() ? 1 : 0, goal: 1, reward: '15 XP' },
    { id: 'streak', label: 'Manter o streak', current: Math.min(1, profile.streak > 0 ? 1 : 0), goal: 1, reward: '10 XP' }
  ];
}

// Calculates XP for an answered question according to difficulty and mode.
function xpFor(question) {
  return 10 + question.diff * 10 + (state.mode === 'exam' ? 5 : 0) + (state.mode === 'daily' ? 5 : 0);
}

// Adds XP to the local profile and shows a brief confirmation.
function addXP(amount) {
  profile.xp += Security.clampInt(amount, 0, 10000);
  toast('+' + amount + ' XP');
}
