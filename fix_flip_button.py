with open('app/swap/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '<button onClick={flipDirection} style={{ border: "none", background: "#1a1b26", borderRadius: 0, border: "2px solid #d7ff1f", width: 36, height: 36, cursor: "pointer" }}>\u21c5</button>'
new = '<button onClick={flipDirection} style={{ background: "#1a1b26", borderRadius: 0, border: "2px solid #d7ff1f", color: "#d7ff1f", fontSize: 18, width: 36, height: 36, cursor: "pointer" }}>\u21c5</button>'

count = content.count(old)
content = content.replace(old, new)

with open('app/swap/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count} occurrence(s)")
