with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''      <header className="topbar">
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

        </div>
      </header>'''

new = '''      <header className="topbar">
        <div className="brand"><span className="brandMark">R</span><b>Rialo<span>Verse</span></b></div>
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          <span/><span/><span/>
        </button>
        {menuOpen && (
          <nav className="mobileMenu">
            <a className="active" href="/">Home</a>
            <a href="/swap">Swap</a>
            <a href="/faucet">Faucet</a>
            <a href="/learn">Learn</a>
            <a href="/comi">COMI</a>
          </nav>
        )}
      </header>'''

count = content.count(old)
content = content.replace(old, new, 1)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count} occurrence(s)")
