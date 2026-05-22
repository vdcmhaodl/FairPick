# FairPick

FairPick is a Stellar Soroban dApp for transparent place recommendations and verified visits.

Users enter a wish, receive off-chain place suggestions, select a place, and create an on-chain `DecisionSession`. The contract stores only hashes and IDs, not private raw location, shortlist, or review data. A verifier can later confirm a real check-in, after which the user receives token rewards and PICK reputation points.

Repository: <https://github.com/vdcmhaodl/FairPick>

## Testnet Deployment

- Contract ID: `CBOTOKHSGS33OXRPKBO7SQCVS4ANHLPWFEXVPEXQYMWWJRROLGBIPFQE`
- RPC URL: `https://soroban-testnet.stellar.org`
- Network passphrase: `Test SDF Network ; September 2015`
- Contract explorer: <https://stellar.expert/explorer/testnet/contract/CBOTOKHSGS33OXRPKBO7SQCVS4ANHLPWFEXVPEXQYMWWJRROLGBIPFQE>
- Deploy transaction: <https://stellar.expert/explorer/testnet/tx/af2452babf10e2da844de13a022782722a060a055305f66fded917383dd20eb9>
- Deploy transaction hash: `af2452babf10e2da844de13a022782722a060a055305f66fded917383dd20eb9`
- Ledger: `2686246`
- Deploy time: `2026-05-22T09:10:03Z`
- WASM hash: `3fce01c14207832eb203734207ab58339bb2ccc4238241d95ae50a3b8d9f8b1d`

For the simplest end-to-end demo, initialize with:

```text
Session fee: 0
Reward amount: 0
PICK reward: 10
```

This avoids token funding issues while still testing suggestions, session creation, check-in verification, and PICK reputation.

## What It Solves

Normal recommendation apps can silently change rankings, prioritize sponsored venues, or edit reviews in a private database. FairPick keeps the recommendation engine off-chain for speed and privacy, while using Soroban to record the parts that should be auditable:

- the hash of the generated shortlist,
- the hash of the user's criteria,
- the selected place ID,
- the hash of the check-in proof,
- the hash of the review.

This gives users a lightweight proof that a decision and verified visit happened without exposing sensitive personal data on-chain.

## Features

- Soroban smart contract written in Rust.
- Static browser UI with no npm install required.
- Freighter wallet connection.
- Off-chain place catalog in `ui/places.json`.
- User wish input and suggestion scoring.
- On-chain Decision Session creation.
- Verifier-based check-in confirmation.
- Token reward transfer through a Soroban token/SAC contract.
- PICK reputation tracked in contract storage.
- Contract tests with mock Stellar Asset Contract token.

## Tech Stack

- Smart contract: Rust + Soroban SDK
- Blockchain: Stellar Testnet
- Wallet: Freighter
- Frontend: HTML, CSS, JavaScript
- Chain access: Stellar RPC
- Data source: local JSON place catalog

## Project Structure

```text
.
├── lib.rs                  # FairPick Soroban smart contract
├── Cargo.toml              # Rust/Soroban crate config
├── ui/
│   ├── index.html          # Web UI
│   ├── styles.css          # UI styles
│   ├── app.js              # Frontend logic, Freighter, RPC, hashing
│   └── places.json         # Off-chain place catalog
├── guide.md                # Detailed running guide
├── prd.md                  # Product requirements
└── project-description.md  # Short project description
```

## Requirements

Install these before running the project:

- Rust: <https://rustup.rs>
- Stellar CLI: <https://developers.stellar.org/docs/tools/stellar-cli>
- Freighter wallet: <https://freighter.app>
- Python 3, used only to serve the static UI locally

Add the required Rust targets:

```bash
rustup target add wasm32-unknown-unknown
rustup target add wasm32v1-none
```

Install Stellar CLI if needed:

```bash
cargo install --locked stellar-cli
```

Verify:

```bash
rustc --version
cargo --version
stellar --version
```

## Quick Start

Clone the repository:

```bash
git clone https://github.com/vdcmhaodl/FairPick.git
cd FairPick
```

Run contract tests:

```bash
cargo test --locked
```

Build the contract:

```bash
stellar contract build
```

The deployable WASM will be generated at:

```text
target/wasm32v1-none/release/fairpick.wasm
```

Run the UI:

```bash
python3 -m http.server 5174 --bind 127.0.0.1 -d ui
```

Open:

```text
http://127.0.0.1:5174/
```

Use `http`, not `https`.

## Contract API

The main contract functions are:

- `initialize(admin, verifier, payment_token, session_fee, reward_amount, pick_reward)`
- `fund_rewards(from, amount)`
- `create_session(user, shortlist_hash, criteria_hash, selected_place_id)`
- `confirm_checkin(session_id, checkin_proof_hash, review_hash)`
- `set_verifier(new_verifier)`
- `set_economics(session_fee, reward_amount, pick_reward)`
- `get_session(session_id)`
- `is_verified_visit(session_id)`
- `pick_balance(user)`
- `verified_visits(user)`
- `config()`

## Data Model

The full place list is not stored on-chain. It lives in:

```text
ui/places.json
```

The UI reads that JSON file, scores suggestions, and creates hashes. The contract stores only:

- `shortlist_hash`
- `criteria_hash`
- `selected_place_id`
- `checkin_proof_hash`
- `review_hash`
- session status
- reward information
- PICK reputation

This keeps private user data and raw recommendations off-chain.

## UI Roles

### Admin

The admin initializes the contract and funds the reward pool.

Admin fields:

- `Verifier address`: wallet allowed to confirm check-ins.
- `Payment token contract`: Soroban token/SAC contract used for fee and reward transfers.
- `Session fee`: amount user pays when creating a session.
- `Reward amount`: token amount paid after verified check-in.
- `PICK reward`: reputation points earned after verification.
- `Fund amount`: token amount added to the reward pool.

### User

The user enters a wish, receives suggestions, selects one place, and creates a Decision Session.

Example wish:

```text
Dinner nearby, under 150k per person, not too noisy, good for 4 people
```

The UI creates:

- a shortlist hash,
- a criteria hash,
- a selected place ID.

Then the user signs `create_session` with Freighter.

### Verifier

The verifier confirms the user actually visited the selected place.

Verifier flow:

- enter Session ID,
- enter check-in proof,
- enter review text,
- hash proof and review,
- call `confirm_checkin`.

After success, the session becomes verified and the user receives rewards.

## Deploy to Stellar Testnet

Create and fund an admin identity:

```bash
stellar keys generate --global fairpick-admin --network testnet --fund
```

Build:

```bash
stellar contract build
```

Deploy:

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/fairpick.wasm \
  --source fairpick-admin \
  --network testnet
```

The command prints a contract address beginning with `C...`. That value is the FairPick `Contract ID`.

Paste it into the UI field:

```text
Contract ID
```

## Payment Token Contract

FairPick needs a Soroban token contract for session fees and rewards.

The current Testnet demo uses the native XLM Stellar Asset Contract:

```text
CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

You can derive the same address locally with:

```bash
stellar contract id asset --asset native --network testnet
```

For a Stellar asset, deploy or resolve its Stellar Asset Contract:

```bash
stellar contract asset deploy \
  --asset CODE:ISSUER_PUBLIC_KEY \
  --source fairpick-admin \
  --network testnet
```

The returned `C...` address is the `Payment token contract`.

For local tests, no external token setup is needed. The Rust tests create a mock Stellar Asset Contract token automatically.

## Basic Usage Flow

1. Start the UI and open `http://127.0.0.1:5174/`.
2. Connect Freighter on Testnet.
3. Paste the FairPick `Contract ID`.
4. Keep the RPC URL as `https://soroban-testnet.stellar.org`.
5. Keep the network passphrase as `Test SDF Network ; September 2015`.
6. In `Admin`, enter the verifier address and payment token contract from the Testnet Deployment section.
7. For a first demo, set `Session fee = 0`, `Reward amount = 0`, and `PICK reward = 10`.
8. Click `Initialize` if the contract is not initialized yet.
9. In `User`, enter a wish and click `Gợi ý địa điểm`.
10. Select a suggestion card.
11. Click `Tạo Decision Session` and sign with Freighter.
12. Copy or keep the returned Session ID.
13. In `Verifier`, enter the Session ID, check-in proof, and review.
14. Click `Hash proof`.
15. Click `Confirm check-in` and sign with the verifier wallet.
16. Use `Load session` to confirm the session is verified.

If you set `Reward amount` above `0`, the admin must fund the reward pool with `Fund rewards` before the verifier confirms check-in.

## Common Issues

### `Failed to find config identity for fairpick-admin`

Create the identity first:

```bash
stellar keys generate --global fairpick-admin --network testnet --fund
```

### `Address already in use`

The UI port is already taken. Use another port:

```bash
python3 -m http.server 5175 --bind 127.0.0.1 -d ui
```

Then open:

```text
http://127.0.0.1:5175/
```

### Browser says page cannot be reached

Make sure the server is running and use `http`, not `https`:

```text
http://127.0.0.1:5174/
```

### `Error(Contract, #2)`

This means `NotInitialized`.

Fix:

1. Check that the FairPick `Contract ID` is correct.
2. Connect with the admin wallet.
3. Fill verifier and payment token contract.
4. Click `Initialize`.
5. Try the user action again.

### `Simulation failed`

Common causes:

- wrong Contract ID,
- contract not initialized,
- wrong payment token contract,
- account has no token balance,
- reward pool is empty,
- wrong wallet role is connected.

## Development Commands

```bash
# Run tests
cargo test --locked

# Build deployable WASM
stellar contract build

# Serve UI
python3 -m http.server 5174 --bind 127.0.0.1 -d ui

# List Stellar CLI identities
stellar keys list
```

## MVP Limitations

- Suggestions are generated from `ui/places.json`, not a production backend.
- PICK is internal reputation state, not a transferable token.
- The payment token must already exist as a Soroban token/SAC contract for on-chain UI flows.
- The UI is intentionally simple and uses browser-loaded ESM packages.

## License

Educational / hackathon MVP.
