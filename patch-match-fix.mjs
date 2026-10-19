import fs from "fs";

const f = "app/games/match/page.js";
let s = fs.readFileSync(f, "utf8");

function replaceOnce(oldText, newText, label) {
  if (s.includes(newText)) {
    console.log("SKIP (sudah diterapkan): " + label);
    return true;
  }

  const count = s.split(oldText).length - 1;
  if (count !== 1) {
    console.log(`GAGAL (${count} kecocokan): ${label}`);
    return false;
  }

  s = s.replace(oldText, newText);
  console.log("OK: " + label);
  return true;
}

const changes = [
  [
    '{ ch: "R", color: "#d7ff1f", text: "#0a0a0a", pct: 40 },',
    '{ ch: "R", name: "Rialo", img: "/spawn-logo.svg", color: "#d7ff1f", text: "#0a0a0a", pct: 40 },',
    "logo Rialo"
  ],
  [
    '{ ch: "V", color: "#8b5cff", text: "#ffffff", pct: 30 },',
    '{ ch: "V", name: "RialoVerse", img: "/logo.png", color: "#8b5cff", text: "#ffffff", pct: 30 },',
    "logo RialoVerse"
  ],
  [
    '{ ch: "◆", color: "#5fd0ff", text: "#0a0a0a", pct: 20 },',
    '{ ch: "◆", name: "Diamond", color: "#5fd0ff", text: "#0a0a0a", pct: 20 },',
    "nama Diamond"
  ],
  [
    '{ ch: "★", color: "#ffb85f", text: "#0a0a0a", pct: 10 },',
    '{ ch: "★", name: "Star", color: "#ffb85f", text: "#0a0a0a", pct: 10 },',
    "nama Star"
  ],
  [
    "let cdkPromise;",
    `function Sym({ s, size }) {
  if (s.img) return <img src={s.img} alt={s.name} width={size} height={size} draggable={false} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />;
  return <span style={{ fontSize: size * 0.95, lineHeight: 1 }}>{s.ch}</span>;
}

let cdkPromise;`,
    "komponen Sym"
  ],
  [
    "{SYMS[i].ch} {SYMS[i].ch} {SYMS[i].ch}",
    '<Sym s={SYMS[i]} size={22} /><Sym s={SYMS[i]} size={22} /><Sym s={SYMS[i]} size={22} />',
    "simbol tiga kali"
  ],
  [
    "{SYMS[v].ch}</i>",
    '<Sym s={SYMS[v]} size={16} /></i>',
    "simbol riwayat"
  ],
  [
    '${sym(result.r[0]).ch}${sym(result.r[1]).ch}${sym(result.r[2]).ch} MATCH',
    '3x ${sym(result.r[0]).name} MATCH',
    "teks hasil match"
  ]
];

for (const [a, b, label] of changes) {
  if (!replaceOnce(a, b, label)) {
    console.log("Dihentikan. File belum disimpan; periksa pola yang gagal.");
    process.exit(1);
  }
}

fs.writeFileSync(f, s);
console.log("SELESAI: app/games/match/page.js tersimpan");
