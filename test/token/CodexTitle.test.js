import shouldBehaveLikeERC165 from './behaviors/ERC165.behavior'
import shouldBehaveLikeCodexTitle from './behaviors/CodexTitle.behavior'
import shouldBehaveLikeCodexTitleWithFees from './behaviors/CodexTitleFees.behavior'

const { BigNumber } = web3
const CodexTitle = artifacts.require('CodexTitle.sol')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

contract('CodexTitle', function (accounts) {
  const metadata = {
    hashedMetadata: {
      name: web3.sha3('First token'),
      description: web3.sha3('This is the first token'),
      files: [web3.sha3('file data')],
    },
    providerId: '1',
    providerMetadataId: '10',
  }

  beforeEach(async function () {
    this.token = await CodexTitle.new()
    await this.token.initializeOwnable(accounts[0])
  })

  shouldBehaveLikeERC165()

  // Base behavior, no fees
  shouldBehaveLikeCodexTitle(accounts, metadata)

  // Extended functionality & base behavior with fees enabled
  shouldBehaveLikeCodexTitleWithFees(accounts, metadata)
})
