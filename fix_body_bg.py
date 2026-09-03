with open('app/globals.css', 'r', encoding='utf-8') as f:
    content = f.read()

old = 'background:#fafaff;color:#15172b}'
new = 'background:#0a0a0a;color:#f5f4ff}'
count = content.count(old)
content = content.replace(old, new, 1)

old2 = '.site{min-height:100vh;background:linear-gradient(180deg,#fff 0%,#fbfaff 55%,#fff 100%);transition:.2s}'
new2 = '.site{min-height:100vh;background:#0a0a0a;transition:.2s}'
count2 = content.count(old2)
content = content.replace(old2, new2, 1)

with open('app/globals.css', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced body: {count}, Replaced .site: {count2}")
