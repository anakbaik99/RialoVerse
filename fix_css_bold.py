with open('app/globals.css', 'r', encoding='utf-8') as f:
    content = f.read()

old = '.hero h1 span{color:#6b42f4}'
new = '.hero h1 .accent{color:#6b42f4}'
count1 = content.count(old)
content = content.replace(old, new, 1)

with open('app/globals.css', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count1} occurrence(s)")
