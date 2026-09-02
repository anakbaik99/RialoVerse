import re

with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(
    r'<button className="wallet" onClick=\{\(\) => setWallet\(!wallet\)\}>\s*'
    r'\{wallet \? "0x71\.\.\.a92F" : "Connect Wallet"\}\s*</button>'
)
replacement = (
    '<button className="wallet" onClick={isConnected ? openAccountModal : openConnectModal}>\n'
    '            {isConnected ? `${address.slice(0,6)}...${address.slice(-4)}` : "Connect Wallet"}\n'
    '          </button>'
)
content, n = pattern.subn(replacement, content)
print("button replaced:", n, "kali")

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)
