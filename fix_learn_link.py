with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '<button>Learn More&nbsp; \u2192</button>'
new = '<a href="/learn" style={{ padding: "10px 20px", borderRadius: 12, background: "#6d28d9", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Learn More \u2192</a>'

count = content.count(old)
content = content.replace(old, new)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count} occurrence(s)")
