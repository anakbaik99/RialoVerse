with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = 'const [wallet, setWallet] = useState(false);'
new = 'const [wallet, setWallet] = useState(false);\n  const [menuOpen, setMenuOpen] = useState(false);'

count = content.count(old)
content = content.replace(old, new, 1)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count} occurrence(s)")
