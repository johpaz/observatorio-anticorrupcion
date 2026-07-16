#!/usr/bin/env python3
"""Genera los PDF de sustentación a partir de los documentos Markdown."""

from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)
from PIL import Image as PILImage


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "documentation"
NAVY = colors.HexColor("#002D58")
BLUE = colors.HexColor("#0D609B")
YELLOW = colors.HexColor("#FEC82F")
RED = colors.HexColor("#CE1126")
GREEN = colors.HexColor("#16865A")
INK = colors.HexColor("#17212B")
MUTED = colors.HexColor("#5C6977")
PALE = colors.HexColor("#EDF4F8")

DOCS = [
    ("docs/informe_tecnico.md", "informe_tecnico.pdf", "Informe técnico", "Observatorio Anticorrupción de Colombia"),
    ("docs/manual_usuario.md", "manual_usuario.pdf", "Manual de usuario", "Consulta, análisis y uso responsable"),
    ("docs/guia_producto_operaciones_esperanza.md", "guia_producto_operaciones_esperanza.pdf", "Guía de producto y operaciones", "Preparación de Esperanza Niño para la sustentación"),
    ("docs/infraestructura_monorepo_bun_elysia_ml.md", "infraestructura_monorepo_bun_elysia_ml.pdf", "Infraestructura y escalabilidad", "Monorepo, Bun, Elysia y Python para ML"),
]


def register_fonts() -> None:
    # ReportLab no admite los contornos PostScript de la variante OTF local de
    # Montserrat. Carlito conserva una lectura limpia y está disponible en TTF.
    base = Path("/usr/share/fonts/google-carlito-fonts")
    pdfmetrics.registerFont(TTFont("Montserrat", str(base / "Carlito-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Montserrat-SemiBold", str(base / "Carlito-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("Montserrat-Bold", str(base / "Carlito-Bold.ttf")))


def make_styles():
    sample = getSampleStyleSheet()
    return {
        "body": ParagraphStyle("Body", parent=sample["BodyText"], fontName="Montserrat", fontSize=9.3, leading=14, textColor=INK, spaceAfter=6),
        "h1": ParagraphStyle("H1", fontName="Montserrat-Bold", fontSize=20, leading=24, textColor=NAVY, spaceBefore=8, spaceAfter=10),
        "h2": ParagraphStyle("H2", fontName="Montserrat-Bold", fontSize=15, leading=19, textColor=NAVY, spaceBefore=11, spaceAfter=7, keepWithNext=True),
        "h3": ParagraphStyle("H3", fontName="Montserrat-SemiBold", fontSize=11.5, leading=15, textColor=BLUE, spaceBefore=8, spaceAfter=5, keepWithNext=True),
        "h4": ParagraphStyle("H4", fontName="Montserrat-SemiBold", fontSize=10, leading=14, textColor=GREEN, spaceBefore=7, spaceAfter=4, keepWithNext=True),
        "quote": ParagraphStyle("Quote", fontName="Montserrat-SemiBold", fontSize=9.5, leading=14, textColor=NAVY, backColor=PALE, borderColor=BLUE, borderWidth=0.8, borderPadding=8, leftIndent=7, rightIndent=7, spaceBefore=5, spaceAfter=8),
        "code": ParagraphStyle("Code", fontName="Courier", fontSize=7.4, leading=10, textColor=INK, backColor=colors.HexColor("#F4F6F8"), borderPadding=7, leftIndent=4, rightIndent=4, spaceBefore=4, spaceAfter=7),
        "small": ParagraphStyle("Small", fontName="Montserrat", fontSize=7.5, leading=10, textColor=MUTED),
        "coverTitle": ParagraphStyle("CoverTitle", fontName="Montserrat-Bold", fontSize=28, leading=33, textColor=colors.white, alignment=TA_LEFT),
        "coverSub": ParagraphStyle("CoverSub", fontName="Montserrat", fontSize=13, leading=19, textColor=colors.white, alignment=TA_LEFT),
        "coverMeta": ParagraphStyle("CoverMeta", fontName="Montserrat-SemiBold", fontSize=9, leading=14, textColor=NAVY),
    }


def inline(text: str) -> str:
    text = html.escape(text.strip(), quote=False)
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\[([^]]+)\]\(([^)]+)\)", r'<link href="\2" color="#0D609B"><u>\1</u></link>', text)
    text = re.sub(r"(?<![\"=])(https?://[^\s&lt;]+)", r'<link href="\1" color="#0D609B"><u>\1</u></link>', text)
    return text


def page_background(canvas, doc) -> None:
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, h - 13 * mm, w, 13 * mm, fill=1, stroke=0)
    canvas.setFillColor(YELLOW)
    canvas.rect(0, h - 13.8 * mm, w * 0.72, 0.8 * mm, fill=1, stroke=0)
    canvas.setFillColor(RED)
    canvas.rect(w * 0.72, h - 13.8 * mm, w * 0.14, 0.8 * mm, fill=1, stroke=0)
    canvas.setFillColor(GREEN)
    canvas.rect(w * 0.86, h - 13.8 * mm, w * 0.14, 0.8 * mm, fill=1, stroke=0)
    canvas.setFont("Montserrat-SemiBold", 7.5)
    canvas.setFillColor(colors.white)
    canvas.drawString(17 * mm, h - 8.5 * mm, "OBSERVATORIO ANTICORRUPCIÓN DE COLOMBIA")
    canvas.setStrokeColor(colors.HexColor("#D8E1E7"))
    canvas.line(17 * mm, 14 * mm, w - 17 * mm, 14 * mm)
    canvas.setFont("Montserrat", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(17 * mm, 9 * mm, "Datos al Ecosistema 2026 · Innovación y Tecnología")
    canvas.drawRightString(w - 17 * mm, 9 * mm, f"{doc.page}")
    canvas.restoreState()


def cover_background(canvas, doc) -> None:
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.setFillColor(BLUE)
    canvas.circle(w * 0.92, h * 0.86, 50 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#004878"))
    canvas.circle(w * 0.06, h * 0.10, 38 * mm, fill=1, stroke=0)
    canvas.setFillColor(YELLOW)
    canvas.rect(0, 0, w * 0.68, 6 * mm, fill=1, stroke=0)
    canvas.setFillColor(RED)
    canvas.rect(w * 0.68, 0, w * 0.16, 6 * mm, fill=1, stroke=0)
    canvas.setFillColor(GREEN)
    canvas.rect(w * 0.84, 0, w * 0.16, 6 * mm, fill=1, stroke=0)
    canvas.restoreState()


def image_flowable(path: Path, max_w=174 * mm, max_h=103 * mm):
    with PILImage.open(path) as im:
        iw, ih = im.size
    scale = min(max_w / iw, max_h / ih)
    return Image(str(path), width=iw * scale, height=ih * scale)


def table_flow(rows, styles):
    cooked = [[Paragraph(inline(cell), styles["small"]) for cell in row] for row in rows]
    cols = max(len(r) for r in cooked)
    for row in cooked:
        row.extend([Paragraph("", styles["small"])] * (cols - len(row)))
    width = 174 * mm
    tbl = Table(cooked, colWidths=[width / cols] * cols, repeatRows=1, hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Montserrat-SemiBold"),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#BAC8D2")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return tbl


def parse_markdown(path: Path, styles):
    lines = path.read_text(encoding="utf-8").splitlines()
    story, paragraph, bullets, code = [], [], [], []
    in_code = False

    def flush_paragraph():
        if paragraph:
            story.append(Paragraph(inline(" ".join(paragraph)), styles["body"]))
            paragraph.clear()

    def flush_bullets():
        if bullets:
            items = [ListItem(Paragraph(inline(item), styles["body"]), leftIndent=7) for item in bullets]
            story.append(ListFlowable(items, bulletType="bullet", start="circle", leftIndent=15, bulletFontName="Montserrat", bulletFontSize=6, spaceAfter=5))
            bullets.clear()

    i = 0
    skipped_title = False
    while i < len(lines):
        raw = lines[i].rstrip()
        stripped = raw.strip()
        if stripped.startswith("```"):
            flush_paragraph(); flush_bullets()
            if in_code:
                story.append(Preformatted("\n".join(code), styles["code"])); code.clear()
            in_code = not in_code; i += 1; continue
        if in_code:
            code.append(raw); i += 1; continue
        if not stripped:
            flush_paragraph(); flush_bullets(); i += 1; continue
        if stripped.startswith("| ") and i + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-+", lines[i + 1]):
            flush_paragraph(); flush_bullets()
            rows = []
            rows.append([c.strip() for c in stripped.strip("|").split("|")])
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            story.append(table_flow(rows, styles)); story.append(Spacer(1, 7)); continue
        image_match = re.match(r"!\[([^]]*)\]\(([^)]+)\)", stripped)
        if image_match:
            flush_paragraph(); flush_bullets()
            img_path = (path.parent / image_match.group(2)).resolve()
            if img_path.exists():
                story.append(KeepTogether([image_flowable(img_path), Spacer(1, 8)]))
            i += 1; continue
        head = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if head:
            flush_paragraph(); flush_bullets()
            level, value = len(head.group(1)), head.group(2)
            if level == 1 and not skipped_title:
                skipped_title = True; i += 1; continue
            story.append(Paragraph(inline(value), styles[f"h{level}"])); i += 1; continue
        if stripped.startswith(">"):
            flush_paragraph(); flush_bullets()
            story.append(Paragraph(inline(stripped.lstrip("> ")), styles["quote"])); i += 1; continue
        if re.match(r"^[-*]\s+", stripped):
            flush_paragraph(); bullets.append(re.sub(r"^[-*]\s+", "", stripped)); i += 1; continue
        numbered = re.match(r"^(\d+)\.\s+(.+)", stripped)
        if numbered:
            flush_paragraph(); flush_bullets()
            story.append(Paragraph(f'<font color="#0D609B"><b>{numbered.group(1)}.</b></font> {inline(numbered.group(2))}', styles["body"])); i += 1; continue
        paragraph.append(stripped); i += 1
    flush_paragraph(); flush_bullets()
    return story


def build(source: str, output: str, title: str, subtitle: str, styles) -> None:
    path = ROOT / source
    out = OUT / output
    doc = BaseDocTemplate(str(out), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=21 * mm, bottomMargin=18 * mm, title=title, author="John Paez y Esperanza Niño")
    cover_frame = Frame(20 * mm, 25 * mm, 170 * mm, 245 * mm, id="cover", showBoundary=0)
    body_frame = Frame(18 * mm, 18 * mm, 174 * mm, 257 * mm, id="body", showBoundary=0)
    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[cover_frame], onPage=cover_background),
        PageTemplate(id="Body", frames=[body_frame], onPage=page_background),
    ])
    story = [
        Spacer(1, 58 * mm),
        Paragraph(title, styles["coverTitle"]),
        Spacer(1, 6 * mm),
        Paragraph(subtitle, styles["coverSub"]),
        Spacer(1, 18 * mm),
        Table([[Paragraph("DATOS AL ECOSISTEMA 2026", styles["coverMeta"])], [Paragraph("Reto 7 · Innovación y Tecnología", styles["coverMeta"])], [Paragraph("John Paez · Desarrollo de software<br/>Esperanza Niño · Producto y operaciones", styles["coverMeta"])]], colWidths=[105 * mm], style=TableStyle([("BACKGROUND", (0,0), (-1,-1), YELLOW), ("BOX", (0,0), (-1,-1), 0, YELLOW), ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10), ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7)])),
        NextPageTemplate("Body"), PageBreak(),
    ]
    story.extend(parse_markdown(path, styles))
    doc.build(story)


def main() -> None:
    register_fonts()
    OUT.mkdir(parents=True, exist_ok=True)
    styles = make_styles()
    for source, output, title, subtitle in DOCS:
        build(source, output, title, subtitle, styles)
        print(f"Generado: {OUT / output}")


if __name__ == "__main__":
    main()
