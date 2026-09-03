import re

with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the top "stats" section (Market Overview with real pool data)
content = re.sub(r'\s*<section className="stats">.*?</section>', '', content, count=1, flags=re.DOTALL)

# Remove the entire "lowerGrid" section (fake Market Overview + Recent Transactions panels)
content = re.sub(r'\s*<section className="lowerGrid">.*?</section>\s*(?=</section>)', '\n', content, count=1, flags=re.DOTALL)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
