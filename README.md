# Isonomy

> A high-throughput distributed ledger & wallet system, built in TypeScript.

**Isonomy** is a permissioned distributed ledger designed for high transaction throughput, with a first-class wallet layer for
key management, signing, and balance tracking.

> ⚠️ **Status: early development.** This README is a temporary scaffold and will be
> rewritten as the architecture solidifies.

---

## Why Isonomy

Most educational blockchain projects optimize for teaching proof-of-work and stop
there. Isonomy skips PoW entirely and is built around the patterns that actually
give real systems throughput: leader-based BFT/Raft-style consensus, parallel
transaction execution, and pipelined block commits.

## Roadmap

- [ ] **Phase 1 — Core Ledger**
  - [ ] Domain model (`Transaction`, `Block`, `Wallet`)
  - [ ] Wallet: keypair generation, address derivation, tx signing/verification
  - [ ] In-memory chain with SHA-256 block linking
  - [ ] Mempool
  - [ ] REST API (submit tx, balances, chain/block queries)
- [ ] **Phase 2 — Networking & Consensus**
  - [ ] P2P gossip layer (WebSocket)
  - [ ] Leader-based BFT/Raft-style consensus
  - [ ] Fork resolution & finality rules
- [ ] **Phase 3 — High Throughput**
  - [ ] Parallel transaction execution (dependency graph)
  - [ ] Block pipelining
  - [ ] Persistent storage (LevelDB/RocksDB + WAL)
  - [ ] Merkle state trie for light clients
  - [ ] Parallel signature verification via worker threads
  - [ ] Metrics & structured logging
- [ ] **Phase 4 — Production Ready**
  - [ ] Multi-node local testnet (docker-compose)
  - [ ] CI/CD (GitHub Actions)
  - [ ] Full test suite incl. chaos/network-partition tests
  - [ ] OpenAPI spec
  - [ ] Kubernetes deployment manifests

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js 22+
- **Crypto:** secp256k1 (wallet keys & signing)
- **Networking:** WebSocket (P2P gossip)
- **Storage:** In-memory (Phase 1) → LevelDB/RocksDB (Phase 3)
- **Tooling:** ESLint 9 (flat config), Prettier, Husky, lint-staged, commitlint
- **Containerization:** Docker + docker-compose (hot-reload dev environment)

## Getting Started

```bash
# clone
git clone https://github.com/<your-username>/isonomy.git
cd isonomy

# install
npm install

# run in dev mode (hot reload)
npm run dev

# or run via Docker (hot reload supported)
docker compose up --build
```

## Project Structure

```
isonomy/
├── src/
│   ├── ledger/        # block, chain, mempool logic
│   ├── wallet/         # keypair generation, signing, address derivation
│   ├── network/         # P2P gossip, peer discovery
│   ├── consensus/       # leader election, voting, finality
│   ├── api/             # REST layer
│   └── index.ts
├── test/
├── .husky/
├── docker-compose.yml
├── Dockerfile.dev
├── eslint.config.js
├── tsconfig.json
└── package.json
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled build |
| `npm run lint` | Lint the codebase |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | Type-check without emitting |

## Contributing

This is currently a solo learning/build project. Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
`chore:`, etc.) and are enforced via commitlint + Husky.
