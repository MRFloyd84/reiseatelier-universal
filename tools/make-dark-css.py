#!/usr/bin/env python3
"""Erzeugt dark.css aus style.css: Jede Farbangabe bekommt eine dunkle Entsprechung
(gleicher Farbton, Helligkeit gespiegelt) unter html[data-theme=dark].
Nach Änderungen an style.css einfach neu ausführen:  python3 tools/make-dark-css.py"""
import re, colorsys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / 'style.css').read_text(encoding='utf-8')
PROPS = re.compile(r'^(--[\w-]+|color|background(-color|-image)?|border(-top|-bottom|-left|-right)?(-color)?|outline(-color)?|fill|stroke|text-decoration-color|caret-color|accent-color|column-rule-color)$')
NAMED = {'white': '#ffffff', 'black': '#000000'}
COLOR = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b')

def parse(tok):
    tok = NAMED.get(tok, tok)
    if tok.startswith('#'):
        h = tok[1:]
        if len(h) in (3, 4): h = ''.join(c * 2 for c in h)
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1
        return r, g, b, a
    nums = [x.strip() for x in tok[tok.index('(') + 1:-1].replace('/', ',').split(',')]
    r, g, b = (float(x) / 255 for x in nums[:3])
    a = float(nums[3]) if len(nums) > 3 else 1
    return r, g, b, a

def dark(tok, prop):
    r, g, b, a = parse(tok)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    if prop.startswith('background') or prop in ('--bg', '--white', '--line') or prop.startswith('border'):
        # Flächen: sehr hell -> dunkle Fläche; schon dunkle Flächen bleiben; gesättigte Akzente etwas abdunkeln
        if prop == '--bg': l2 = 0.07; s = min(s, 0.25)
        elif l > 0.8: l2 = 0.11 + (1 - l) * 0.6; s = min(s * 0.5, 0.3)
        elif l < 0.35: l2 = l
        elif s > 0.35: l2 = l * 0.85
        else: l2 = 1 - l
    else:
        # Schrift: dunkle Schrift wird hell; helle Schrift (auf farbigen Flächen) bleibt
        if l > 0.8 and prop != '--navy': l2 = l
        else:
            l2 = 1 - l
            if s > 0.35 and l < 0.5: l2 = min(0.78, max(l2, 0.62))
        if prop == '--navy': l2 = 0.88; s = s * 0.4
        if prop == '--teal': l2 = 0.40
    l2 = max(0.0, min(1.0, l2))
    r2, g2, b2 = colorsys.hls_to_rgb(h, l2, s)
    if a < 1:
        return f'rgba({round(r2*255)},{round(g2*255)},{round(b2*255)},{round(a,3)})'
    return '#%02x%02x%02x' % (round(r2 * 255), round(g2 * 255), round(b2 * 255))

def prefix(sel):
    out = []
    for s in sel.split(','):
        s = s.strip()
        if not s: continue
        if s in (':root', 'html'): out.append('html[data-theme=dark]')
        elif s.startswith('html'): out.append('html[data-theme=dark]' + s[4:])
        else: out.append('html[data-theme=dark] ' + s)
    return ','.join(out)

def rules(css):
    """Liefert (Kontext, Selektor, Deklarationen) – Kontext ist eine @media-Zeile oder ''."""
    i, n, ctx = 0, len(css), []
    out = []
    while i < n:
        j = css.find('{', i)
        if j < 0: break
        head = css[i:j].strip()
        if head.startswith('@media') or head.startswith('@supports'):
            depth, k = 1, j + 1
            while depth and k < n:
                if css[k] == '{': depth += 1
                elif css[k] == '}': depth -= 1
                k += 1
            if 'print' not in head:
                for _, sel, body in rules(css[j + 1:k - 1]):
                    out.append((head, sel, body))
            i = k; continue
        if head.startswith('@'):  # @keyframes u. a. überspringen
            depth, k = 1, j + 1
            while depth and k < n:
                if css[k] == '{': depth += 1
                elif css[k] == '}': depth -= 1
                k += 1
            i = k; continue
        k = css.find('}', j)
        out.append(('', head, css[j + 1:k]))
        i = k + 1
    return out

css = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
blocks = {}
for ctx, sel, body in rules(css):
    decls = []
    for d in body.split(';'):
        if ':' not in d: continue
        p, v = d.split(':', 1)
        p = p.strip()
        if not PROPS.match(p) or not COLOR.search(v): continue
        if 'url(' in v: continue
        nv = COLOR.sub(lambda m: dark(m.group(0), p), v)
        decls.append(f'{p}:{nv.strip()}')
    if decls:
        blocks.setdefault(ctx, []).append(f'{prefix(sel)}{{{";".join(decls)}}}')
manual = (ROOT / 'tools' / 'dark-extra.css').read_text(encoding='utf-8') if (ROOT / 'tools' / 'dark-extra.css').exists() else ''
parts = ['/* Automatisch erzeugt aus style.css von tools/make-dark-css.py – nicht von Hand bearbeiten. */']
for ctx, lines in blocks.items():
    parts.append('\n'.join(lines) if not ctx else ctx + '{' + '\n'.join(lines) + '}')
parts.append('/* Ergänzungen aus tools/dark-extra.css */\n' + manual)
(ROOT / 'dark.css').write_text('\n'.join(parts), encoding='utf-8')
print('dark.css:', sum(len(v) for v in blocks.values()), 'Regeln')
