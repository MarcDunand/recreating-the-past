from html.parser import HTMLParser
import re

HTML_PATH = r"c:\Users\Owner\Documents\dev\RTPwebsite\contentDump\nancy-burson-and-jason-salavon\raw\Homework 6 (Nancy Burson _ Jason Salavon)\Homework6_NancyBursonJasonSalavon_.html"

with open(HTML_PATH, 'rb') as f:
    raw = f.read()

text = raw.decode('utf-8', errors='replace')

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []          # list of rows; each row = list of cells; each cell = {'imgs': [], 'links': [], 'text': ''}
        self.paragraphs = []    # (position_index, text, href_if_any)
        self.current_row = None
        self.current_cell = None
        self.in_table = False
        self.depth = 0          # track nesting
        self.text_buf = ''
        self.current_href = None
        self.global_idx = 0     # global element counter (rows + paragraphs share this)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'table':
            self.in_table = True
            self.depth += 1
        elif tag == 'tr' and self.depth == 1:
            self.current_row = []
            self.global_idx += 1
        elif tag == 'td' and self.depth == 1:
            self.current_cell = {'imgs': [], 'links': [], 'text': ''}
        elif tag == 'img':
            src = attrs.get('src', '')
            if self.current_cell is not None:
                self.current_cell['imgs'].append(src)
        elif tag == 'a':
            href = attrs.get('href', '')
            self.current_href = href
            if self.current_cell is not None:
                if href:
                    self.current_cell['links'].append(href)
        elif tag in ('p', 'h1', 'h2', 'h3', 'h4', 'span'):
            self.text_buf = ''

    def handle_endtag(self, tag):
        if tag == 'table':
            self.depth -= 1
        elif tag == 'tr' and self.depth == 1:
            if self.current_row is not None:
                self.rows.append({'idx': self.global_idx, 'cells': self.current_row})
                self.current_row = None
        elif tag == 'td' and self.depth == 1:
            if self.current_cell is not None and self.current_row is not None:
                self.current_row.append(self.current_cell)
            self.current_cell = None
        elif tag == 'a':
            self.current_href = None
        elif tag in ('p', 'h2', 'h3', 'h4'):
            t = self.text_buf.strip()
            if t and self.current_cell is None:
                self.global_idx += 1
                self.paragraphs.append({'idx': self.global_idx, 'text': t})
            self.text_buf = ''

    def handle_data(self, data):
        if self.current_cell is not None:
            self.current_cell['text'] += data
        else:
            self.text_buf += data

p = Parser()
p.feed(text)

print("=== PARAGRAPHS (outside tables) ===")
for pg in p.paragraphs:
    print(f"  [{pg['idx']}] {pg['text'][:120]}")

print()
print("=== TABLE ROWS ===")
for row in p.rows:
    cells = row['cells']
    cell_summaries = []
    for i, c in enumerate(cells):
        imgs = [re.sub(r'.*images/', '', img) for img in c['imgs']]
        links = [l for l in c['links'] if not l.startswith('images/')]
        txt = c['text'].strip()[:60]
        cell_summaries.append(f"TD{i}[imgs={imgs} links={links} text={repr(txt)}]")
    print(f"  ROW[{row['idx']}]: {' | '.join(cell_summaries)}")
