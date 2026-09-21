# Capacity token accounting repair

This is a source-code repair and local test suite. No existing on-chain deployment
was changed. An immutable deployed instance needs a separately reviewed migration
or replacement; do not assume a Git merge updates its bytecode or balances.

## Accounting rules

- `bookingEscrow` reserves full upfront payments of active bookings. It is not
  staking revenue and cannot be withdrawn by the owner or claimed by stakers.
- `rewardReserve` backs recognized revenue and unpaid rewards. Only surplus above
  both reserves can be recovered. Staked PIPE is separately protected.
- Cancellation closes escrow and returns 90% of the unelapsed original payment.
  The earned portion and cancellation fee become staking revenue at that time.
- After expiry, anyone can call `settleBooking(id)` once to release capacity and
  recognize payment as revenue. Settlement is explicit: no background keeper or
  on-chain iteration was added. Operators must arrange settlement calls.
- Revenue is recognized at closure, not progressively during active bookings.
  Reward rounding dust stays reserved conservatively; there is no dust sweep.
- PIPE has 18 decimals; MCF quantities are whole units. Four whole PIPE entitle a
  holder to one MCF. Required PIPE is escrowed for the booking lifetime so the
  same tokens cannot reserve capacity more than once.
- Bookings include a caller-selected maximum cost and execution deadline.
- Ownership transfer is two-step. Production ownership should be accepted by a
  reviewed multisig rather than an individual deployer account.
- Emergency pause blocks new stakes, deposits, bookings and direct holder
  transfers while leaving claims, cancellations, settlements and unstaking open.
- Revenue tokens require deployed code and six decimals. Collection and payouts
  check exact received balances; fee-on-transfer tokens are unsupported.
  External freezes, confiscation or rebasing can still stop payments, but failed
  payouts revert state instead of silently consuming a user's claim.

## Reproduce

Use Node 24 or newer, from `contracts/`:

```sh
npm ci --ignore-scripts
npm run compile
npm run test:security
npm audit
```

The test config exposes only an isolated chain (31337), with no remote RPC,
forking, or external signing accounts. The npm lock pins Solidity 0.8.37;
compilation does not download another compiler. OpenZeppelin is pinned to 5.6.1,
and compiler and local EVM target Cancun. Hardhat 3 replaces the older toolchain.
Deployment and verification need separate chain validation; the deployment script
is restricted to Base Sepolia and Base, checks the live chain ID and canonical
USDC interface, requires explicit RPC/signer/verifier/owner configuration, and
fails if source verification fails. Base mainnet requires an additional explicit
confirmation value. Successful runs start a two-step transfer to the configured
multisig and write a deployment manifest; the multisig must still accept ownership.

Fourteen tests cover escrow/reward separation, decimals, expiry, withdrawal limits,
proration, two stakers, underfunding, transfer fees and rollback. Five regressions
were reproduced against the original contract. This is focused accounting evidence,
not a comprehensive contract audit or validation of the pipeline business model.

Tooling overrides pin patched `tmp`, `diff` and `serialize-javascript` releases.
The verifier's transitive dependency still includes an upstream elliptic advisory.
See the repository review for the measured scan and remaining limitations.

## Frontend build repair

The root project had Vite 8 paired with React plugin 4, whose peer range excludes
Vite 8. A clean npm install reproduced ERESOLVE. The React plugin is now 6.1.1,
which supports Vite 8, and the lockfile is refreshed. Unused wagmi, viem and React
Query dependencies were removed; the app's ethers wallet integration is preserved.
CI now checks the frontend independently from contract compilation and tests.

The repaired root frontend builds with Node 24 and its final npm audit reports
zero advisories. Vercel uses a frozen `npm ci --ignore-scripts` installation.
