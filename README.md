# RialoVerse

A Web3 hub for the Rialo ecosystem: swap, explore a 3D world, chat with an AI companion, and track your on-chain portfolio, all in one place.

Live: https://rialoverse.vercel.app

## Features

- Swap: token swap interface for the Rialo ecosystem
- 3D World: explore an interactive Three.js world with buildings, a movable avatar, and collision
- Faucet: claim testnet tokens
- COMI: an AI companion you can chat with inside the app
- Portfolio: connect your wallet to view holdings (ETH, RIALO, USDC), an asset allocation chart, and recent transaction history on Sepolia testnet

## Tech Stack

- Next.js (App Router)
- React Three Fiber / Three.js (3D world)
- wagmi + RainbowKit (wallet connection)
- viem (on-chain reads)
- Sepolia testnet

## Run locally

Install dependencies with npm install, then start the dev server with npm run dev.

Open http://localhost:3000

## Network

This project runs on Sepolia testnet. Connect a wallet with Sepolia ETH to try Swap, Faucet, and Portfolio.
