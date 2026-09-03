with open('app/swap/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

reps = [
    ('href="/" style={{ textDecoration: "none", color: "#6d28d9", fontWeight: 700 }}>\u2190 RialoVerse</a>',
     'href="/" style={{ textDecoration: "none", color: "#d7ff1f", fontWeight: 700 }}>\u2190 RialoVerse</a>'),
    ('color: "#6d28d9", fontWeight: 600,',
     'color: "#d7ff1f", fontWeight: 600,'),
    ('<span style={{ fontSize: 11, color: "#6d28d9" }}>View \u2197</span>',
     '<span style={{ fontSize: 11, color: "#d7ff1f" }}>View \u2197</span>'),
]

results = []
for old, new in reps:
    c = content.count(old)
    content = content.replace(old, new)
    results.append((old[:40], c))

with open('app/swap/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

for label, c in results:
    print(f"[{c}] {label}...")
