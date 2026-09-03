with open('app/globals.css', 'r', encoding='utf-8') as f:
    content = f.read()

old = 'font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
new = 'font-family:var(--font-space-grotesk),Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'

count = content.count(old)
content = content.replace(old, new, 1)

with open('app/globals.css', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count} occurrence(s)")
