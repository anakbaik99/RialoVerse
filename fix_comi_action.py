with open('app/comi/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''    if (action.type === "SWAP") {
      const dir = action.params.direction || "ETH_TO_RIALO";
      const amount = action.params.amount || "";
      router.push(`/swap?direction=${dir}&amount=${amount}`);
    } else if (action.type === "CLAIM") {'''

new = '''    if (action.type === "SWAP") {
      const from = action.params.from || "ETH";
      const to = action.params.to || "RIALO";
      const amount = action.params.amount || "";
      router.push(`/swap?from=${from}&to=${to}&amount=${amount}`);
    } else if (action.type === "CLAIM") {'''

count = content.count(old)
content = content.replace(old, new, 1)

with open('app/comi/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count} occurrence(s)")
