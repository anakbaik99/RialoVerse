with open('app/globals.css', 'r', encoding='utf-8') as f:
    content = f.read()

old1 = 'h1,h2,h3,.brand b{font-family:var(--font-anton),var(--font-space-grotesk),sans-serif;letter-spacing:-.5px;text-transform:uppercase}'
new1 = 'h1,h2,h3,.brand b{font-family:var(--font-anton),var(--font-space-grotesk),sans-serif;letter-spacing:.5px;text-transform:uppercase}'
c1 = content.count(old1)
content = content.replace(old1, new1, 1)

old2 = '.hero h1{letter-spacing:-1px}'
new2 = '.hero h1{letter-spacing:1px;line-height:1.08}'
c2 = content.count(old2)
content = content.replace(old2, new2, 1)

with open('app/globals.css', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced h1/h2/h3: {c1}, Replaced .hero h1: {c2}")
