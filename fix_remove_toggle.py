with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('const [dark, setDark] = useState(true);\n', ''),
    ('className={dark ? "site dark" : "site"}', 'className="site dark"'),
    ('<button className="theme" onClick={() => setDark(!dark)}>{dark ? "☀" : "☾"}</button>', ''),
]

total = 0
for old, new in replacements:
    c = content.count(old)
    total += c
    content = content.replace(old, new)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Total replaced: {total} (expect 3)")
