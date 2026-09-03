import re

with open('app/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'<header className="topbar">.*?</header>', re.DOTALL)

new = '''<header className="topbar">
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

matches = len(pattern.findall(content))
content = pattern.sub(new, content, count=1)

with open('app/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Matches found and replaced: {matches}")
