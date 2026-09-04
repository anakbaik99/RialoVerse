with open('app/swap/page.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''function TokenIcon({ token, size = 20 }) {
  if (token === "ETH") {
    return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: "#fff", color: "#0a0a0a", fontSize: size * 0.55, fontWeight: 800, flexShrink: 0 }}>\u039e</span>;
  }'''

new = '''function TokenIcon({ token, size = 20 }) {
  if (token === "ETH") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: "#627eea", flexShrink: 0 }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
          <path d="M12 1L4 12.5L12 17L20 12.5L12 1Z" fill="#fff" fillOpacity="0.85"/>
          <path d="M12 18.3L4 13.6L12 23L20 13.6L12 18.3Z" fill="#fff"/>
          <path d="M12 1L4 12.5L12 16V1Z" fill="#fff"/>
          <path d="M12 18.3V23L4 13.6L12 18.3Z" fill="#fff" fillOpacity="0.6"/>
        </svg>
      </span>
    );
  }'''

count = content.count(old)
content = content.replace(old, new, 1)

with open('app/swap/page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {count} occurrence(s)")
