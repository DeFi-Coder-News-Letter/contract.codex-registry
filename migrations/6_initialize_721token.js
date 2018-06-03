const CodexCoin = artifacts.require('./CodexCoin.sol')
const CodexTitle = artifacts.require('./CodexTitle.sol')
const CodexTitleProxy = artifacts.require('./CodexTitleProxy.sol')
const ERC900BasicStakeContainer = artifacts.require('./ERC900BasicStakeContainer.sol')

module.exports = async (deployer, network, accounts) => {
  const proxiedCodexTitle = CodexTitle.at(CodexTitleProxy.address)

  deployer
    .then(async () => {
      let initialFees
      let erc20TokenAddress

      switch (network) {
        case 'ganache':
        case 'develop':
        case 'test':
        case 'coverage': {
          erc20TokenAddress = CodexCoin.address
          initialFees = 0
          break
        }

        case 'rinkeby':
          erc20TokenAddress = '0xb902c00f8e5aced53e2a513903fd831d32dd1097'
          initialFees = web3.toWei(1, 'ether')
          break

        default:
          throw new Error('No erc20TokenAddress & initialFees defined for this network')
      }

      console.log(`Setting the fees to ${initialFees} at ERC-20 token address: ${erc20TokenAddress}`)
      await proxiedCodexTitle.setFees(
        erc20TokenAddress,
        accounts[0],
        initialFees, // creationFee
        initialFees, // transferFee
        initialFees, // modificationFee
      )

      await proxiedCodexTitle.setStakeContainer(
        ERC900BasicStakeContainer.address
      )
    })
    .then(async () => {

      let tokenURIPrefix

      switch (network) {
        case 'ganache':
        case 'develop':
        case 'test':
        case 'coverage':
          tokenURIPrefix = 'http://localhost:3001/token-metadata'
          break

        case 'rinkeby':
          tokenURIPrefix = 'http://codex-title-api.codexprotocol-staging.com/token-metadata'
          break

        case 'mainnet':
          tokenURIPrefix = 'http://codex-title-api.codexprotocol.com/token-metadata'
          break

        default:
          throw new Error('No tokenURIPrefix defined for this network')
      }

      console.log('Setting the tokenURIPrefix to:', tokenURIPrefix)
      await proxiedCodexTitle.setTokenURIPrefix(tokenURIPrefix)
    })
    .catch((error) => {
      console.log(error)

      throw error
    })
}