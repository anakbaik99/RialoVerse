import fs from "node:fs";

const files = [
  "app/games/page.js",
  "app/games/wheel/page.js",
  "app/games/flip/page.js",
  "app/games/match/page.js",
];

const headingStyle = `{
  margin: 0,
  fontFamily: "'Orbitron', 'Arial', sans-serif",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textShadow: "0 0 12px #d7ff1f44"
}`;

const changes = [
  [
    "app/games/page.js",
    /fontFamily:\s*["'].*?["']/,
    null,
  ],
];

for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  let changed = 0;

  // Header judul pada halaman game.
  source = source.replace(
    /<h2 style=\{\{ margin: 0, fontSize: 20 \}\}>/g,
    () => {
      changed++;
      return `<h2 style={${headingStyle}}>`;
    }
  );

  // Judul yang ditampilkan pada scene 3D.
  // Hanya ubah style judul yang sudah ada, bukan seluruh teks.
  if (file === "app/games/page.js") {
    source = source.replace(
      /fontSize:\s*["']?(\d+)["']?/g,
      (match, size, offset) => {
        const context = source.slice(Math.max(0, offset - 250), offset);
        if (/name|label|title/i.test(context)) {
          changed++;
          return `fontSize: ${size}, fontFamily: "Orbitron", fontWeight: 800`;
        }
        return match;
      }
    );
  }

  if (changed > 0) {
    fs.writeFileSync(file, source);
    console.log(`OK ${file}: ${changed} perubahan`);
  } else {
    console.log(`SKIP ${file}: pola judul tidak ditemukan`);
  }
}
