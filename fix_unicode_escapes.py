with open('app/swap/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

reps = [
    ('\\u2190', '\u2190'),
    ('\\u21c5', '\u21c5'),
    ('\\u2192', '\u2192'),
    ('\\u2197', '\u2197'),
    ('\\u2705', '\u2705'),
    ('\\u039e', '\u039e'),
    ('\\u26a0\\ufe0f', '\u26a0\ufe0f'),
]

total = 0
for old, new in reps:
    c = content.count(old)
    total += c
    content = content.replace(old, new)

with open('app/swap/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Total literal escapes fixed: {total}")
