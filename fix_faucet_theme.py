with open('app/faucet/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

reps = [
    ('background: "#f5f4ff", boxSizing: "border-box" }}>',
     'background: "#0a0a0a", boxSizing: "border-box" }}>'),
    ('background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 8px 30px rgba(0,0,0,0.08)"',
     'background: "#111218", borderRadius: 0, padding: 24, border: "2px solid #d7ff1f", boxShadow: "none"'),
    ('href="/" style={{ textDecoration: "none", color: "#6d28d9", fontWeight: 700 }}>\u2190 RialoVerse</a>',
     'href="/" style={{ textDecoration: "none", color: "#d7ff1f", fontWeight: 700 }}>\u2190 RialoVerse</a>'),
    ('border: "1px solid #e0dcf5", background: "#f7f7fb", color: "#6d28d9", fontWeight: 600, cursor: "pointer" }}>\n              {address.slice(0, 6)}',
     'border: "2px solid #d7ff1f", background: "#0a0a0a", color: "#d7ff1f", fontWeight: 600, cursor: "pointer" }}>\n              {address.slice(0, 6)}'),
    ('color: "#666", fontSize: 14, marginBottom: 20',
     'color: "#8a8b9c", fontSize: 14, marginBottom: 20'),
    ('background: "#f7f7fb", borderRadius: 14, padding: 14, marginBottom: 20',
     'background: "#15161f", borderRadius: 0, padding: 14, marginBottom: 20'),
    ('fontSize: 12, color: "#888" }}>Your RIALO balance',
     'fontSize: 12, color: "#8a8b9c" }}>Your RIALO balance'),
    ('background: "#6d28d9", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>\n            Connect Wallet',
     'background: "#d7ff1f", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16 }}>\n            Connect Wallet'),
    ('background: "#c4b5fd", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>\n            Faucet Empty',
     'background: "#333", color: "#888", border: "none", fontWeight: 700, fontSize: 16 }}>\n            Faucet Empty'),
    ('background: "#c4b5fd", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>\n            Next claim',
     'background: "#333", color: "#888", border: "none", fontWeight: 700, fontSize: 16 }}>\n            Next claim'),
    ('background: "#6d28d9", color: "#fff", border: "none", fontWeight: 700, fontSize: 16, cursor: canClaim',
     'background: "#d7ff1f", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16, cursor: canClaim'),
    ('color: "#dc2626", marginTop: 12, fontSize: 13',
     'color: "#ff4d4d", marginTop: 12, fontSize: 13'),
]

results = []
for old, new in reps:
    c = content.count(old)
    content = content.replace(old, new)
    results.append((old[:40], c))

with open('app/faucet/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

for label, c in results:
    print(f"[{c}] {label}...")
