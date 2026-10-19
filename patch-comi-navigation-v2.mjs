import fs from "node:fs";

const pageFile = "app/comi/page.js";
const apiFile = "app/api/comi/route.js";

let page = fs.readFileSync(pageFile, "utf8");
let api = fs.readFileSync(apiFile, "utf8");

function once(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: ditemukan ${count} kali; patch dibatalkan`);
  }
  return source.replace(oldText, newText);
}

// Pastikan router sudah tersedia.
if (!page.includes('from "next/navigation"') &&
    !page.includes("from 'next/navigation'")) {
  throw new Error("Import next/navigation tidak ditemukan");
}

// Tambahkan pengenal perintah navigasi.
page = once(
  page,
  "export default function ComiPage() {",
  `function resolveOpenCommand(text) {
  const q = text.toLowerCase().trim().replace(/[.!?]+$/, "");
  const intent = /^(open|go to|take me to|launch|navigate to|show me|play|start)\\\\b/.test(q);
  if (!intent) return null;

  const routes = [
    [/token\\\\s*match|match game/, "/games/match", "Token Match"],
    [/rialo\\\\s*flip|\\\\bflip\\\\b|coin flip/, "/games/flip", "Rialo Flip"],
    [/rialo\\\\s*wheel|\\\\bwheel\\\\b/, "/games/wheel", "Rialo Wheel"],
    [/void\\\\s*run/, "/games/void", "Rialo Void Run"],
    [/\\\\bgames?\\\\b/, "/games", "Games"],
    [/\\\\bswap\\\\b/, "/swap", "Swap"],
    [/\\\\bfaucet\\\\b/, "/faucet", "Faucet"],
    [/\\\\bportfolio\\\\b/, "/portfolio", "Portfolio"],
    [/\\\\bcomi\\\\b/, "/comi", "COMI"],
  ];

  const found = routes.find(([pattern]) => pattern.test(q));
  return found ? { path: found[1], label: found[2] } : null;
}

export default function ComiPage() {`,
  "resolver"
);

// Cari handler submit yang benar dari kode asli.
const submitMarker = '    const userMsg = { role: "user", content: input.trim() };';
if (!page.includes(submitMarker)) {
  throw new Error("Baris userMsg tidak cocok. Periksa handler submit.");
}

page = once(
  page,
  submitMarker,
  `    const typed = input.trim();
    const directTarget = resolveOpenCommand(typed);
    const userMsg = { role: "user", content: typed };`,
  "input detection"
);

// Navigasi langsung sebelum request AI.
const messagesMarker = `    setMessages(newMessages);
    setInput("");
    setLoading(true);`;

page = once(
  page,
  messagesMarker,
  `    setMessages(newMessages);
    setInput("");

    if (directTarget) {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Opening " + directTarget.label + "..." },
      ]);
      router.push(directTarget.path);
      return;
    }

    setLoading(true);`,
  "direct navigation"
);

// Tambahkan dukungan OPEN pada handler action.
page = once(
  page,
  `    } else if (action.type === "CLAIM") {
      router.push("/faucet");
    }`,
  `    } else if (action.type === "CLAIM") {
      router.push("/faucet");
    } else if (action.type === "OPEN") {
      const allowed = [
        "/games", "/games/flip", "/games/match",
        "/games/wheel", "/games/void",
        "/swap", "/faucet", "/portfolio", "/comi",
      ];
      if (allowed.includes(action.params?.path)) {
        router.push(action.params.path);
      }
    }`,
  "OPEN handler"
);

// Sesuaikan label tombol action.
page = once(
  page,
  '{m.action.type === "SWAP" ? "Open in Swap →" : "Open Faucet →"}',
  '{m.action.type === "SWAP" ? "Open in Swap →" : m.action.type === "CLAIM" ? "Open Faucet →" : "Open page →"}',
  "action label"
);

// Perbarui prompt API dengan menambahkan instruksi navigasi.
const actionInstruction =
  "Only include the ACTION tag if the user clearly wants to swap or claim. Otherwise, just answer normally without any tag.";

api = once(
  api,
  actionInstruction,
  `If the user asks to open or navigate to a page, include one action tag at the end on its own line:
[ACTION:OPEN:path=/games]
Allowed paths: /games, /games/flip, /games/match, /games/wheel, /games/void, /swap, /faucet, /portfolio, /comi.
Use the matching path for the requested destination. For "open a game", use /games. For a named game, use its specific path. Do not include action tags for ordinary questions.
Existing SWAP and CLAIM action formats remain unchanged.`,
  "API instructions"
);

// Tulis hanya setelah semua pemeriksaan berhasil.
fs.writeFileSync(pageFile, page);
fs.writeFileSync(apiFile, api);
console.log("OK: navigasi COMI berhasil dipatch.");
