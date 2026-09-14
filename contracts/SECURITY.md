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
  holder to one MCF. The old wei-scale booking threshold was incorrect.
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
was syntax-checked only. Etherscan V2 verification uses `ETHERSCAN_API_KEY`.

Fourteen tests cover escrow/reward separation, decimals, expiry, withdrawal limits,
proration, two stakers, underfunding, transfer fees and rollback. Five regressions
were reproduced against the original contract. This is focused accounting evidence,
not a comprehensive contract audit or validation of the pipeline business model.

Tooling overrides pin patched `tmp`, `diff` and `serialize-javascript` releases.
The verifier's transitive dependency still includes an upstream elliptic advisory.
See the repository review for the measured scan and remaining limitations.
