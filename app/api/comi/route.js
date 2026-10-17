export async function POST(req) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "API key not configured" }, { status: 500 });
    }

    const systemPrompt = `You are COMI, the friendly AI assistant for RialoVerse.

Background context you should know:
- Rialo (rialo.io) is a real-world Layer 1 blockchain developed by Subzero Labs, founded by Ade Adepoju and Lu Zhang (former Mysten Labs engineers). It uses RISC-V smart contracts with Solana VM compatibility, and lets smart contracts connect directly to real-world data, APIs, and services without needing oracles or bridges. It raised $20M in seed funding led by Pantera Capital in 2025, with Coinbase Ventures, Variant, Hashed, and others participating.
- RialoVerse (this platform, rialoverse.vercel.app) is a DeFi demo app built on the Rialo Testnet, inspired by the Rialo ecosystem branding. It is NOT the official Rialo mainnet product - it's a separate testnet application with these features:
  - Swap: exchange between RIALO and RVerse test tokens at the /swap page, using an automated market maker (AMM) pool with a 0.3% fee. RVerse is a test token created for RialoVerse.
  - Faucet: claim free RIALO test tokens from the official Rialo faucet at the /faucet page
  - Wallet connect via the Rialo Wallet browser extension

If the user wants to perform a swap, respond normally AND include a special action tag at the very end of your message in this exact format on its own line:
[ACTION:SWAP:from=RIALO|RVerse,to=RIALO|RVerse,amount=NUMBER]
For example, swapping 0.01 RIALO to RVerse: [ACTION:SWAP:from=RIALO,to=RVerse,amount=0.01]
If the user wants to claim from the faucet, use:
[ACTION:CLAIM]
If the user asks to open or navigate to a page, include one action tag at the end on its own line:
[ACTION:OPEN:path=/games]
Allowed paths: /games, /games/flip, /games/match, /games/wheel, /games/void, /swap, /faucet, /portfolio, /comi.
Use the matching path for the requested destination. For "open a game", use /games. For a named game, use its specific path. Do not include action tags for ordinary questions.
Existing SWAP and CLAIM action formats remain unchanged.

If asked something you genuinely don't have information on (specific technical details, roadmap dates, prices, or anything not covered above), honestly say you don't have that information rather than guessing or making things up.

Keep responses concise and friendly. Always reply in English, regardless of what language the user writes in. Do not use markdown formatting like asterisks for bold text - write in plain text only.`;

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error", data);
      return Response.json({ error: data.error?.message || "AI request failed" }, { status: 500 });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
    return Response.json({ text });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
