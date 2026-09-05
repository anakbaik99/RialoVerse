"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { formatEther, formatUnits } from "viem";

const SWAP_ADDRESS = "0x2697Dc3195Fc5B37047D5E50C2f22a016cF4e2CD";

const SWAP_ABI = [
  {
    name: "getEthReserve",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getTokenReserve",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
];

const features = [
  {
    number: "01",
    icon: "swap",
    title: "Swap",
    headline: "Move assets without the complexity.",
    description:
      "Exchange supported tokens through a simple interface built for the Rialo ecosystem.",
    href: "/swap",
  },
  {
    number: "02",
    icon: "games",
    title: "Games",
    headline: "Play inside the universe.",
    description:
      "Discover blockchain games designed around competition, experimentation and rewards.",
    href: "#games",
  },
  {
    number: "03",
    icon: "faucet",
    title: "Faucet",
    headline: "Get test tokens and experiment.",
    description:
      "Get test assets for exploring and experimenting with the RialoVerse ecosystem.",
    href: "/faucet",
  },
  {
    number: "04",
    icon: "portfolio",
    title: "Portfolio",
    headline: "See your assets in one place.",
    description:
      "Keep track of your on-chain assets and understand your activity at a glance.",
    href: "/portfolio",
  },
  {
    number: "05",
    icon: "comi",
    title: "COMI",
    headline: "Your AI companion for RialoVerse.",
    description:
      "Ask questions, discover features and get help navigating the ecosystem.",
    href: "/comi",
  },
];

function FeatureIcon({ name, size = 28 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (name === "swap") {
    return (
      <svg {...common}>
        <path d="M4 8h13l-3-3" />
        <path d="M20 16H7l3 3" />
      </svg>
    );
  }

  if (name === "games") {
    return (
      <svg {...common}>
        <rect x="3" y="8" width="18" height="9" rx="4" />
        <path d="M8 12h-2 M7 11v2" />
        <circle cx="16" cy="11.5" r="0.8" fill="currentColor" />
        <circle cx="18" cy="13.5" r="0.8" fill="currentColor" />
        <path d="M9 5c1-1.2 5-1.2 6 0" />
      </svg>
    );
  }

  if (name === "faucet") {
    return (
      <svg {...common}>
        <path d="M6 4v6" />
        <path d="M6 7h9a2 2 0 0 1 2 2v1" />
        <path d="M17 10v2" />
        <path d="M17 15l-1.2 2.2a1.2 1.2 0 0 0 2.4 0L17 15z" />
        <path d="M4 18h9l-1.5 3h-6L4 18z" />
      </svg>
    );
  }

  if (name === "portfolio") {
    return (
      <svg {...common}>
        <path d="M12 3a9 9 0 1 0 9 9h-9V3z" />
        <path d="M14 8l3-1.5-1-3" />
        <path d="M13 9l4-2" />
      </svg>
    );
  }

  if (name === "comi") {
    return (
      <img
        src="/comi-logo.png"
        alt="COMI"
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }

  return null;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("ecosystem");
  const [activeFeature, setActiveFeature] = useState(0);

  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  const { data: ethReserve } = useReadContract({
    address: SWAP_ADDRESS,
    abi: SWAP_ABI,
    functionName: "getEthReserve",
  });

  const { data: tokenReserve } = useReadContract({
    address: SWAP_ADDRESS,
    abi: SWAP_ABI,
    functionName: "getTokenReserve",
  });

  const rialoPriceInEth =
    ethReserve && tokenReserve && tokenReserve > 0n
      ? Number(formatEther(ethReserve)) /
        Number(formatUnits(tokenReserve, 18))
      : 0;

  useEffect(() => {
    const elements = document.querySelectorAll(".rv-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("rv-visible");
          }
        });
      },
      { threshold: 0.12 }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sectionIds = ["ecosystem", "how", "games", "comi"];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );

    sections.forEach((el) => spyObserver.observe(el));

    return () => spyObserver.disconnect();
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
    });
  };

  return (
    <main className="rv-site">

      {/* NAVBAR */}
      <header className="rv-nav">
        <a href="/" className="rv-brand">
          <img src="/logo.png" alt="RialoVerse" className="rv-brand-mark" />
          <span>RIALO<span>VERSE</span></span>
        </a>

        <nav className="rv-nav-links">
          <a href="#ecosystem">Ecosystem</a>
          <a href="#how">How it works</a>
          <a href="#games">Games</a>
          <a href="#comi">COMI</a>
        </nav>

        <div className="rv-nav-actions">
          <button
            className={`rv-menu ${menuOpen ? "rv-menu-open" : ""}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {menuOpen && (
          <div className="rv-mobile-menu">
            <div className="rv-mobile-header">
              <a href="/" className="rv-mobile-brand">
                <img src="/logo.png" alt="RialoVerse" className="rv-mobile-mark" />
                <span>RIALO<span>VERSE</span></span>
              </a>

              <button
                className="rv-mobile-close"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <div className="rv-mobile-panel">
              <a
                href="#ecosystem"
                className={activeSection === "ecosystem" ? "rv-mobile-active" : ""}
                onClick={() => setMenuOpen(false)}
              >
                ECOSYSTEM
              </a>

              <a
                href="#how"
                className={activeSection === "how" ? "rv-mobile-active" : ""}
                onClick={() => setMenuOpen(false)}
              >
                HOW IT WORKS
              </a>

              <a
                href="#games"
                className={activeSection === "games" ? "rv-mobile-active" : ""}
                onClick={() => setMenuOpen(false)}
              >
                GAMES
              </a>

              <a
                href="#comi"
                className={activeSection === "comi" ? "rv-mobile-active" : ""}
                onClick={() => setMenuOpen(false)}
              >
                COMI
              </a>

              <a
                href="/swap"
                className="rv-mobile-launch"
                onClick={() => setMenuOpen(false)}
              >
                Launch App
              </a>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="rv-hero">
        <div className="rv-grid-bg" />

        <div className="rv-hero-copy rv-reveal">
          <div className="rv-eyebrow">
            <span className="rv-live-dot" />
            THE RIALOVERSE IS OPEN
          </div>

          <h1>
            ENTER THE
            <br />
            <span className="rv-white">RIALO</span><span className="rv-green">VERSE</span>
          </h1>

          <p>
            One universe for Web3 exploration.
            <br />
            Swap assets, play games, discover tools
            <br />
            and explore what&apos;s possible on-chain.
          </p>

          <div className="rv-hero-buttons">
            <button
              className="rv-primary"
              onClick={() => scrollTo("ecosystem")}
            >
              Explore RialoVerse <span>→</span>
            </button>

            <button
              className="rv-secondary"
              onClick={() => scrollTo("how")}
            >
              How it works
            </button>
          </div>

          <div className="rv-hero-stats">
            <div>
              <strong>05</strong>
              <span>EXPERIENCES</span>
            </div>
            <div>
              <strong>∞</strong>
              <span>POSSIBILITIES</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>ON-CHAIN</span>
            </div>
          </div>
        </div>

        <div className="rv-orbit-scene">
          <div className="rv-orbit orbit-one" />
          <div className="rv-orbit orbit-two" />
          <div className="rv-orbit orbit-three" />

          <div className="rv-core">
            <img src="/logo.png" alt="RialoVerse" className="rv-core-logo" />
          </div>

          <div className="rv-orbit-node node-one">SWAP</div>
          <div className="rv-orbit-node node-two">GAMES</div>
          <div className="rv-orbit-node node-three">COMI</div>
          <div className="rv-orbit-node node-four">FAUCET</div>

          <div className="rv-star star-one">·</div>
          <div className="rv-star star-two">·</div>
          <div className="rv-star star-three">·</div>
          <div className="rv-star star-four">·</div>
          <div className="rv-star star-five">·</div>
        </div>

        <div className="rv-scroll">
          <span>SCROLL TO EXPLORE</span>
          <i />
        </div>
      </section>

      {/* INTRO */}
      <section className="rv-intro rv-reveal">
        <div className="rv-section-label">01 / THE UNIVERSE</div>

        <div className="rv-intro-content">
          <h2>
            ONE UNIVERSE.
            <br />
            <span>MANY EXPERIENCES.</span>
          </h2>

          <p>
            RialoVerse brings different Web3 experiences together into one
            ecosystem. Instead of jumping between disconnected tools,
            explore, interact and play from a single place.
          </p>
        </div>
      </section>

      {/* ECOSYSTEM */}
      <section id="ecosystem" className="rv-section">
        <div className="rv-section-top rv-reveal">
          <div>
            <div className="rv-section-label">02 / ECOSYSTEM</div>
            <h2>BUILT TO BE <span>EXPLORED.</span></h2>
          </div>

          <p>
            Choose your path.
            <br />
            Every experience connects back to the same universe.
          </p>
        </div>

        <div className="rv-feature-layout">

          <div className="rv-feature-list">
            {features.map((feature, index) => (
              <button
                key={feature.title}
                className={`rv-feature-item ${
                  activeFeature === index ? "active" : ""
                }`}
                onClick={() => setActiveFeature(index)}
              >
                <span className="rv-feature-number">
                  {feature.number}
                </span>

                <span className="rv-feature-icon">
                  <FeatureIcon name={feature.icon} size={20} />
                </span>

                <span className="rv-feature-name">
                  {feature.title}
                </span>

                <span className="rv-feature-arrow">↗</span>
              </button>
            ))}
          </div>

          <div className="rv-feature-display">
            <div className="rv-display-grid" />

            <div className="rv-display-orb">
              <FeatureIcon name={features[activeFeature].icon} size={64} />
            </div>

            <div className="rv-display-content">
              <span>FEATURE / {features[activeFeature].number}</span>
              <h3>{features[activeFeature].title}</h3>
              <h4>{features[activeFeature].headline}</h4>
              <p>{features[activeFeature].description}</p>

              <a href={features[activeFeature].href}>
                Explore {features[activeFeature].title} →
              </a>
            </div>

            <div className="rv-display-status">
              <span />
              SYSTEM READY
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="rv-how">
        <div className="rv-section-label">03 / HOW IT WORKS</div>

        <h2 className="rv-reveal">
          FROM EXPLORATION
          <br />
          <span>TO ACTION.</span>
        </h2>

        <p className="rv-how-intro rv-reveal">
          Start anywhere. Move through the ecosystem at your own pace.
        </p>

        <div className="rv-timeline">

          <div className="rv-step rv-reveal">
            <div className="rv-step-number">01</div>
            <div className="rv-step-line" />
            <h3>CONNECT</h3>
            <p>
              Connect your wallet when you are ready to interact with
              on-chain experiences.
            </p>
          </div>

          <div className="rv-step rv-reveal">
            <div className="rv-step-number">02</div>
            <div className="rv-step-line" />
            <h3>EXPLORE</h3>
            <p>
              Discover games, tools, swaps and other experiences inside
              RialoVerse.
            </p>
          </div>

          <div className="rv-step rv-reveal">
            <div className="rv-step-number">03</div>
            <div className="rv-step-line" />
            <h3>INTERACT</h3>
            <p>
              Use the ecosystem and interact with its different services.
            </p>
          </div>

          <div className="rv-step rv-reveal">
            <div className="rv-step-number">04</div>
            <div className="rv-step-line" />
            <h3>PLAY</h3>
            <p>
              Experience games, discover new tools and keep exploring.
            </p>
          </div>

        </div>
      </section>

      {/* LIVE UNIVERSE */}
      <section className="rv-universe">
        <div className="rv-section-label">04 / THE RIALOVERSE ENGINE</div>

        <div className="rv-universe-title rv-reveal">
          <h2>
            EVERYTHING
            <br />
            <span>CONNECTED.</span>
          </h2>

          <p>
            A growing ecosystem where every experience has a place.
          </p>
        </div>

        <div className="rv-network rv-reveal">
          <div className="rv-network-center">
            <img src="/logo.png" alt="RialoVerse" className="rv-network-logo" />
            <span>RIALOVERSE</span>
          </div>

          <div className="rv-network-line line-a" />
          <div className="rv-network-line line-b" />
          <div className="rv-network-line line-c" />
          <div className="rv-network-line line-d" />

          <div className="rv-network-node network-a">
            <b>SWAP</b>
            <small>ASSETS</small>
          </div>

          <div className="rv-network-node network-b">
            <b>GAMES</b>
            <small>PLAY</small>
          </div>

          <div className="rv-network-node network-c">
            <b>COMI</b>
            <small>AI</small>
          </div>

          <div className="rv-network-node network-d">
            <b>FAUCET</b>
            <small>TESTNET</small>
          </div>
        </div>
      </section>

      {/* GAMES */}
      <section id="games" className="rv-section rv-games-section">
        <div className="rv-section-top rv-reveal">
          <div>
            <div className="rv-section-label">05 / GAMES</div>
            <h2>PLAY THE <span>UNIVERSE.</span></h2>
          </div>

          <p>
            Compete.
            <br />
            Experiment.
            <br />
            Have fun.
          </p>
        </div>
        <div className="rv-games-cta rv-reveal">
          <a href="/games" className="rv-primary">
            Enter 3D World <span>-&gt;</span>
          </a>
        </div>

      </section>

      {/* COMI */}
      <section id="comi" className="rv-comi">
        <div className="rv-comi-copy rv-reveal">
          <div className="rv-section-label">06 / COMI</div>

          <h2>
            MEET
            <br />
            <span>COMI.</span>
          </h2>

          <p>
            Your AI companion inside the RialoVerse. Ask questions,
            discover features and get help finding your way around the
            ecosystem.
          </p>

          <a href="/comi" className="rv-primary">
            Talk to COMI <span>→</span>
          </a>
        </div>

        <div className="rv-chat rv-reveal">
          <div className="rv-chat-top">
            <div>
              <strong>COMI</strong>
              <small><span /> ONLINE</small>
            </div>
            <span>AI</span>
          </div>

          <div className="rv-chat-body">
            <div className="rv-bot-avatar"><img src="/comi-logo.png" alt="COMI" className="rv-bot-avatar-img" /></div>

            <div className="rv-message">
              <span className="rv-typing">
                Hey! I&apos;m COMI.
              </span>

              <p>
                What would you like to explore today?
              </p>
            </div>

            <div className="rv-chat-options">
              <button>How does Swap work?</button>
              <button>Show me the games</button>
              <button>What is RialoVerse?</button>
            </div>
          </div>

          <div className="rv-chat-input">
            Ask COMI anything...
            <span>↑</span>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="rv-security">
        <div className="rv-section-label">07 / BUILT WITH CARE</div>

        <div className="rv-security-heading rv-reveal">
          <h2>
            EXPLORE WITH
            <br />
            <span>CONFIDENCE.</span>
          </h2>

          <p>
            RialoVerse is designed around transparent on-chain interaction
            and simple user experiences.
          </p>
        </div>

        <div className="rv-security-grid">
          <div className="rv-security-card rv-reveal">
            <span>01</span>
            <strong>ON-CHAIN</strong>
            <p>
              Interactions can be connected to blockchain infrastructure
              and verified on-chain.
            </p>
          </div>

          <div className="rv-security-card rv-reveal">
            <span>02</span>
            <strong>TRANSPARENT</strong>
            <p>
              Keep the ecosystem understandable with clear experiences
              and visible transaction flows.
            </p>
          </div>

          <div className="rv-security-card rv-reveal">
            <span>03</span>
            <strong>USER FIRST</strong>
            <p>
              Simple interfaces make it easier for newcomers to discover
              Web3 without unnecessary complexity.
            </p>
          </div>
        </div>
      </section>

      {/* LIVE DATA */}
      <section className="rv-live">
        <div>
          <span>RIALOVERSE / LIVE</span>
          <strong>
            {rialoPriceInEth > 0
              ? rialoPriceInEth.toFixed(8)
              : "—"}
          </strong>
          <small>RIALO / ETH</small>
        </div>

        <div>
          <span>NETWORK</span>
          <strong>SEPOLIA</strong>
          <small>TESTNET</small>
        </div>

        <div>
          <span>STATUS</span>
          <strong className="rv-status-online">
            ● ONLINE
          </strong>
          <small>ECOSYSTEM ACTIVE</small>
        </div>
      </section>

      {/* CTA */}
      <section className="rv-cta rv-reveal">
        <div className="rv-cta-orbit" />

        <div className="rv-cta-content">
          <div className="rv-section-label">08 / YOUR NEXT STEP</div>

          <h2>
            READY TO ENTER
            <br />
            <span>THE RIALOVERSE?</span>
          </h2>

          <p>
            Swap. Play. Explore.
            <br />
            Your journey starts here.
          </p>

          <button
            className="rv-primary"
            onClick={() => scrollTo("ecosystem")}
          >
            Enter RialoVerse <span>→</span>
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="rv-footer">
        <div className="rv-footer-brand">
          <a href="/" className="rv-brand">
            <img src="/logo.png" alt="RialoVerse" className="rv-brand-mark" />
            <span>RIALO<span>VERSE</span></span>
          </a>

          <p>
            Swap. Play. Explore.
            <br />
            Everything you need in one universe.
          </p>
        </div>

        <div>
          <b>EXPLORE</b>
          <a href="/swap">Swap</a>
          <a href="#games">Games</a>
          <a href="/faucet">Faucet</a>
          <a href="/comi">COMI</a>
        </div>

        <div>
          <b>RESOURCES</b>
          <a href="/learn">Learn</a>
          <a href="/learn">Docs</a>
          <a href="https://github.com/fauzan83939/RialoVerse">
            GitHub
          </a>
        </div>

        <div>
          <b>COMMUNITY</b>
          <a href="#">Discord</a>
          <a href="#">Twitter</a>
          <a href="#">Telegram</a>
        </div>

        <div>
          <b>RIALOVERSE</b>
          <span>Built for the Rialo ecosystem.</span>
          <span>© 2026 RialoVerse</span>
        </div>
      </footer>

    </main>
  );
}
