// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PIPE TOKEN - Pipeline Capacity Rights Token
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * EchoForge Texas Energy Platform
 * "Drill 1 Well → Bootstrap Crypto → Reinvest Renewables"
 * 
 * By Ivan Torres / EchoForge Studios
 * 
 * This token represents fractional ownership of Permian Basin pipeline capacity
 * rights, with automated revenue distribution from pipeline usage fees.
 * 
 * Features:
 * - ERC-20 compliant tokenized pipeline capacity
 * - Staking mechanism with USDC rewards
 * - Automated revenue distribution
 * - Capacity booking system
 * - Compliance-ready transfer restrictions
 * 
 * Deployed on Base (Ethereum L2)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface IERC20Extended is IERC20 {
    function decimals() external view returns (uint8);
}

contract PipelineCapacityToken is ERC20, ERC20Burnable, ERC20Permit, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20Extended;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════

    // Token configuration
    uint256 public constant MAX_SUPPLY = 100_000 * 10**18; // 100,000 PIPE tokens
    uint256 public constant CAPACITY_PER_TOKEN = 0.25 ether; // 0.25 MCF per token (25,000 MCF total)
    
    // Revenue token (USDC on Base)
    IERC20Extended public immutable revenueToken;
    
    // Staking state
    struct StakeInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 stakedAt;
        uint256 lockUntil;
    }
    
    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;
    uint256 public accRewardPerShare;
    uint256 public constant REWARD_PRECISION = 1e18;
    
    // Minimum stake lock period (7 days)
    uint256 public constant MIN_LOCK_PERIOD = 7 days;
    
    // Revenue distribution
    uint256 public totalRevenueDistributed;
    uint256 public pendingRevenue;
    
    // Capacity booking
    struct CapacityBooking {
        address booker;
        uint256 capacityMCF;
        uint256 startTime;
        uint256 endTime;
        uint256 pricePerMCF;
        bool active;
    }
    
    mapping(uint256 => CapacityBooking) public bookings;
    uint256 public bookingCounter;
    uint256 public totalBookedCapacity;
    uint256 public baseCapacityPrice; // Price per MCF per day in USDC (6 decimals)
    
    // Compliance
    mapping(address => bool) public blacklisted;
    mapping(address => bool) public whitelisted;
    bool public transferRestricted;
    
    // Pipeline metrics
    uint256 public totalCapacityMCF;
    uint256 public utilizationRate; // Basis points (10000 = 100%)
    
    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event Staked(address indexed user, uint256 amount, uint256 lockUntil);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RevenueDeposited(uint256 amount, uint256 timestamp);
    event RevenueDistributed(uint256 amount, uint256 totalStaked);
    event CapacityBooked(uint256 indexed bookingId, address indexed booker, uint256 capacityMCF, uint256 duration);
    event BookingCancelled(uint256 indexed bookingId);
    event CapacityPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event PipelineMetricsUpdated(uint256 totalCapacity, uint256 utilization);
    event AddressBlacklisted(address indexed account, bool status);
    event TransferRestrictionUpdated(bool restricted);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Constructor initializes the PIPE token
     * @param _revenueToken Address of USDC contract on Base
     * @param _initialCapacityMCF Initial pipeline capacity in MCF
     * @param _basePrice Base price per MCF per day (in USDC with 6 decimals)
     */
    constructor(
        address _revenueToken,
        uint256 _initialCapacityMCF,
        uint256 _basePrice
    ) 
        ERC20("Pipeline Capacity Token", "PIPE") 
        ERC20Permit("Pipeline Capacity Token")
        Ownable(msg.sender)
    {
        require(_revenueToken != address(0), "Invalid revenue token");
        require(_initialCapacityMCF > 0, "Invalid capacity");
        
        revenueToken = IERC20Extended(_revenueToken);
        totalCapacityMCF = _initialCapacityMCF;
        baseCapacityPrice = _basePrice;
        
        // Mint initial supply to deployer
        _mint(msg.sender, MAX_SUPPLY);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STAKING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Stake PIPE tokens to earn revenue share
     * @param amount Amount of PIPE to stake
     * @param lockDays Number of days to lock (minimum 7)
     */
    function stake(uint256 amount, uint256 lockDays) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        require(lockDays >= 7, "Minimum lock is 7 days");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Update rewards before modifying stake
        _updateRewards();
        
        StakeInfo storage userStake = stakes[msg.sender];
        
        // Claim pending rewards if any
        if (userStake.amount > 0) {
            uint256 pending = _pendingReward(msg.sender);
            if (pending > 0) {
                _safeRewardTransfer(msg.sender, pending);
                emit RewardsClaimed(msg.sender, pending);
            }
        }
        
        // Transfer tokens to contract
        _transfer(msg.sender, address(this), amount);
        
        // Update stake info
        userStake.amount += amount;
        userStake.rewardDebt = (userStake.amount * accRewardPerShare) / REWARD_PRECISION;
        userStake.stakedAt = block.timestamp;
        
        // Set lock period (extend if already locked)
        uint256 newLockUntil = block.timestamp + (lockDays * 1 days);
        if (newLockUntil > userStake.lockUntil) {
            userStake.lockUntil = newLockUntil;
        }
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, userStake.lockUntil);
    }
    
    /**
     * @dev Unstake PIPE tokens after lock period
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount >= amount, "Insufficient staked");
        require(block.timestamp >= userStake.lockUntil, "Still locked");
        
        _updateRewards();
        
        // Claim pending rewards
        uint256 pending = _pendingReward(msg.sender);
        if (pending > 0) {
            _safeRewardTransfer(msg.sender, pending);
            emit RewardsClaimed(msg.sender, pending);
        }
        
        // Update stake
        userStake.amount -= amount;
        userStake.rewardDebt = (userStake.amount * accRewardPerShare) / REWARD_PRECISION;
        totalStaked -= amount;
        
        // Return tokens
        _transfer(address(this), msg.sender, amount);
        
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @dev Claim pending staking rewards
     */
    function claimRewards() external nonReentrant {
        _updateRewards();
        
        uint256 pending = _pendingReward(msg.sender);
        require(pending > 0, "No rewards");
        
        stakes[msg.sender].rewardDebt = (stakes[msg.sender].amount * accRewardPerShare) / REWARD_PRECISION;
        _safeRewardTransfer(msg.sender, pending);
        
        emit RewardsClaimed(msg.sender, pending);
    }
    
    /**
     * @dev View pending rewards for a user
     */
    function pendingRewards(address user) external view returns (uint256) {
        return _pendingReward(user);
    }
    
    function _pendingReward(address user) internal view returns (uint256) {
        StakeInfo storage userStake = stakes[user];
        if (userStake.amount == 0) return 0;
        
        uint256 accReward = accRewardPerShare;
        if (totalStaked > 0 && pendingRevenue > 0) {
            accReward += (pendingRevenue * REWARD_PRECISION) / totalStaked;
        }
        
        return ((userStake.amount * accReward) / REWARD_PRECISION) - userStake.rewardDebt;
    }
    
    function _updateRewards() internal {
        if (totalStaked == 0 || pendingRevenue == 0) return;
        
        accRewardPerShare += (pendingRevenue * REWARD_PRECISION) / totalStaked;
        totalRevenueDistributed += pendingRevenue;
        
        emit RevenueDistributed(pendingRevenue, totalStaked);
        
        pendingRevenue = 0;
    }
    
    function _safeRewardTransfer(address to, uint256 amount) internal {
        uint256 balance = revenueToken.balanceOf(address(this));
        if (amount > balance) {
            revenueToken.safeTransfer(to, balance);
        } else {
            revenueToken.safeTransfer(to, amount);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REVENUE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Deposit revenue for distribution to stakers
     * @param amount Amount of USDC to deposit
     */
    function depositRevenue(uint256 amount) external {
        require(amount > 0, "Cannot deposit 0");
        
        revenueToken.safeTransferFrom(msg.sender, address(this), amount);
        pendingRevenue += amount;
        
        emit RevenueDeposited(amount, block.timestamp);
    }
    
    /**
     * @dev Trigger revenue distribution manually
     */
    function distributeRevenue() external {
        _updateRewards();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CAPACITY BOOKING
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Book pipeline capacity
     * @param capacityMCF Amount of capacity in MCF
     * @param durationDays Duration of booking in days
     */
    function bookCapacity(uint256 capacityMCF, uint256 durationDays) external nonReentrant returns (uint256) {
        require(capacityMCF > 0, "Invalid capacity");
        require(durationDays > 0, "Invalid duration");
        require(capacityMCF <= availableCapacity(), "Insufficient capacity");
        
        // Must hold tokens proportional to capacity being booked
        uint256 requiredTokens = (capacityMCF * 10**18) / CAPACITY_PER_TOKEN;
        require(balanceOf(msg.sender) >= requiredTokens, "Insufficient PIPE tokens");
        
        // Calculate cost
        uint256 totalCost = capacityMCF * baseCapacityPrice * durationDays;
        
        // Collect payment
        revenueToken.safeTransferFrom(msg.sender, address(this), totalCost);
        pendingRevenue += totalCost;
        
        // Create booking
        uint256 bookingId = bookingCounter++;
        bookings[bookingId] = CapacityBooking({
            booker: msg.sender,
            capacityMCF: capacityMCF,
            startTime: block.timestamp,
            endTime: block.timestamp + (durationDays * 1 days),
            pricePerMCF: baseCapacityPrice,
            active: true
        });
        
        totalBookedCapacity += capacityMCF;
        _updateUtilization();
        
        emit CapacityBooked(bookingId, msg.sender, capacityMCF, durationDays);
        
        return bookingId;
    }
    
    /**
     * @dev Cancel an active booking (only before end time)
     * @param bookingId ID of the booking to cancel
     */
    function cancelBooking(uint256 bookingId) external nonReentrant {
        CapacityBooking storage booking = bookings[bookingId];
        require(booking.booker == msg.sender, "Not your booking");
        require(booking.active, "Booking not active");
        require(block.timestamp < booking.endTime, "Booking expired");
        
        // Calculate refund (pro-rated)
        uint256 remainingTime = booking.endTime - block.timestamp;
        uint256 totalDuration = booking.endTime - booking.startTime;
        uint256 refund = (booking.capacityMCF * booking.pricePerMCF * remainingTime) / (1 days);
        
        // Apply 10% cancellation fee
        refund = (refund * 90) / 100;
        
        booking.active = false;
        totalBookedCapacity -= booking.capacityMCF;
        
        if (refund > 0) {
            revenueToken.safeTransfer(msg.sender, refund);
        }
        
        _updateUtilization();
        
        emit BookingCancelled(bookingId);
    }
    
    /**
     * @dev Get available pipeline capacity
     */
    function availableCapacity() public view returns (uint256) {
        return totalCapacityMCF - totalBookedCapacity;
    }
    
    function _updateUtilization() internal {
        if (totalCapacityMCF == 0) {
            utilizationRate = 0;
        } else {
            utilizationRate = (totalBookedCapacity * 10000) / totalCapacityMCF;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Update base capacity price
     */
    function setCapacityPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = baseCapacityPrice;
        baseCapacityPrice = newPrice;
        emit CapacityPriceUpdated(oldPrice, newPrice);
    }
    
    /**
     * @dev Update pipeline metrics
     */
    function updatePipelineMetrics(uint256 newCapacity) external onlyOwner {
        require(newCapacity >= totalBookedCapacity, "Cannot reduce below booked");
        totalCapacityMCF = newCapacity;
        _updateUtilization();
        emit PipelineMetricsUpdated(newCapacity, utilizationRate);
    }
    
    /**
     * @dev Blacklist an address
     */
    function setBlacklist(address account, bool status) external onlyOwner {
        blacklisted[account] = status;
        emit AddressBlacklisted(account, status);
    }
    
    /**
     * @dev Set transfer restriction mode
     */
    function setTransferRestricted(bool restricted) external onlyOwner {
        transferRestricted = restricted;
        emit TransferRestrictionUpdated(restricted);
    }
    
    /**
     * @dev Whitelist address for restricted transfers
     */
    function setWhitelist(address account, bool status) external onlyOwner {
        whitelisted[account] = status;
    }
    
    /**
     * @dev Emergency withdraw (owner only)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20Extended(token).safeTransfer(owner(), amount);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRANSFER OVERRIDES
    // ═══════════════════════════════════════════════════════════════════════════
    
    function _update(address from, address to, uint256 amount) internal virtual override {
        // Skip checks for minting/burning
        if (from != address(0) && to != address(0)) {
            require(!blacklisted[from], "Sender blacklisted");
            require(!blacklisted[to], "Recipient blacklisted");
            
            if (transferRestricted) {
                require(
                    whitelisted[from] || whitelisted[to] || 
                    from == address(this) || to == address(this),
                    "Transfer restricted"
                );
            }
        }
        
        super._update(from, to, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Get staking info for a user
     */
    function getStakeInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 pendingReward,
        uint256 lockUntil,
        uint256 stakedAt
    ) {
        StakeInfo storage info = stakes[user];
        return (
            info.amount,
            _pendingReward(user),
            info.lockUntil,
            info.stakedAt
        );
    }
    
    /**
     * @dev Get booking info
     */
    function getBooking(uint256 bookingId) external view returns (
        address booker,
        uint256 capacityMCF,
        uint256 startTime,
        uint256 endTime,
        uint256 pricePerMCF,
        bool active
    ) {
        CapacityBooking storage booking = bookings[bookingId];
        return (
            booking.booker,
            booking.capacityMCF,
            booking.startTime,
            booking.endTime,
            booking.pricePerMCF,
            booking.active
        );
    }
    
    /**
     * @dev Get pipeline statistics
     */
    function getPipelineStats() external view returns (
        uint256 totalCapacity,
        uint256 bookedCapacity,
        uint256 available,
        uint256 utilization,
        uint256 pricePerMCF
    ) {
        return (
            totalCapacityMCF,
            totalBookedCapacity,
            availableCapacity(),
            utilizationRate,
            baseCapacityPrice
        );
    }
    
    /**
     * @dev Get staking statistics
     */
    function getStakingStats() external view returns (
        uint256 totalStakedAmount,
        uint256 totalRevenue,
        uint256 pendingRevenueAmount,
        uint256 rewardPerShare
    ) {
        return (
            totalStaked,
            totalRevenueDistributed,
            pendingRevenue,
            accRewardPerShare
        );
    }
    
    /**
     * @dev Calculate capacity entitlement for token amount
     */
    function capacityEntitlement(uint256 tokenAmount) external pure returns (uint256) {
        return (tokenAmount * CAPACITY_PER_TOKEN) / 10**18;
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
