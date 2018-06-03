import assertRevert from '../helpers/assertRevert'
import getCoreRegistryFunctions from '../helpers/getCoreRegistryFunctions'

const { BigNumber } = web3
const CodexTitle = artifacts.require('CodexTitle.sol')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

contract('CodexTitleAccess', async function (accounts) {
  const creator = accounts[0]
  const firstTokenId = 0
  const providerId = '1'
  const providerMetadataId = '10'

  const hashedMetadata = {
    name: web3.sha3('first token'),
    description: web3.sha3('this is the first token'),
    files: [web3.sha3('file data')],
  }

  const pausableFunctions = getCoreRegistryFunctions(
    accounts,
    firstTokenId, {
      hashedMetadata,
      providerId,
      providerMetadataId,
    }
  )

  describe('when the contract is paused', function () {
    let token

    beforeEach(async function () {
      token = await CodexTitle.new()
      await token.initializeOwnable(creator)

      await token.mint(
        creator,
        hashedMetadata.name,
        hashedMetadata.description,
        hashedMetadata.files,
        providerId,
        providerMetadataId,
      )

      await token.pause()
    })

    describe('pausable functions should revert', function () {
      pausableFunctions.forEach((pausableFunction) => {
        it(pausableFunction.name, async () => {
          await assertRevert(
            token[pausableFunction.name](...pausableFunction.args)
          )
        })
      })
    })

    describe('and then unpaused', function () {
      beforeEach(async function () {
        await token.unpause()
      })

      describe('pausable functions should succeed', function () {
        pausableFunctions.forEach((pausableFunction) => {
          it(pausableFunction.name, async () => {
            await token[pausableFunction.name](...pausableFunction.args)
          })
        })
      })
    })
  })
})
