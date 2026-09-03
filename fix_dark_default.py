with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = 'const [dark, setDark] = useState(false);'
new = 'const [dark, setDark] = useState(true);'

count = content.count(old)
content = content.replace(old, new, 1)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count} occurrence(s)")
