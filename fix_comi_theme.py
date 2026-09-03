with open('app/comi/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

reps = [
    ('flexDirection: "column", background: "#f5f4ff" }}>',
     'flexDirection: "column", background: "#0a0a0a" }}>'),
    ('padding: "16px 20px", background: "#fff", borderBottom: "1px solid #eee"',
     'padding: "16px 20px", background: "#111218", borderBottom: "2px solid #d7ff1f"'),
    ('href="/" style={{ textDecoration: "none", color: "#6d28d9", fontWeight: 700 }}>\u2190 RialoVerse</a>',
     'href="/" style={{ textDecoration: "none", color: "#d7ff1f", fontWeight: 700 }}>\u2190 RialoVerse</a>'),
    ('background: m.role === "user" ? "#6d28d9" : "#fff",',
     'background: m.role === "user" ? "#d7ff1f" : "#1a1b26",'),
    ('color: m.role === "user" ? "#fff" : "#222",',
     'color: m.role === "user" ? "#0a0a0a" : "#fff",'),
    ('background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", fontSize: 14, color: "#999"',
     'background: "#1a1b26", boxShadow: "none", fontSize: 14, color: "#8a8b9c"'),
    ('padding: 12, background: "#fff", borderTop: "1px solid #eee"',
     'padding: 12, background: "#111218", borderTop: "2px solid #d7ff1f"'),
    ('borderRadius: 12, border: "1px solid #ddd", fontSize: 14, outline: "none" }}',
     'borderRadius: 0, border: "2px solid #2a2b3a", background: "#0a0a0a", color: "#fff", fontSize: 14, outline: "none" }}'),
    ('borderRadius: 12, border: "none", background: "#6d28d9", color: "#fff", fontWeight: 700, cursor: loading',
     'borderRadius: 0, border: "none", background: "#d7ff1f", color: "#0a0a0a", fontWeight: 700, cursor: loading'),
]

results = []
for old, new in reps:
    c = content.count(old)
    content = content.replace(old, new)
    results.append((old[:40], c))

with open('app/comi/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

for label, c in results:
    print(f"[{c}] {label}...")
