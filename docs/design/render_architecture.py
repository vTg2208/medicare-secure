"""Render the README's standalone icon architecture SVG (Python standard library)."""
from pathlib import Path
from html import escape
import xml.etree.ElementTree as ET
import re

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/assets/medicare-architecture.svg'
VENDOR = ROOT / 'docs/assets/icons/simple-icons'
parts = []
BRAND_PATHS = {}
for name in ['react', 'vercel', 'render', 'nodedotjs', 'supabase', 'postgresql', 'fastapi']:
    root = ET.parse(VENDOR / f'{name}.svg').getroot()
    BRAND_PATHS[name] = [element.attrib['d'] for element in root if element.tag.rsplit('}', 1)[-1] == 'path']

def add(value):
    parts.append(value)

def text(x, y, value, size=18, color='#1c3c43', weight=400, anchor='middle', spacing=None):
    tracking = f' letter-spacing="{spacing}"' if spacing else ''
    add(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}"{tracking}>{escape(value)}</text>')

def segments(path):
    tokens = re.findall(r'[MHVL]|-?\d+(?:\.\d+)?', path)
    point, index, result = (0, 0), 0, []
    while index < len(tokens):
        command = tokens[index]; index += 1
        previous = point
        if command in ['M', 'L']:
            point = (float(tokens[index]), float(tokens[index+1])); index += 2
        elif command == 'H':
            point = (float(tokens[index]), point[1]); index += 1
        elif command == 'V':
            point = (point[0], float(tokens[index])); index += 1
        if command != 'M':
            result.append((previous, point))
    return result

def line(path, optional=False, arrow=True):
    route = segments(path)
    if optional:
        # Explicit segments also survive SVG-to-PDF renderers that omit dashes.
        dashes = []
        for start, end in route:
            dx, dy = end[0]-start[0], end[1]-start[1]
            length = (dx*dx+dy*dy)**.5
            for offset in range(0, int(length), 13):
                stop = min(offset+7, length)
                dashes.append(f'M{start[0]+dx*offset/length},{start[1]+dy*offset/length}L{start[0]+dx*stop/length},{start[1]+dy*stop/length}')
        path = ''.join(dashes)
    add(f'<path d="{path}" fill="none" stroke="#547179" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>')
    if arrow:
        previous, point = route[-1]
        dx, dy = point[0]-previous[0], point[1]-previous[1]
        length = (dx*dx+dy*dy)**.5
        ux, uy = dx/length, dy/length
        bx, by = point[0]-11*ux, point[1]-11*uy
        add(f'<polygon points="{point[0]},{point[1]} {bx-4.5*uy},{by+4.5*ux} {bx+4.5*uy},{by-4.5*ux}" fill="#547179"/>')

def icon(name, x, y, size=64, color='#087f78'):
    scale = size/(24 if name in BRAND_PATHS else 64)
    add(f'<g transform="translate({x-size/2} {y-size/2}) scale({scale})">')
    if name in BRAND_PATHS:
        for data in BRAND_PATHS[name]:
            add(f'<path d="{data}" fill="{color}"/>')
    else:
        add(f'<g fill="none" stroke="{color}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">{symbols[name]}</g>')
    add('</g>')

def node(name, x, y, title, detail, color='#087f78', size=64):
    icon(name, x, y, size, color)
    text(x, y+58, title, 21, weight=600)
    text(x, y+84, detail, 17, '#526b74')

def zone(x, width, brand, title, detail, color):
    add(f'<rect x="{x}" y="156" width="{width}" height="480" rx="5" fill="#fff" stroke="#cad9dc" stroke-width="1.6"/>')
    icon(brand, x+38, 193, 28, color)
    text(x+64, 200, title, 22, weight=600, anchor='start')
    text(x+24, 229, detail, 16, '#526b74', anchor='start')
    add(f'<path d="M{x+24} 247H{x+width-24}" stroke="#e0e8e9"/>')

add('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1600" height="1030" viewBox="0 0 1600 1030" role="img" aria-labelledby="title description">')
add('<title id="title">Medicare — icon-based application architecture</title>')
add('<desc id="description">Patients, care teams and administrators use the React application hosted on Vercel. Its same-origin API proxy forwards requests to the Node.js and Express API on Render. Session, role, ownership, active-care and consent checks protect access to a private PostgreSQL schema on Supabase, which retains clinical records and audit evidence. Dashed connections show separately configured ClamAV scanning, durable AES-256-GCM file storage, SMTP delivery and optional FastAPI intake. These services are not represented as already provisioned.</desc>')
add('<metadata>Brand icons: Simple Icons, CC0-1.0. Pinned provenance and license: docs/assets/icons/simple-icons/sources.json and LICENSE.md. Generic architecture symbols are original project artwork.</metadata>')
symbols = {
    'patient': '<circle cx="32" cy="18" r="10"/><path d="M12 57V48a20 20 0 0 1 40 0v9M25 45h14"/>',
    'clinician': '<circle cx="25" cy="17" r="9"/><path d="M7 56V47a18 18 0 0 1 36 0M18 35v12a7 7 0 0 0 14 0V35"/><circle cx="46" cy="47" r="6"/><path d="M46 41v-9"/>',
    'administrator': '<circle cx="27" cy="16" r="9"/><path d="M8 54V46a19 19 0 0 1 31-14M21 36l6 9 6-9M27 45v12"/><path d="m48 34 11 4v8c0 8-11 14-11 14s-11-6-11-14v-8Z"/><path d="m43 46 4 4 7-8"/>',
    'proxy': '<rect x="4" y="7" width="56" height="48" rx="5"/><path d="M4 19h56M12 13h1m6 0h1m6 0h1M14 31h34m-7-6 7 6-7 6M50 44H16m7-6-7 6 7 6"/>',
    'policy': '<path d="m32 3 23 9v17c0 16-23 31-23 31S9 45 9 29V12Z"/><path d="m21 29 8 8 16-18"/>',
    'audit': '<path d="M15 4h28l9 9v44H15Z"/><path d="M43 4v10h9M23 23h20M23 32h20M23 41h9M8 13H4v47h36v-4"/><circle cx="44" cy="48" r="9"/><path d="m40 48 3 3 6-6"/>',
    'scanner': '<path d="m27 5 20 8v15c0 14-20 27-20 27S7 42 7 28V13Z"/><circle cx="37" cy="31" r="12"/><path d="m46 40 12 13M28 31h18M37 22v18"/>',
    'files': '<path d="M3 16V8h22l7 8h29v39H3Z"/><path d="M3 21h58"/><rect x="25" y="34" width="25" height="23" rx="4"/><path d="M30 34v-6a7.5 7.5 0 0 1 15 0v6M37.5 43v6"/>',
    'mail': '<rect x="4" y="10" width="56" height="42" rx="5"/><path d="m6 13 26 20 26-20M6 49l18-16m34 16L40 33"/>',
    'lock': '<rect x="12" y="27" width="40" height="32" rx="5"/><path d="M20 27V16a12 12 0 0 1 24 0v11M32 39v9"/>',
}
add('<rect width="1600" height="1030" fill="#fff"/><g>')
text(40, 52, 'Medicare architecture', 31, weight=600, anchor='start')
text(40, 84, 'Patient-controlled care, from the browser to the private data boundary.', 18, '#526b74', anchor='start')
line('M1175 43H1220')
text(1235, 49, 'Deployed request path', 16, '#526b74', anchor='start')
line('M1175 76H1220', optional=True)
text(1235, 82, 'Configured integration', 16, '#526b74', anchor='start')

zone(300, 345, 'vercel', 'Vercel', 'Frontend hosting · Hobby', '#181b22')
zone(700, 420, 'render', 'Render', 'API hosting · Free', '#7054d4')
zone(1175, 385, 'supabase', 'Supabase', 'Private PostgreSQL database', '#278963')

# Arrows are routed in the gutters; icon captions have dedicated clear space.
line('M177 270H260M177 420H260M177 570H260M260 270V570', arrow=False)
line('M260 310H422')
text(266, 293, 'HTTPS', 16, '#526b74', anchor='start')
line('M472 401V441')
text(488, 426, 'API requests', 16, '#526b74', anchor='start')
line('M516 485H672V310H860')
text(718, 290, '/api · HTTPS', 16, '#526b74', anchor='start')
line('M910 401V449')
text(927, 429, 'Authorize each request', 16, '#526b74', anchor='start')
line('M957 500H1148V310H1315')
text(978, 481, 'Verified DB TLS', 16, '#526b74', anchor='start')
line('M1368 423V449')
text(1385, 440, 'Append evidence', 15, '#526b74', anchor='start')

text(130, 189, 'PEOPLE', 13, '#526b74', 700, spacing=1.7)
icon('patient', 130, 270, 56)
text(130, 322, 'Patients', 20, weight=600)
icon('clinician', 130, 420, 60)
text(130, 474, 'Care teams', 20, weight=600)
icon('administrator', 130, 570, 60)
text(130, 624, 'Administrators', 20, weight=600)

node('react', 472, 310, 'Web application', 'React · Vite', '#087f78', 72)
node('proxy', 472, 485, 'Same-origin API proxy', '/api rewrites', size=58)
node('nodedotjs', 910, 310, 'Application API', 'Node.js · Express', '#4e8646', 70)
node('policy', 910, 500, 'Access policy', 'Sessions · roles · consent', size=64)
text(910, 610, 'Ownership · organization · active care', 16, '#526b74')
node('postgresql', 1368, 310, 'Clinical records', 'Visits · orders · messages', '#4169a1', 74)
text(1368, 414, 'Restricted runtime database role', 15, '#526b74')
node('audit', 1368, 500, 'Audit & governance', 'Retained evidence · hash chain', size=61)
icon('lock', 1207, 615, 17, '#526b74')
text(1224, 620, 'healthcare schema · public Data API off', 15, '#526b74', anchor='start')

# Capability paths are deliberately distinct from the deployed hosting path.
line('M910 648V676M560 676H1380', optional=True, arrow=False)
text(927, 661, 'When configured', 16, '#526b74', anchor='start')
for x in [560, 1010, 1380]:
    line(f'M{x} 676V715', optional=True)
for x, width, heading in [(300, 520, 'PROTECTED UPLOADS'), (850, 320, 'COMMUNICATIONS'), (1200, 360, 'OPTIONAL AI')]:
    add(f'<rect x="{x}" y="728" width="{width}" height="238" fill="#f8fbfa"/>')
    line(f'M{x} 728H{x+width}V966H{x}V728', optional=True, arrow=False)
    text(x+24, 759, heading, 13, '#3d686c', 700, 'start', spacing=1.4)
node('scanner', 430, 850, 'Malware scanning', 'ClamAV', size=58)
node('files', 675, 850, 'Encrypted files', 'AES-256-GCM · durable storage', size=58)
line('M476 850H627')
text(551, 834, 'Clean files', 15, '#526b74')
node('mail', 1010, 850, 'Email delivery', 'SMTP · verification and invites', size=58)
node('fastapi', 1380, 850, 'AI-assisted intake', 'FastAPI · disabled by default', '#158879', 64)
text(40, 1006, 'Deployment view · optional services require their own provisioning and operational verification.', 16, '#526b74', anchor='start')
add('</g></svg>')
OUT.write_text('\n'.join(parts)+'\n', encoding='utf-8')
print('Wrote docs/assets/medicare-architecture.svg')
