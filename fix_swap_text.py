with open('app/swap/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

reps = [
    ('<label style={{ fontSize: 12, color: "#888" }}>You pay</label>',
     '<label style={{ fontSize: 12, color: "#8a8b9c" }}>You pay</label>'),
    ('<span style={{ fontSize: 12, color: "#888" }}>',
     '<span style={{ fontSize: 12, color: "#8a8b9c" }}>'),
    ('<label style={{ fontSize: 12, color: "#888" }}>You receive (estimated)</label>',
     '<label style={{ fontSize: 12, color: "#8a8b9c" }}>You receive (estimated)</label>'),
    ('fontSize: 22, color: "#333", overflow: "hidden"',
     'fontSize: 22, color: "#fff", overflow: "hidden"'),
    ('color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 10',
     'color: "#ff4d4d", fontSize: 13, textAlign: "center", marginBottom: 10'),
    ('color: "#dc2626", marginTop: 12, textAlign: "center", fontSize: 13',
     'color: "#ff4d4d", marginTop: 12, textAlign: "center", fontSize: 13'),
    ('<p style={{ fontSize: 13, color: "#888", textAlign: "center" }}>No swaps yet.</p>',
     '<p style={{ fontSize: 13, color: "#8a8b9c", textAlign: "center" }}>No swaps yet.</p>'),
    ('<div style={{ fontSize: 11, color: "#999" }}>',
     '<div style={{ fontSize: 11, color: "#8a8b9c" }}>'),
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
