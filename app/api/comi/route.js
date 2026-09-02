export async function POST(req) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "API key not configured" }, { status: 500 });
    }

    const systemPrompt = `You are COMI, the friendly AI assistant for RialoVerse, a DeFi platform on Ethereum Sepolia testnet. RialoVerse has these features:
- Swap: exchange ETH and RIALO tokens at the /swap page
- Faucet: claim 50 free RIALO tokens every 24 hours at the /faucet page
- Wallet connect via MetaMask, WalletConnect, Rainbow, and other wallets

If the user wants to perform an action (swap or claim), respond normally AND include a special action tag at the very end of your message in this exact format on its own line:
[ACTION:SWAP:direction=ETH_TO_RIALO|RIALO_TO_ETH,amount=NUMBER]
or
[ACTION:CLAIM]

Only include the ACTION tag if the user clearly wants to swap or claim. Otherwise, just answer normally without any tag. Keep responses concise and friendly. Always reply in English, regardless of what language the user writes in.`;

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
