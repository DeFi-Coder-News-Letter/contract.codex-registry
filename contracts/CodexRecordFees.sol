pragma solidity 0.4.24;

import "./CodexRecordMetadata.sol";
import "./CodexStakeContainerInterface.sol";
import "./ERC20/ERC20.sol";

import "./library/DelayedPausable.sol";


/**
 * @title CodexRecordFees
 * @dev Storage, mutators, and modifiers for fees when using the token.
 *  This also includes the DelayedPausable contract for the onlyOwner modifier.
 */
contract CodexRecordFees is CodexRecordMetadata, DelayedPausable {

  // Implementation of the ERC20 Codex Protocol Token, used for fees in the contract
  ERC20 public codexCoin;

  // Implementation of the ERC900 Codex Protocol Stake Container,
  //  used to calculate discounts on fees
  CodexStakeContainerInterface public codexStakeContainer;

  // Address where all contract fees are sent, i.e., the Community Fund
  address public feeRecipient;

  // Fee to create new tokens. 10^18 = 1 token
  uint256 public creationFee = 0;

  // Fee to transfer tokens. 10^18 = 1 token
  uint256 public transferFee = 0;

  // Fee to modify tokens. 10^18 = 1 token
  uint256 public modificationFee = 0;

  modifier canPayFees(uint256 _baseFee) {
    if (feeRecipient != address(0) && _baseFee > 0) {

      if (codexStakeContainer != address(0)) {

        uint256 discountCredits = codexStakeContainer.creditBalanceOf(msg.sender);
        if (discountCredits >= _baseFee) {
          codexStakeContainer.spendCredits(msg.sender, _baseFee);
        } else {
          require(
            codexCoin.transferFrom(msg.sender, feeRecipient, _baseFee),
            "Fee in CODX required");
        }
      }
    }

    _;
  }

  /**
   * @dev Sets the address of the ERC20 token used for fees in the contract.
   *  Fees are in the smallest denomination, e.g., 10^18 is 1 token.
   * @param _codexCoin ERC20 The address of the ERC20 Codex Protocol Token
   * @param _feeRecipient address The address where the fees are sent
   * @param _creationFee uint256 The new creation fee.
   * @param _transferFee uint256 The new transfer fee.
   * @param _modificationFee uint256 The new modification fee.
   */
  function setFees(
    ERC20 _codexCoin,
    address _feeRecipient,
    uint256 _creationFee,
    uint256 _transferFee,
    uint256 _modificationFee
  )
    external
    onlyOwner
  {
    codexCoin = _codexCoin;
    feeRecipient = _feeRecipient;
    creationFee = _creationFee;
    transferFee = _transferFee;
    modificationFee = _modificationFee;
  }

  function setStakeContainer(CodexStakeContainerInterface _codexStakeContainer) external onlyOwner {
    codexStakeContainer = _codexStakeContainer;
  }
}
