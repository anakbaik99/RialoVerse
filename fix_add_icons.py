with open('app/swap/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

old1 = '''            <select value={fromToken} onChange={(e) => selectFrom(e.target.value)} style={{ background: "#0a0a0a", color: "#fff", border: "2px solid #2a2b3a", borderRadius: 0, padding: "6px 8px", fontWeight: 700, fontSize: 13 }}>
              {TOKEN_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>'''
new1 = '''            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0a0a", border: "2px solid #2a2b3a", flexShrink: 0 }}>
              <TokenIcon token={fromToken} size={18} />
              <select value={fromToken} onChange={(e) => selectFrom(e.target.value)} style={{ background: "transparent", color: "#fff", border: "none", padding: "6px 6px 6px 0", fontWeight: 700, fontSize: 13 }}>
                {TOKEN_LIST.map((t) => <option key={t} value={t} style={{ background: "#0a0a0a" }}>{t}</option>)}
              </select>
            </div>'''
c1 = content.count(old1)
content = content.replace(old1, new1, 1)

old2 = '''            <select value={toToken} onChange={(e) => selectTo(e.target.value)} style={{ background: "#0a0a0a", color: "#fff", border: "2px solid #2a2b3a", borderRadius: 0, padding: "6px 8px", fontWeight: 700, fontSize: 13 }}>
              {TOKEN_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>'''
new2 = '''            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0a0a0a", border: "2px solid #2a2b3a", flexShrink: 0 }}>
              <TokenIcon token={toToken} size={18} />
              <select value={toToken} onChange={(e) => selectTo(e.target.value)} style={{ background: "transparent", color: "#fff", border: "none", padding: "6px 6px 6px 0", fontWeight: 700, fontSize: 13 }}>
                {TOKEN_LIST.map((t) => <option key={t} value={t} style={{ background: "#0a0a0a" }}>{t}</option>)}
              </select>
            </div>'''
c2 = content.count(old2)
content = content.replace(old2, new2, 1)

with open('app/swap/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"From select: {c1}, To select: {c2}")
