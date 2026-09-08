from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.dml import MSO_THEME_COLOR
from pptx.enum.text import MSO_AUTO_SIZE
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / 'Manual-de-Uso-Academia-Agile.pptx'
LOGO = ROOT / 'assets' / 'favicon.png'

NAVY = RGBColor(11, 16, 32)
SURFACE = RGBColor(20, 25, 37)
SURFACE_2 = RGBColor(27, 34, 52)
BLUE = RGBColor(91, 130, 255)
GREEN = RGBColor(35, 213, 110)
VIOLET = RGBColor(167, 123, 255)
WHITE = RGBColor(245, 247, 252)
MUTED = RGBColor(166, 177, 205)
RED = RGBColor(255, 128, 128)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
blank = prs.slide_layouts[6]


def set_bg(slide, color=NAVY):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def rect(slide, x, y, w, h, fill=SURFACE, line=None, radius=False):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shp = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill
    shp.line.color.rgb = line or fill
    if radius:
        shp.adjustments[0] = 0.08
    return shp


def text(slide, value, x, y, w, h, size=18, color=WHITE, bold=False, font='Aptos', align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.02)
    tf.margin_right = Inches(0.02)
    tf.margin_top = Inches(0.01)
    tf.margin_bottom = Inches(0.01)
    tf.vertical_anchor = valign
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = value
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    return box


def bullets(slide, items, x, y, w, h, size=17, color=WHITE, accent=BLUE, gap=0.12):
    yy = y
    for item in items:
        rect(slide, x, yy + 0.12, 0.10, 0.10, fill=accent, line=accent, radius=True)
        text(slide, item, x + 0.24, yy, w - 0.24, 0.45, size=size, color=color)
        yy += gap + 0.38


def header(slide, section, number):
    if LOGO.exists():
        slide.shapes.add_picture(str(LOGO), Inches(0.45), Inches(0.28), height=Inches(0.46))
    text(slide, 'ACADEMIA AGILE', 1.02, 0.32, 2.8, 0.25, size=11, color=WHITE, bold=True)
    text(slide, section.upper(), 10.4, 0.35, 2.1, 0.2, size=9, color=MUTED, bold=True, align=PP_ALIGN.RIGHT)
    rect(slide, 0.45, 0.88, 12.4, 0.012, fill=SURFACE_2, line=SURFACE_2)
    text(slide, f'{number:02d}', 12.45, 7.08, 0.4, 0.2, size=9, color=MUTED, align=PP_ALIGN.RIGHT)


def title(slide, heading, subtitle=None):
    text(slide, heading, 0.65, 1.25, 11.8, 0.55, size=29, color=WHITE, bold=True)
    if subtitle:
        text(slide, subtitle, 0.68, 1.88, 11.3, 0.4, size=13, color=MUTED)


def card(slide, heading, body, x, y, w, h, accent=BLUE, icon=None):
    rect(slide, x, y, w, h, fill=SURFACE, line=SURFACE_2, radius=True)
    rect(slide, x, y, 0.06, h, fill=accent, line=accent)
    if icon:
        text(slide, icon, x + 0.25, y + 0.22, 0.45, 0.35, size=20, color=accent, bold=True)
        hx = x + 0.82
    else:
        hx = x + 0.28
    text(slide, heading, hx, y + 0.22, w - (hx - x) - 0.25, 0.32, size=15, color=WHITE, bold=True)
    text(slide, body, x + 0.28, y + 0.72, w - 0.52, h - 0.85, size=11, color=MUTED)


def add_slide(section, number):
    slide = prs.slides.add_slide(blank)
    set_bg(slide)
    header(slide, section, number)
    return slide

# 1 Cover
slide = prs.slides.add_slide(blank)
set_bg(slide)
rect(slide, 0, 0, 13.333, 7.5, fill=NAVY)
rect(slide, 0, 0, 0.18, 7.5, fill=BLUE, line=BLUE)
if LOGO.exists():
    slide.shapes.add_picture(str(LOGO), Inches(0.75), Inches(1.05), height=Inches(1.05))
text(slide, 'Academia Agile', 0.78, 2.35, 8.8, 0.7, size=38, color=WHITE, bold=True)
text(slide, 'Manual completo de uso', 0.82, 3.15, 8, 0.45, size=23, color=BLUE, bold=True)
text(slide, 'Aprenda, pratique, acompanhe sua evolução e peça ajuda quando precisar.', 0.84, 3.85, 7.6, 0.7, size=17, color=MUTED)
rect(slide, 9.0, 1.15, 3.25, 4.75, fill=SURFACE, line=SURFACE_2, radius=True)
text(slide, 'JORNADA', 9.45, 1.65, 2.3, 0.25, size=10, color=MUTED, bold=True)
for i, (label, color) in enumerate([('Estudos', BLUE), ('Métricas', VIOLET), ('Conquistas', GREEN), ('FAC + SAC', RGBColor(255, 190, 80))]):
    yy = 2.15 + i * 0.72
    rect(slide, 9.45, yy, 0.18, 0.18, fill=color, line=color, radius=True)
    text(slide, label, 9.82, yy - 0.02, 1.9, 0.25, size=14, color=WHITE, bold=True)
text(slide, 'Versão 1.0 · Setembro de 2026', 0.85, 6.55, 4.5, 0.25, size=10, color=MUTED)
text(slide, 'Uso educacional', 10.0, 6.55, 2.3, 0.25, size=10, color=MUTED, align=PP_ALIGN.RIGHT)

# 2 Overview
slide = add_slide('Visão geral', 2)
title(slide, 'O que você encontra na plataforma', 'A Academia Agile organiza sua prática em um fluxo simples e progressivo.')
card(slide, 'Jornada', 'Veja seu nível atual, a próxima meta e o caminho de evolução.', 0.7, 2.65, 2.85, 2.0, BLUE, '01')
card(slide, 'Estudos', 'Acesse vídeos e pratique perguntas por assunto.', 3.8, 2.65, 2.85, 2.0, VIOLET, '02')
card(slide, 'Métricas', 'Acompanhe domínio, precisão e pontos de atenção.', 6.9, 2.65, 2.85, 2.0, GREEN, '03')
card(slide, 'Ajuda', 'Consulte a FAC antes de abrir um chamado no SAC.', 10.0, 2.65, 2.6, 2.0, RGBColor(255, 190, 80), '04')
text(slide, 'A navegação principal fica no topo. No celular, os mesmos destinos aparecem em uma barra adaptada.', 0.72, 5.3, 11.7, 0.45, size=15, color=MUTED)

# 3 first access
slide = add_slide('Primeiro acesso', 3)
title(slide, 'Comece sem complicação', 'Você pode explorar a plataforma antes de criar uma conta.')
bullets(slide, ['Abra a página da Academia Agile.', 'Use a Jornada, Estudos e Métricas para conhecer a interface.', 'O progresso de visitante fica somente na sessão atual.', 'Para sincronizar entre dispositivos, crie uma conta ou entre em uma existente.'], 0.9, 2.5, 6.1, 2.8, size=17)
rect(slide, 7.6, 2.35, 4.3, 2.7, fill=SURFACE, line=SURFACE_2, radius=True)
text(slide, 'VISITANTE', 8.0, 2.75, 2.0, 0.25, size=10, color=MUTED, bold=True)
text(slide, '0% domínio', 8.0, 3.25, 3.2, 0.45, size=24, color=WHITE, bold=True)
rect(slide, 8.0, 4.05, 3.3, 0.1, fill=SURFACE_2, line=SURFACE_2, radius=True)
text(slide, 'Sem dados de outra pessoa', 8.0, 4.45, 3.2, 0.25, size=11, color=GREEN)

# 4 account
slide = add_slide('Conta', 4)
title(slide, 'Criar conta ou entrar', 'A conta permite salvar seu progresso com segurança na nuvem.')
card(slide, 'Criar conta', 'Informe nome, sobrenome, email, unidade e uma senha de 8 a 128 caracteres.', 0.8, 2.35, 3.8, 2.5, BLUE, 'A')
card(slide, 'Maioridade', 'O cadastro é destinado exclusivamente a pessoas com 18 anos ou mais. Marque a confirmação.', 4.8, 2.35, 3.8, 2.5, VIOLET, 'B')
card(slide, 'Consentimentos', 'Leia a Política de Privacidade e os Termos de Uso. Analytics é opcional e separado.', 8.8, 2.35, 3.8, 2.5, GREEN, 'C')
text(slide, 'Para recuperar uma senha, use “Esqueci minha senha” no formulário de login e confira seu email.', 0.85, 5.55, 11.2, 0.4, size=15, color=MUTED)

# 5 privacy
slide = add_slide('Privacidade', 5)
title(slide, 'Consentimentos e dados', 'As escolhas de privacidade ficam separadas do uso educacional principal.')
card(slide, 'Obrigatório', 'Aceite da Política de Privacidade e dos Termos de Uso para criar a conta.', 0.8, 2.45, 3.8, 2.2, BLUE, '✓')
card(slide, 'Obrigatório', 'Confirmação de maioridade: a plataforma é exclusiva para maiores de 18 anos.', 4.8, 2.45, 3.8, 2.2, VIOLET, '18')
card(slide, 'Opcional', 'Analytics mede uso da plataforma para orientar melhorias. Recusar não bloqueia os estudos.', 8.8, 2.45, 3.8, 2.2, GREEN, '⌁')
text(slide, 'Você pode alterar a preferência de Analytics no menu da conta. A solicitação de privacidade deve ser enviada para acaeacademiaagile@gmail.com.', 0.85, 5.3, 11.3, 0.55, size=14, color=MUTED)

# 6 studies
slide = add_slide('Estudos', 6)
title(slide, 'Estude por assunto', 'Cada card reúne o material e a prática daquele conceito.')
rect(slide, 0.8, 2.35, 5.4, 3.25, fill=SURFACE, line=SURFACE_2, radius=True)
text(slide, 'Sprint Goal', 1.15, 2.72, 3.5, 0.35, size=20, color=WHITE, bold=True)
text(slide, 'Scrum   ·   0/1 respondidas   ·   0% domínio', 1.15, 3.22, 4.3, 0.3, size=11, color=MUTED)
rect(slide, 1.15, 4.0, 1.0, 0.42, fill=SURFACE_2, line=SURFACE_2, radius=True)
text(slide, 'Vídeo', 1.35, 4.1, 0.7, 0.2, size=11, color=WHITE, bold=True)
rect(slide, 2.35, 4.0, 1.2, 0.42, fill=BLUE, line=BLUE, radius=True)
text(slide, 'Praticar', 2.55, 4.1, 0.85, 0.2, size=11, color=WHITE, bold=True)
text(slide, 'O botão Praticar aparece somente depois que houver atividade registrada naquele assunto.', 1.15, 4.8, 4.3, 0.5, size=11, color=GREEN)
bullets(slide, ['Use o vídeo para revisar o conceito.', 'Leia o contador no formato respondidas/total.', 'Depois da primeira resposta, pratique novamente quando quiser.'], 6.9, 2.55, 5.3, 2.2, size=16, accent=VIOLET)

# 7 quiz
slide = add_slide('Prática', 7)
title(slide, 'Responda às perguntas', 'A ordem das alternativas é embaralhada para reduzir respostas por posição.')
rect(slide, 0.8, 2.35, 11.7, 0.7, fill=SURFACE, line=SURFACE_2, radius=True)
text(slide, 'Treinamento', 1.1, 2.56, 1.5, 0.22, size=11, color=BLUE, bold=True)
text(slide, 'Intermediário', 2.65, 2.56, 1.8, 0.22, size=11, color=VIOLET, bold=True)
text(slide, '5/12', 11.55, 2.56, 0.55, 0.22, size=11, color=MUTED, align=PP_ALIGN.RIGHT)
text(slide, 'Leia o enunciado e escolha uma alternativa.', 1.0, 3.55, 7.6, 0.4, size=20, color=WHITE, bold=True)
for i, label in enumerate(['Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D']):
    yy = 4.2 + i * 0.55
    rect(slide, 1.0, yy, 10.7, 0.42, fill=SURFACE, line=SURFACE_2, radius=True)
    rect(slide, 1.18, yy + 0.1, 0.22, 0.22, fill=SURFACE_2, line=SURFACE_2, radius=True)
    text(slide, chr(65 + i), 1.23, yy + 0.125, 0.12, 0.12, size=8, color=BLUE, bold=True, align=PP_ALIGN.CENTER)
    text(slide, label, 1.62, yy + 0.1, 4, 0.2, size=12, color=WHITE)

# 8 metrics
slide = add_slide('Métricas', 8)
title(slide, 'Entenda seus indicadores', 'Os números mostram o que já foi respondido, não um progresso inventado.')
card(slide, 'Domínio médio', 'Considera somente competências que já possuem respostas.', 0.8, 2.35, 3.75, 1.8, BLUE, '📊')
card(slide, 'Precisão', 'Acertos gerais em todas as perguntas respondidas.', 4.8, 2.35, 3.75, 1.8, VIOLET, '🎯')
card(slide, 'Pontos de atenção', 'Lista todas as competências abaixo de 70%.', 8.8, 2.35, 3.75, 1.8, GREEN, '!')
text(slide, 'Exemplo de leitura:', 0.85, 4.75, 2.0, 0.25, size=14, color=MUTED, bold=True)
text(slide, '50% · 2/4', 2.7, 4.63, 2.0, 0.42, size=23, color=WHITE, bold=True)
text(slide, 'Você acertou 2 de 4 respostas naquele grupo.', 4.7, 4.75, 5.8, 0.3, size=14, color=MUTED)

# 9 achievements
slide = add_slide('Conquistas', 9)
title(slide, 'Evolua com conquistas', 'As conquistas reconhecem constância, desempenho e exploração dos conteúdos.')
items = [('Primeiro passo', '1ª pergunta', BLUE), ('Maratona', '25 respostas', VIOLET), ('Constância', '7 dias seguidos', GREEN), ('Sessão perfeita', '100% de acertos', RGBColor(255, 190, 80))]
for i, (name, rule, color) in enumerate(items):
    x = 0.85 + (i % 2) * 6.0
    y = 2.45 + (i // 2) * 1.25
    rect(slide, x, y, 5.35, 0.9, fill=SURFACE, line=SURFACE_2, radius=True)
    rect(slide, x + 0.25, y + 0.22, 0.45, 0.45, fill=color, line=color, radius=True)
    text(slide, name, x + 0.95, y + 0.18, 3.0, 0.25, size=15, color=WHITE, bold=True)
    text(slide, rule, x + 0.95, y + 0.5, 3.5, 0.2, size=11, color=MUTED)
text(slide, 'Veja as conquistas desbloqueadas e bloqueadas na tela Perfil.', 0.9, 5.5, 8.5, 0.35, size=15, color=MUTED)

# 10 FAC SAC
slide = add_slide('Ajuda', 10)
title(slide, 'Consulte a FAC antes do SAC', 'A FAC resolve as dúvidas mais comuns sem precisar abrir um chamado.')
rect(slide, 0.8, 2.35, 5.4, 3.2, fill=SURFACE, line=SURFACE_2, radius=True)
text(slide, 'FAC · Perguntas frequentes', 1.15, 2.72, 4.3, 0.3, size=17, color=WHITE, bold=True)
for i, q in enumerate(['Como salvo meu progresso?', 'Como recupero minha senha?', 'O que o Analytics coleta?', 'Como excluo minha conta?']):
    yy = 3.35 + i * 0.43
    text(slide, '›  ' + q, 1.15, yy, 4.5, 0.25, size=12, color=MUTED)
rect(slide, 6.8, 2.35, 5.4, 3.2, fill=SURFACE, line=SURFACE_2, radius=True)
text(slide, 'SAC · Abrir chamado', 7.15, 2.72, 4.3, 0.3, size=17, color=WHITE, bold=True)
bullets(slide, ['Entre na sua conta.', 'Escolha uma categoria.', 'Explique o problema com detalhes.', 'Acompanhe seus chamados recentes.'], 7.15, 3.35, 4.5, 1.8, size=13, accent=GREEN)

# 11 account menu
slide = add_slide('Conta', 11)
title(slide, 'Gerencie sua conta', 'O menu de conta reúne privacidade, sessão e exclusão dos dados.')
card(slide, 'Analytics de uso', 'Mostra quais telas e recursos são usados para orientar melhorias. Não é necessário para estudar.', 0.8, 2.35, 3.75, 2.15, BLUE, '⌁')
card(slide, 'Excluir conta', 'Remove a conta e os dados associados. A ação é confirmada antes de ser executada.', 4.8, 2.35, 3.75, 2.15, RED, '⌫')
card(slide, 'Sair da conta', 'Encerra a sessão no dispositivo atual. O progresso continua na nuvem.', 8.8, 2.35, 3.75, 2.15, VIOLET, '↪')
text(slide, 'A política de privacidade está disponível no cadastro e em data-policy.html.', 0.85, 5.35, 8.8, 0.35, size=14, color=MUTED)

# 12 troubleshooting
slide = add_slide('Solução de problemas', 12)
title(slide, 'Quando algo não sair como esperado', 'Use este checklist antes de abrir um chamado.')
bullets(slide, ['Atualize a página com Ctrl + F5 para remover cache antigo.', 'Confirme se você está na conta correta.', 'Verifique se o botão Praticar aparece apenas após uma resposta.', 'Confira se o email de recuperação chegou ao spam.', 'Se o problema continuar, abra o SAC com categoria e detalhes.'], 0.9, 2.4, 7.2, 3.0, size=16, accent=BLUE)
rect(slide, 8.7, 2.55, 3.5, 2.5, fill=SURFACE, line=SURFACE_2, radius=True)
text(slide, 'Canal oficial', 9.1, 2.95, 2.5, 0.25, size=11, color=MUTED, bold=True)
text(slide, 'acaeacademiaagile@gmail.com', 9.1, 3.45, 2.7, 0.5, size=16, color=WHITE, bold=True)
text(slide, 'Use o SAC para problemas técnicos e a política para solicitações de privacidade.', 9.1, 4.25, 2.7, 0.5, size=11, color=MUTED)

# 13 final
slide = add_slide('Resumo', 13)
title(slide, 'Seu caminho na Academia Agile', 'Explore, pratique, acompanhe e peça ajuda quando precisar.')
for i, (num, label, body, color) in enumerate([
    ('1', 'Explore', 'Conheça a Jornada e os Estudos.', BLUE),
    ('2', 'Pratique', 'Responda e revise seus conceitos.', VIOLET),
    ('3', 'Acompanhe', 'Leia suas métricas e conquistas.', GREEN),
    ('4', 'Resolva', 'Consulte a FAC e use o SAC.', RGBColor(255, 190, 80))]):
    x = 0.8 + i * 3.05
    rect(slide, x, 2.6, 2.55, 2.15, fill=SURFACE, line=SURFACE_2, radius=True)
    text(slide, num, x + 0.25, 2.9, 0.45, 0.45, size=24, color=color, bold=True)
    text(slide, label, x + 0.85, 2.95, 1.4, 0.3, size=16, color=WHITE, bold=True)
    text(slide, body, x + 0.25, 3.7, 2.0, 0.55, size=11, color=MUTED)
text(slide, 'Site: https://aeca-agile-excellence.web.app', 0.85, 5.65, 7.0, 0.3, size=14, color=BLUE, bold=True)
text(slide, 'Obrigado por fazer parte da jornada.', 0.85, 6.2, 6.5, 0.3, size=14, color=MUTED)

prs.save(OUT)
print(OUT)
