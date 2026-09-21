# Production readiness gate

EchoForge Texas Platform is a pre-production prototype. A successful build,
preview, testnet transaction, or source verification does not authorize mainnet
deployment or accepting user funds.

## Required approvals

- [ ] Independent smart-contract audit completed and all critical/high findings resolved.
- [ ] Qualified legal review covers token characterization, capacity claims,
      rewards, transfers, sanctions, disclosures and applicable registrations.
- [ ] Documented evidence supports every public claim about wells, pipelines,
      capacity, revenue, ownership and live data.
- [ ] Named operator approves the incident, pause, settlement and recovery runbooks.

## Base Sepolia rehearsal

- [ ] Deployment gate rejects an incorrect chain, token or missing configuration.
- [ ] Source is verified and the deployment manifest is independently checked.
- [ ] The intended multisig accepts two-step ownership.
- [ ] Each signer, threshold and recovery procedure is tested.
- [ ] Stake, reward, booking, cancellation, expiry settlement and pause flows pass.
- [ ] Monitoring detects reserve impairment and expired unsettled bookings.
- [ ] Frontend uses the rehearsed address and four-argument booking ABI.

## Mainnet gate

- [ ] Release commit and compiler artifacts are immutable and reproducible.
- [ ] Canonical Base USDC address, chain ID and runtime code are verified again.
- [ ] Multisig address and signer membership receive independent confirmation.
- [ ] Initial capacity, price and token distribution receive written approval.
- [ ] Emergency contacts and rollback/migration decisions are documented.
- [ ] `CONFIRM_BASE_MAINNET=DEPLOY_BASE_MAINNET` is set only for the approved run.

## Administrative authority

| Capability | Production expectation |
| --- | --- |
| Ownership acceptance | Reviewed multisig only |
| Pause/unpause | Multisig or narrowly governed operations policy |
| Price and capacity changes | Documented approval and monitoring |
| Blacklist/whitelist changes | Defined legal basis, audit trail and recovery process |
| Surplus withdrawal | Independent reserve check before multisig execution |

## Explicitly out of scope

The repository does not prove real-world asset ownership, pipeline access,
production data, expected returns, regulatory compliance or suitability for any
buyer. Those conclusions require evidence and professional review outside the
software repository.
