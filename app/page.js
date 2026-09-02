"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";

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

export default function Home() {
  const [wallet, setWallet] = useState(false);
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const [dark, setDark] = useState(false);

  return (
    <main className={dark ? "site dark" : "site"}>
      <header className="topbar">
        <div className="brand"><span className="brandMark">R</span><b>Rialo<span>Verse</span></b></div>
        <nav>
          <a className="active" href="/">Home</a><a href="/swap">Swap</a><a>Games</a><a>Faucet</a>
          <a>Portfolio</a><a>Transactions</a><a>COMI</a>
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

        <section className="stats">
          <Stat icon="↗" title="Total Value Locked" value="$124,530.45" change="+4.21%"/>
          <Stat icon="▥" title="Total Trades" value="12,540" change="+2.13%"/>
          <Stat icon="♙" title="Total Users" value="8,721" change="+3.48%"/>
          <Stat icon="◇" title="Games Played" value="3,245" change="+5.17%"/>
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

        <section className="lowerGrid">
          <div className="panel">
            <div className="panelHead"><b>Market Overview</b><button>View All →</button></div>
            <Market name="ETH" sub="Ethereum" price="$3,245.12" change="+2.45%"/>
            <Market name="USDC" sub="USD Coin" price="$1.00" change="+0.01%"/>
            <Market name="RIALO" sub="Rialo Token" price="$0.0124" change="+3.21%"/>
            <Market name="USDT" sub="Tether USD" price="$1.00" change="-0.01%" negative/>
          </div>

          <div className="panel">
            <div className="panelHead"><b>Recent Transactions</b><button>View All →</button></div>
            <Tx icon="⇄" title="Swap" sub="ETH → USDC" amount="+125.50 USDC" time="2 mins ago"/>
            <Tx icon="↓" title="Receive" sub="From: 0x7R...a1b2" amount="+0.25 ETH" time="5 mins ago"/>
            <Tx icon="↑" title="Swap" sub="RIALO → ETH" amount="-50.00 RIALO" time="12 mins ago" negative/>
            <Tx icon="◈" title="Faucet" sub="Claimed Test Tokens" amount="+100 RIALO" time="18 mins ago"/>
          </div>

          <div className="comi">
            <div className="comiTop"><b>COMI</b><span>● Online</span></div>
            <div className="bot">●‿●</div>
            <h3>Hi! I'm <strong>COMI</strong> 👋</h3>
            <p>Your AI assistant for everything RialoVerse. How can I help you today?</p>
            <div className="chips"><button>How to swap?</button><button>What is Rialo?</button><button>Best games?</button><button>How to earn?</button></div>
            <div className="ask">Ask me anything... <b>➤</b></div>
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
        <div><b>Explore</b><a>Swap</a><a>Games</a><a>Faucet</a><a>Portfolio</a></div>
        <div><b>Resources</b><a>Docs</a><a>Blog</a><a>Help Center</a><a>Brand Kit</a></div>
        <div><b>Community</b><a>Discord</a><a>Twitter</a><a>Telegram</a><a>GitHub</a></div>
        <div><b>Legal</b><a>Terms of Service</a><a>Privacy Policy</a><a>Cookie Policy</a></div>
        <small>© 2026 RialoVerse. All rights reserved.</small>
      </footer>
    </main>
  );
}

function Stat({icon,title,value,change}) {
  return <div className="stat"><span className="statIcon">{icon}</span><div><small>{title}</small><b>{value}</b><em>{change}</em><label>vs last 24h</label></div></div>
}
function Market({name,sub,price,change,negative}) {
  return <div className="market"><div><b>{name}</b><small>{sub}</small></div><strong>{price}</strong><em className={negative ? "neg":""}>{change}</em></div>
}
function Tx({icon,title,sub,amount,time,negative}) {
  return <div className="tx"><span>{icon}</span><div><b>{title}</b><small>{sub}</small></div><div className="txRight"><strong className={negative ? "neg":""}>{amount}</strong><small>{time}</small></div></div>
}
