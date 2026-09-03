"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { formatEther, formatUnits } from "viem";

const features = [
  ["⇄", "Swap", "Swap tokens instantly with the best rates.", "Go to Swap"],
  ["🎮", "Games", "Play exciting games and earn rewards.", "Go to Games"],
  ["💧", "Faucet", "Get test tokens on Ethereum Sepolia.", "Go to Faucet"],
  ["$", "Portfolio", "Track your assets and portfolio balance.", "Go to Portfolio"],
  ["🤖", "COMI", "Your AI assistant for everything RialoVerse.", "Chat with COMI"],
];

const games = [
  ["🎡", "Rialo Wheel", "Spin & Win", "1,245 Players", "Hot"],
  ["◇", "Cube Runner", "Endless Runner", "872 Players", "New"],
  ["⚔", "Battle Arena", "PvP Battle", "1,532 Players", ""],
  ["◆", "Token Match", "Match & Earn", "654 Players", ""],
];


const TOKEN_ADDRESS = "0xEf601624E09126E369887D2845B68F4f9e968831";
const SWAP_ADDRESS = "0x2697Dc3195Fc5B37047D5E50C2f22a016cF4e2CD";
const SWAP_ABI = [
  { name: "getEthReserve", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getTokenReserve", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

export default function Home() {
  const [wallet, setWallet] = useState(false);
  const { address, isConnected } = useAccount();
  const { data: ethReserve } = useReadContract({ address: SWAP_ADDRESS, abi: SWAP_ABI, functionName: "getEthReserve" });
  const { data: tokenReserve } = useReadContract({ address: SWAP_ADDRESS, abi: SWAP_ABI, functionName: "getTokenReserve" });

  const rialoPriceInEth = ethReserve && tokenReserve && tokenReserve > 0n
    ? Number(formatEther(ethReserve)) / Number(formatUnits(tokenReserve, 18))
    : 0;
  const poolTvlEth = ethReserve ? Number(formatEther(ethReserve)) * 2 : 0;
  const poolRialoReserve = tokenReserve ? Number(formatUnits(tokenReserve, 18)) : 0;
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const [dark, setDark] = useState(false);

  return (
    <main className={dark ? "site dark" : "site"}>
      <header className="topbar">
        <div className="brand"><span className="brandMark">R</span><b>Rialo<span>Verse</span></b></div>
        <nav>
          <a className="active" href="/">Home</a><a href="/swap">Swap</a><a>Games</a><a href="/faucet">Faucet</a>
          <a>Portfolio</a><a>Transactions</a><a href="/comi">COMI</a>
        </nav>
        <div className="headerActions">
          <button className="network"><i/> Ethereum Sepolia <span>⌄</span></button>
          <button className="wallet" onClick={isConnected ? openAccountModal : openConnectModal}>
            {isConnected ? `${address.slice(0,6)}...${address.slice(-4)}` : "Connect Wallet"}
          </button>
          <button className="theme" onClick={() => setDark(!dark)}>{dark ? "☀" : "☾"}</button>
        </div>
      </header>

      <div className="page">
        <section className="hero">
          <div className="heroCopy">
            <h1>Welcome to<br/>Rialo<span>Verse</span></h1>
            <p>Swap tokens, play games, and explore a universe of possibilities on the blockchain.</p>
            <div className="heroBtns">
              <button className="primary">Start Exploring&nbsp; →</button>
              <button className="secondary">View Features</button>
            </div>
          </div>
          <div className="heroOrb">
            <div className="orbital o1"/><div className="orbital o2"/>
            <span className="particle p1">✦</span><span className="particle p2">·</span>
            <span className="particle p3">✦</span>
            <div className="r3d">R</div>
          </div>
        </section>

        <section className="section">
          <div className="sectionHead">
            <div><h2>Explore the RialoVerse</h2><p>Everything you need in one ecosystem.</p></div>
            <button className="linkBtn">View All Features&nbsp; →</button>
          </div>
          <div className="featureGrid">
            {features.map(([icon, title, desc, link]) => (
              <div className="feature" key={title}>
                <div className="featureIcon">{icon}</div>
                <h3>{title}</h3><p>{desc}</p>
                <button>{link}&nbsp; →</button>
              </div>
            ))}
          </div>
        </section>

        <section className="security">
          <div className="shield">◇</div>
          <div><b>Secure. Transparent. Decentralized.</b><p>RialoVerse is built with security and transparency at its core.</p></div>
          <button>Learn More&nbsp; →</button>
        </section>

        <section className="section">
          <div className="sectionHead">
            <div><h2>Popular Games</h2><p>Play, compete, and earn amazing rewards.</p></div>
            <button className="linkBtn">View All Games&nbsp; →</button>
          </div>
          <div className="gameGrid">
            {games.map(([icon, title, desc, players, badge]) => (
              <div className="game" key={title}>
                <div className="gameImage"><span>{icon}</span>{badge && <em>{badge}</em>}</div>
                <h3>{title}</h3><p>{desc}</p><small>♙ &nbsp;{players}</small>
                <button>Play Now</button>
              </div>
            ))}
          </div>
        </section>

        <section className="newsletter">
          <div className="mailIcon">✉</div>
          <div><h3>Stay Updated with RialoVerse</h3><p>Subscribe to get the latest updates, features, and news.</p></div>
          <div className="subscribe"><input placeholder="Enter your email"/><button>Subscribe</button></div>
        </section>

        <div className="trusted"><span>Trusted by builders and players</span><div>◆ ETHEREUM</div><div>◈ ALCHEMY</div><div>⬡ CHAINLINK</div><div>≡ INFURA</div><div>◉ hardhat</div><div>🦊 MetaMask</div></div>
      </div>

      <footer>
        <div><div className="brand"><span className="brandMark">R</span><b>Rialo<span>Verse</span></b></div><p>Swap. Play. Explore.<br/>Everything you need in one decentralized universe.</p></div>
        <div><b>Explore</b><a>Swap</a><a>Games</a><a href="/faucet">Faucet</a><a>Portfolio</a></div>
        <div><b>Resources</b><a>Docs</a><a>Blog</a><a>Help Center</a><a>Brand Kit</a></div>
        <div><b>Community</b><a>Discord</a><a>Twitter</a><a>Telegram</a><a>GitHub</a></div>
        <div><b>Legal</b><a>Terms of Service</a><a>Privacy Policy</a><a>Cookie Policy</a></div>
        <small>© 2026 RialoVerse. All rights reserved.</small>
      </footer>
    </main>
  );
}

function Stat({icon,title,value,change}) {
  return <div className="stat"><span className="statIcon">{icon}</span><div><small>{title}</small><b>{value}</b>{change ? <em>{change}</em> : null}</div></div>
}
function Market({name,sub,price,change,negative}) {
  return <div className="market"><div><b>{name}</b><small>{sub}</small></div><strong>{price}</strong><em className={negative ? "neg":""}>{change}</em></div>
}
function Tx({icon,title,sub,amount,time,negative}) {
  return <div className="tx"><span>{icon}</span><div><b>{title}</b><small>{sub}</small></div><div className="txRight"><strong className={negative ? "neg":""}>{amount}</strong><small>{time}</small></div></div>
}
