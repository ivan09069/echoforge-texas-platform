import { expect } from 'chai';
import { network } from 'hardhat';
const { ethers, provider } = await network.create('hardhat');

const USD = 10n ** 6n;
const PIPE = 10n ** 18n;
const DAY = 86400n;

describe('Capacity accounting on an isolated EVM', function () {
  let owner, staker, booker, outsider, revenue, pipe, address;
  beforeEach(async () => {
    [owner, staker, booker, outsider] = await ethers.getSigners();
    revenue = await (await ethers.getContractFactory('MockRevenueToken')).deploy();
    pipe = await (await ethers.getContractFactory('PipelineCapacityToken')).deploy(await revenue.getAddress(), 1000, USD);
    address = await pipe.getAddress();
    await pipe.transfer(staker.address, 100n * PIPE);
    await pipe.transfer(booker.address, 100n * PIPE);
    await pipe.connect(staker).stake(100n * PIPE, 7);
    for (const who of [owner, booker]) {
      await revenue.mint(who.address, 10000n * USD);
      await revenue.connect(who).approve(address, ethers.MaxUint256);
    }
  });
  async function book(capacity = 10, days = 10) {
    const id = await pipe.bookingCounter();
    const payment = BigInt(capacity * days) * USD;
    await pipe.connect(booker).bookCapacity(capacity, days, payment, ethers.MaxUint256);
    return { id, booking: await pipe.getBooking(id), payment };
  }
  async function next(timestamp) { await provider.send('evm_setNextBlockTimestamp', [Number(timestamp)]); }
  async function solvent() {
    expect(await revenue.balanceOf(address)).to.be.gte(await pipe.bookingEscrow() + await pipe.rewardReserve());
    expect(await pipe.balanceOf(address)).to.be.gte(await pipe.totalStaked());
  }

  it('booking payments are not claimable rewards', async () => {
    await book();
    expect(await pipe.pendingRewards(staker.address)).to.equal(0);
    await expect(pipe.connect(staker).claimRewards()).to.be.revertedWith('No rewards');
  });
  it('rejects booking with only a few token wei', async () => {
    await pipe.transfer(outsider.address, 4);
    await revenue.mint(outsider.address, USD);
    await revenue.connect(outsider).approve(address, USD);
    await expect(pipe.connect(outsider).bookCapacity(1, 1, USD, ethers.MaxUint256)).to.be.revertedWith('Insufficient PIPE tokens');
  });
  it('uses whole MCF consistently for token entitlements', async () => {
    expect(await pipe.capacityEntitlement(4n * PIPE)).to.equal(1);
    expect(await pipe.capacityEntitlement(await pipe.MAX_SUPPLY())).to.equal(25000);
  });
  it('reserves booking payments against owner withdrawals', async () => {
    await book();
    await expect(pipe.emergencyWithdraw(await revenue.getAddress(), USD)).to.revert(ethers);
    expect(await revenue.balanceOf(address)).to.equal(100n * USD);
  });
  it('protects staked PIPE from owner withdrawal', async () => {
    await expect(pipe.emergencyWithdraw(address, PIPE)).to.revert(ethers);
    expect(await pipe.balanceOf(address)).to.equal(100n * PIPE);
  });
  it('cancels with only earned revenue and the fee becoming rewards', async () => {
    const { id, booking } = await book();
    const before = await revenue.balanceOf(booker.address);
    await next(booking.startTime + 5n * DAY);
    await pipe.connect(booker).cancelBooking(id);
    expect(await revenue.balanceOf(booker.address) - before).to.equal(45n * USD);
    expect(await pipe.pendingRewards(staker.address)).to.equal(55n * USD);
    await expect(pipe.connect(staker).claimRewards()).to.changeTokenBalance(ethers, revenue, staker, 55n * USD);
    expect(await pipe.bookingEscrow()).to.equal(0);
    expect(await pipe.rewardReserve()).to.equal(0);
    expect(await pipe.availableCapacity()).to.equal(1000);
    await expect(pipe.connect(booker).cancelBooking(id)).to.be.revertedWith('Booking not active');
    await solvent();
  });
  it('claims separately deposited rewards without spending booking escrow', async () => {
    const { id, booking } = await book();
    await pipe.depositRevenue(20n * USD);
    await expect(pipe.connect(staker).claimRewards()).to.changeTokenBalance(ethers, revenue, staker, 20n * USD);
    expect(await revenue.balanceOf(address)).to.equal(100n * USD);
    await next(booking.startTime + 5n * DAY);
    await pipe.connect(booker).cancelBooking(id);
    await pipe.connect(staker).claimRewards();
    await solvent();
  });
  it('settles expired bookings once and releases their capacity', async () => {
    const { id, booking } = await book();
    await expect(pipe.connect(outsider).settleBooking(id)).to.be.revertedWith('Booking not expired');
    await next(booking.endTime);
    await pipe.connect(outsider).settleBooking(id);
    expect((await pipe.getBooking(id)).active).to.equal(false);
    expect(await pipe.availableCapacity()).to.equal(1000);
    expect(await pipe.bookingEscrow()).to.equal(0);
    expect(await pipe.pendingRewards(staker.address)).to.equal(100n * USD);
    await expect(pipe.settleBooking(id)).to.be.revertedWith('Booking not active');
    await pipe.connect(staker).claimRewards();
    await solvent();
  });
  it('allows only surplus revenue and unstaked PIPE to be recovered', async () => {
    await book();
    await pipe.depositRevenue(20n * USD);
    await revenue.mint(address, 7n * USD);
    await expect(pipe.emergencyWithdraw(await revenue.getAddress(), 8n * USD)).to.revert(ethers);
    await pipe.emergencyWithdraw(await revenue.getAddress(), 7n * USD);
    await pipe.transfer(address, 3n * PIPE);
    await pipe.emergencyWithdraw(address, 3n * PIPE);
    await expect(pipe.emergencyWithdraw(address, 1)).to.revert(ethers);
    await solvent();
  });
  it('rejects underfunded fee-on-transfer deposits and bookings atomically', async () => {
    await revenue.setFee(100);
    await expect(pipe.depositRevenue(100n * USD)).to.be.revertedWith('Unsupported revenue transfer');
    await expect(pipe.connect(booker).bookCapacity(10, 10, 100n * USD, ethers.MaxUint256)).to.be.revertedWith('Unsupported revenue transfer');
    expect(await pipe.pendingRevenue()).to.equal(0);
    expect(await pipe.bookingCounter()).to.equal(0);
    expect(await revenue.balanceOf(address)).to.equal(0);
  });
  it('does not erase reward debt when reserves are externally impaired', async () => {
    await book();
    await pipe.depositRevenue(20n * USD);
    await revenue.confiscate(address, 1);
    const before = await pipe.stakes(staker.address);
    await expect(pipe.connect(staker).claimRewards()).to.be.revertedWith('Revenue reserves impaired');
    expect((await pipe.stakes(staker.address)).rewardDebt).to.equal(before.rewardDebt);
    expect(await pipe.pendingRewards(staker.address)).to.equal(20n * USD);
  });
  it('rolls back reward accounting if the recipient would receive less', async () => {
    await pipe.depositRevenue(20n * USD);
    await revenue.setFee(100);
    await expect(pipe.connect(staker).claimRewards()).to.be.revertedWith('Unsupported revenue transfer');
    expect(await pipe.pendingRewards(staker.address)).to.equal(20n * USD);
    expect(await pipe.rewardReserve()).to.equal(20n * USD);
  });
  it('rolls back a failed refund without closing its booking', async () => {
    const { id } = await book();
    await revenue.setFee(100);
    await expect(pipe.connect(booker).cancelBooking(id)).to.be.revertedWith('Unsupported revenue transfer');
    expect((await pipe.getBooking(id)).active).to.equal(true);
    expect(await pipe.bookingEscrow()).to.equal(100n * USD);
    expect(await pipe.availableCapacity()).to.equal(990);
  });
  it('conserves reserves across two stakers and mixed booking outcomes', async () => {
    await pipe.transfer(outsider.address, 100n * PIPE);
    await pipe.connect(outsider).stake(100n * PIPE, 7);
    const first = await book(10, 10);
    const second = await book(5, 20);
    await pipe.depositRevenue(40n * USD);
    for (const who of [staker, outsider]) { await pipe.connect(who).claimRewards(); await solvent(); }
    await next(first.booking.startTime + 5n * DAY);
    await pipe.connect(booker).cancelBooking(first.id); await solvent();
    for (const who of [outsider, staker]) { await pipe.connect(who).claimRewards(); await solvent(); }
    await next(second.booking.endTime);
    await pipe.settleBooking(second.id); await solvent();
    for (const who of [staker, outsider]) { await pipe.connect(who).unstake(100n * PIPE); await solvent(); }
    expect(await pipe.totalStaked()).to.equal(0);
    expect(await pipe.totalBookedCapacity()).to.equal(0);
    expect(await pipe.bookingEscrow()).to.equal(0);
    expect(await pipe.rewardReserve()).to.equal(0);
  });

  it('escrows booking rights so the same PIPE cannot back multiple bookings', async () => {
    const { id } = await book(10, 10);
    expect(await pipe.bookingTokenEscrow(id)).to.equal(40n * PIPE);
    expect(await pipe.totalBookingTokenEscrow()).to.equal(40n * PIPE);
    expect(await pipe.balanceOf(booker.address)).to.equal(60n * PIPE);
    await expect(
      pipe.connect(booker).bookCapacity(20, 1, 20n * USD, ethers.MaxUint256)
    ).to.be.revertedWith('Insufficient PIPE tokens');
    await pipe.connect(booker).cancelBooking(id);
    expect(await pipe.balanceOf(booker.address)).to.equal(100n * PIPE);
    expect(await pipe.totalBookingTokenEscrow()).to.equal(0);
  });

  it('enforces booking price and deadline limits', async () => {
    await expect(
      pipe.connect(booker).bookCapacity(10, 10, 99n * USD, ethers.MaxUint256)
    ).to.be.revertedWith('Price exceeds limit');
    await expect(
      pipe.connect(booker).bookCapacity(10, 10, 100n * USD, 1)
    ).to.be.revertedWith('Booking expired');
  });

  it('pauses new risk while keeping cancellation and unstaking exits open', async () => {
    const { id } = await book();
    await pipe.pause();
    await expect(pipe.connect(booker).bookCapacity(1, 1, USD, ethers.MaxUint256))
      .to.be.revertedWithCustomError(pipe, 'EnforcedPause');
    await expect(pipe.depositRevenue(USD)).to.be.revertedWithCustomError(pipe, 'EnforcedPause');
    await expect(pipe.transfer(outsider.address, PIPE)).to.be.revertedWithCustomError(pipe, 'EnforcedPause');
    await pipe.connect(booker).cancelBooking(id);
    await next((await pipe.stakes(staker.address)).lockUntil);
    await pipe.connect(staker).unstake(100n * PIPE);
  });

  it('uses two-step ownership transfer', async () => {
    await pipe.transferOwnership(outsider.address);
    expect(await pipe.owner()).to.equal(owner.address);
    expect(await pipe.pendingOwner()).to.equal(outsider.address);
    await pipe.connect(outsider).acceptOwnership();
    expect(await pipe.owner()).to.equal(outsider.address);
  });

  it('requires both parties to be whitelisted for direct restricted transfers', async () => {
    await pipe.setTransferRestricted(true);
    await pipe.setWhitelist(owner.address, true);
    await expect(pipe.transfer(outsider.address, PIPE)).to.be.revertedWith('Transfer restricted');
    await pipe.setWhitelist(outsider.address, true);
    await pipe.transfer(outsider.address, PIPE);
  });
});
