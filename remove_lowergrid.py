import re

with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(
    r'\s*<section className="lowerGrid">.*?\n\s*</section>\n',
    '\n',
    content,
    count=1,
    flags=re.DOTALL
)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
