import re

with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add useReadContract import
content = content.replace(
    'import { useAccount } from "wagmi";',
    'import { useAccount, useReadContract } from "wagmi";'
)

# 2. Add viem import for formatting
content = content.replace(
    'import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";',
    'import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";\nimport { formatEther, formatUnits } from "viem";'
)

# 3. Add contract constants after features array closing, before export default function Home
addresses_block = '''
const TOKEN_ADDRESS = "0xEf601624E09126E369887D2845B68F4f9e968831";
const SWAP_ADDRESS = "0x2697Dc3195Fc5B37047D5E50C2f22a016cF4e2CD";
const SWAP_ABI = [
  { name: "getEthReserve", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getTokenReserve", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

'''
content = content.replace(
    'export default function Home() {',
    addresses_block + 'export default function Home() {'
)

# 4. Add hooks inside Home() right after existing useAccount line
content = content.replace(
    'const { address, isConnected } = useAccount();',
    '''const { address, isConnected } = useAccount();
  const { data: ethReserve } = useReadContract({ address: SWAP_ADDRESS, abi: SWAP_ABI, functionName: "getEthReserve" });
  const { data: tokenReserve } = useReadContract({ address: SWAP_ADDRESS, abi: SWAP_ABI, functionName: "getTokenReserve" });

  const rialoPriceInEth = ethReserve && tokenReserve && tokenReserve > 0n
    ? Number(formatEther(ethReserve)) / Number(formatUnits(tokenReserve, 18))
    : 0;
  const poolTvlEth = ethReserve ? Number(formatEther(ethReserve)) * 2 : 0;
  const poolRialoReserve = tokenReserve ? Number(formatUnits(tokenReserve, 18)) : 0;'''
)

# 5. Replace the stats section
old_stats_pattern = re.compile(
    r'<section className="stats">.*?</section>',
    re.DOTALL
)

new_stats = '''<section className="stats">
        <div className="sectionHead">
          <div><h2>Market Overview</h2><p>Live data from the RialoVerse liquidity pool.</p></div>
        </div>
        <Stat icon="◈" title="RIALO Price" value={`${rialoPriceInEth.toFixed(6)} ETH`} change="" />
        <Stat icon="⛁" title="Pool Liquidity" value={`${poolTvlEth.toFixed(4)} ETH`} change="" />
        <Stat icon="⬡" title="RIALO in Pool" value={poolRialoReserve.toLocaleString(undefined, {maximumFractionDigits: 2})} change="" />
        <Stat icon="◆" title="Total Supply" value="1,000,000 RIALO" change="" />
      </section>'''

content = old_stats_pattern.sub(new_stats, content, count=1)

# 6. Update Stat component to hide the change/label row when change is empty
content = content.replace(
    'function Stat({icon,title,value,change}) {\n  return <div className="stat"><span className="statIcon">{icon}</span><div><small>{title}</small><b>{value}</b><em>{change}</em><label>vs last 24h</label></div></div>\n}',
    '''function Stat({icon,title,value,change}) {
  return <div className="stat"><span className="statIcon">{icon}</span><div><small>{title}</small><b>{value}</b>{change ? <em>{change}</em> : null}</div></div>
}'''
)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
