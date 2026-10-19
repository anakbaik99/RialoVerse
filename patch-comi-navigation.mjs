import fs from "node:fs";

const files = {
  page: "app/comi/page.js",
  api: "app/api/comi/route.js",
};

let page = fs.readFileSync(files.page, "utf8");
let api = fs.readFileSync(files.api, "utf8");

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;

  if (count !== 1) {
    throw new Error(
      `${label}: pola ditemukan ${count} kali; tidak ada file yang disimpan`
    );
  }

  return source.replace(oldText, newText);
}

// 1. Recognize navigation commands without waiting for AI.
page = replaceOnce(
  page,
  "export default function ComiPage() {",
  `function resolveOpenCommand(text) {
  const q = text.toLowerCase().trim().replace(/[.!?]+$/, "");

  const intent =
    /^(open|go to|take me to|launch|navigate to|show me|play|start)\\\\b/.test(q) ||
    /^can you (open|launch|take me to)\\\\b/.test(q);

  if (!intent) return null;

  const routes = [
    [/token\\\\s*match|match game/, "/games/match", "Token Match"],
    [/rialo\\\\s*flip|\\\\bflip\\\\b|coin flip/, "/games/flip", "Rialo Flip"],
    [/rialo\\\\s*wheel|\\\\bwheel\\\\b/, "/games/wheel", "Rialo Wheel"],
    [/rialo\\\\s*void\\\\s*run|\\\\bvoid\\\\s*run\\\\b/, "/games/void", "Rialo Void Run"],
    [/\\\\bgames?\\\\b/, "/games", "Games"],
    [/\\\\bswap\\\\b/, "/swap", "Swap"],
    [/\\\\bfaucet\\\\b/, "/faucet", "Faucet"],
    [/\\\\bportfolio\\\\b/, "/portfolio", "Portfolio"],
    [/\\\\bcomi\\\\b/, "/comi", "COMI"],
  ];

  const match = routes.find(([pattern]) => pattern.test(q));
  if (!match) return null;

  return { href: match[1], label: match[2] };
}

export default function ComiPage() {`,
  "navigation resolver"
);

// 2. Detect direct commands before calling the AI.
page = replaceOnce(
  page,
  '    const userMsg = { role: "user", content: input.trim() };',
  `    const typed = input.trim();
    const directTarget = resolveOpenCommand(typed);
    const userMsg = { role: "user", content: typed };`,
  "direct command detection"
);

page = replaceOnce(
  page,
  `    setMessages(newMessages);
    setInput("");
    setLoading(true);`,
  `    setMessages(newMessages);
    setInput("");

    if (directTarget) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Opening " + directTarget.label + "...",
        },
      ]);
      router.push(directTarget.href);
      return;
    }

    setLoading(true);`,
  "direct navigation"
);

// 3. Support OPEN actions returned by the AI.
page = replaceOnce(
  page,
  `    } else if (action.type === "CLAIM") {
      router.push("/faucet");
    }`,
  `    } else if (action.type === "CLAIM") {
      router.push("/faucet");
    } else if (action.type === "OPEN") {
      const allowed = [
        "/games",
        "/games/flip",
        "/games/match",
        "/games/wheel",
        "/games/void",
        "/swap",
        "/faucet",
        "/portfolio",
        "/comi",
      ];

      if (allowed.includes(action.params.path)) {
        router.push(action.params.path);
      }
    }`,
  "OPEN action handler"
);

page = replaceOnce(
  page,
  '{m.action.type === "SWAP" ? "Open in Swap →" : "Open Faucet →"}',
  '{m.action.type === "SWAP" ? "Open in Swap →" : m.action.type === "CLAIM" ? "Open Faucet →" : "Open page →"}',
  "action button label"
);

// 4. Expand COMI's knowledge and navigation instructions.
api = replaceOnce(
  api,
  '   - Wallet connect via the Rialo Wallet browser extension',
  `   - Games: /games is the game world, /games/flip is Rialo Flip, /games/match is Token Match, /games/wheel is Rialo Wheel, and /games/void is Rialo Void Run.
   - Portfolio: /portfolio
   - COMI chat: /comi
   - Wallet connect via the Rialo Wallet browser extension`,
  "COMI knowledge"
);

api = replaceOnce(
  api,
  "Only include the ACTION tag if the user clearly wants to swap or claim. Otherwise, just answer normally without any tag.",
  `If the user clearly asks to open or navigate to a page, respond briefly and include an action tag at the end on its own line:
- Games world: [ACTION:OPEN:path=/games]
- Rialo Flip: [ACTION:OPEN:path=/games/flip]
- Token Match: [ACTION:OPEN:path=/games/match]
- Rialo Wheel: [ACTION:OPEN:path=/games/wheel]
- Rialo Void Run: [ACTION:OPEN:path=/games/void]
- Swap: [ACTION:OPEN:path=/swap]
- Faucet: [ACTION:OPEN:path=/faucet]
- Portfolio: [ACTION:OPEN:path=/portfolio]
- COMI: [ACTION:OPEN:path=/comi]
Only use these exact allowed paths. Do not include an action tag for ordinary questions. For general requests like "open a game", open /games. For a named game, open its specific page.`,
  "navigation instructions"
);

// Save only after all expected patterns have been found.
fs.writeFileSync(files.page, page);
fs.writeFileSync(files.api, api);

console.log("OK: COMI navigation updated.");
