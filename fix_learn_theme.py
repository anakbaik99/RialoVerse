with open('app/learn/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

reps = [
    ('background: "#f5f4ff", padding: "24px 16px"',
     'background: "#0a0a0a", padding: "24px 16px"'),
    ('href="/" style={{ textDecoration: "none", color: "#6d28d9", fontWeight: 700 }}>\u2190 RialoVerse</a>',
     'href="/" style={{ textDecoration: "none", color: "#d7ff1f", fontWeight: 700 }}>\u2190 RialoVerse</a>'),
    ('fontSize: 12, fontWeight: 700, color: "#6d28d9", letterSpacing: 1',
     'fontSize: 12, fontWeight: 700, color: "#d7ff1f", letterSpacing: 1'),
    ('color: "#666", fontSize: 14, margin: 0',
     'color: "#8a8b9c", fontSize: 14, margin: 0'),
    ('border: activeId === t.id ? "none" : "1px solid #e0dcf5",\n                background: activeId === t.id ? "#6d28d9" : "#fff",\n                color: activeId === t.id ? "#fff" : "#333",',
     'border: activeId === t.id ? "2px solid #d7ff1f" : "2px solid #2a2b3a",\n                background: activeId === t.id ? "#d7ff1f" : "#0a0a0a",\n                color: activeId === t.id ? "#0a0a0a" : "#fff",'),
    ('borderRadius: 999,\n                border: activeId',
     'borderRadius: 0,\n                border: activeId'),
    ('background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 8px 30px rgba(0,0,0,0.08)"',
     'background: "#111218", borderRadius: 0, padding: 28, border: "2px solid #d7ff1f", boxShadow: "none"'),
    ('color: "#666", fontSize: 15, marginBottom: 20',
     'color: "#8a8b9c", fontSize: 15, marginBottom: 20'),
    ('fontSize: 14, color: "#333", lineHeight: 1.5',
     'fontSize: 14, color: "#fff", lineHeight: 1.5'),
    ('borderRadius: 12, background: "#6d28d9", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>\n              Try Swap',
     'borderRadius: 0, background: "#d7ff1f", color: "#0a0a0a", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>\n              Try Swap'),
    ('borderRadius: 12, background: "#6d28d9", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>\n              Try Faucet',
     'borderRadius: 0, background: "#d7ff1f", color: "#0a0a0a", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>\n              Try Faucet'),
    ('borderRadius: 12, background: "#6d28d9", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>\n              Chat with COMI',
     'borderRadius: 0, background: "#d7ff1f", color: "#0a0a0a", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>\n              Chat with COMI'),
]

results = []
for old, new in reps:
    c = content.count(old)
    content = content.replace(old, new)
    results.append((old[:40], c))

with open('app/learn/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

for label, c in results:
    print(f"[{c}] {label}...")
