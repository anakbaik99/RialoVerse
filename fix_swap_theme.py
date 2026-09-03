with open('app/swap/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

reps = [
    # page background
    ('background: "#f5f4ff"', 'background: "#0a0a0a"'),
    # cards (appears twice)
    ('background: "#fff", borderRadius: 20, padding: 20, boxShadow: "0 8px 30px rgba(0,0,0,0.08)"',
     'background: "#111218", borderRadius: 0, padding: 20, border: "2px solid #d7ff1f", boxShadow: "none"'),
    # small address badge
    ('border: "1px solid #e0dcf5", background: "#f7f7fb", color: "#6d28d9"',
     'border: "2px solid #d7ff1f", background: "#0a0a0a", color: "#d7ff1f"'),
    # slippage selected/unselected ternary
    ('border: slippageBps === bps ? "1px solid #6d28d9" : "1px solid #e0dcf5"',
     'border: slippageBps === bps ? "2px solid #d7ff1f" : "2px solid #2a2b3a"'),
    ('background: slippageBps === bps ? "#ede9fe" : "#fff"',
     'background: slippageBps === bps ? "#1a1b26" : "#111218"'),
    # input container boxes
    ('background: "#f7f7fb", borderRadius: 14, padding: 14, marginBottom: 8',
     'background: "#15161f", borderRadius: 0, padding: 14, marginBottom: 8'),
    ('background: "#f7f7fb", borderRadius: 14, padding: 14, marginBottom: 10',
     'background: "#15161f", borderRadius: 0, padding: 14, marginBottom: 10'),
    # percentage quick buttons
    ('border: "1px solid #e0dcf5", background: "#fff", color: "#6d28d9"',
     'border: "2px solid #2a2b3a", background: "#0a0a0a", color: "#d7ff1f"'),
    # flip direction circle button
    ('background: "#ede9fe", borderRadius: 999',
     'background: "#1a1b26", borderRadius: 0, border: "2px solid #d7ff1f"'),
    # connect wallet button in swap card
    ('background: "#6d28d9", color: "#fff", border: "none", fontWeight: 700, fontSize: 16 }}>\n            Connect',
     'background: "#d7ff1f", color: "#0a0a0a", border: "none", fontWeight: 700, fontSize: 16 }}>\n            Connect'),
    # disabled swap button purple
    ('background: buttonDisabled ? "#c4b5fd" : "#6d28d9", color: "#fff"',
     'background: buttonDisabled ? "#333" : "#d7ff1f", color: buttonDisabled ? "#888" : "#0a0a0a"'),
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
