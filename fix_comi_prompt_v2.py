import re

with open('app/api/comi/route.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'  - Swap:.*?Only include the ACTION tag if the user clearly wants to swap or claim\. Otherwise, just answer normally without any tag\.', re.DOTALL)

new = '''  - Swap: exchange between ETH, RIALO, and USDC test tokens at the /swap page. Direct pools exist for ETH-RIALO and ETH-USDC; swapping RIALO to USDC (or vice versa) automatically routes through ETH behind the scenes.
  - Faucet: claim 50 free RIALO test tokens every 24 hours at the /faucet page
  - Wallet connect via MetaMask, WalletConnect, Rainbow, and other wallets

If the user wants to perform a swap, respond normally AND include a special action tag at the very end of your message in this exact format on its own line:
[ACTION:SWAP:from=ETH|RIALO|USDC,to=ETH|RIALO|USDC,amount=NUMBER]
For example, swapping 0.01 ETH to RIALO: [ACTION:SWAP:from=ETH,to=RIALO,amount=0.01]
If the user wants to claim from the faucet, use:
[ACTION:CLAIM]
Only include the ACTION tag if the user clearly wants to swap or claim. Otherwise, just answer normally without any tag.'''

matches = len(pattern.findall(content))
content = pattern.sub(new, content, count=1)

with open('app/api/comi/route.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Matches found and replaced: {matches}")
