with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '<h1>Welcome to<br/>Rialo<span>Verse</span></h1>'
new = '<h1 className="heroTitleMask"><span className="heroTitleInner">Welcome to<br/>Rialo<span className="accent">Verse</span></span></h1>'

count = content.count(old)
content = content.replace(old, new, 1)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count} occurrence(s)")
