// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract Arcology is ERC20{
    
    // event Balance(uint256 step);

    constructor(uint256 initialSupply) ERC20("Arcology ERC20 Token", "ACL") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    // function balance(address account) public view returns (uint256) {
    //     uint256 bal=_balances[account];
    //     emit Balance(bal);
    //     return bal;
    
    // }
}
