// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Adversarial fixture for an isolated local EVM; never a production asset.
contract MockRevenueToken is ERC20 {
    uint256 public feeBps;
    constructor() ERC20("Test Revenue", "TEST") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function confiscate(address from, uint256 amount) external { _burn(from, amount); }
    function setFee(uint256 value) external { require(value <= 10000); feeBps = value; }
    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0) && feeBps > 0) {
            uint256 fee = amount * feeBps / 10000;
            super._update(from, address(0), fee);
            super._update(from, to, amount - fee);
        } else {
            super._update(from, to, amount);
        }
    }
}
