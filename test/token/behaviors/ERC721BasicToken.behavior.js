import _ from 'lodash'
import assertRevert from '../../helpers/assertRevert'
import decodeLogs from '../../helpers/decodeLogs'
import sendTransaction from '../../helpers/sendTransaction'

const ERC721Receiver = artifacts.require('ERC721ReceiverMock.sol')
const { BigNumber } = web3

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

export default function shouldBehaveLikeERC721BasicToken(accounts, customMintFunction) {
  const firstTokenId = 0
  const secondTokenId = 1
  const unknownTokenId = 2
  const creator = accounts[0]
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
  const RECEIVER_MAGIC_VALUE = '0xf0b9e5ba'

  let mintFunction
  if (customMintFunction) {
    mintFunction = customMintFunction
  } else {
    mintFunction = async function (tokenToMint, tokenCreator, tokenId) {
      await tokenToMint.mint(tokenCreator, tokenId)
    }
  }

  describe('like a ERC721BasicToken', function () {
    beforeEach(async function () {
      await mintFunction(this.token, creator, firstTokenId)
      await mintFunction(this.token, creator, secondTokenId)
    })

    describe('balanceOf', function () {
      describe('when the given address owns some tokens', function () {
        it('returns the amount of tokens owned by the given address', async function () {
          const balance = await this.token.balanceOf(creator)
          balance.should.be.bignumber.equal(2)
        })
      })

      describe('when the given address does not own any tokens', function () {
        it('returns 0', async function () {
          const balance = await this.token.balanceOf(accounts[1])
          balance.should.be.bignumber.equal(0)
        })
      })

      describe('when querying the zero address', function () {
        it('throws', async function () {
          await assertRevert(this.token.balanceOf(0))
        })
      })
    })

    describe('exists', function () {
      describe('when the token exists', function () {
        const tokenId = firstTokenId

        it('should return true', async function () {
          const result = await this.token.exists(tokenId)
          result.should.be.equal(true)
        })
      })

      describe('when the token does not exist', function () {
        const tokenId = unknownTokenId

        it('should return false', async function () {
          const result = await this.token.exists(tokenId)
          result.should.be.equal(false)
        })
      })
    })

    describe('ownerOf', function () {
      describe('when the given token ID was tracked by this token', function () {
        const tokenId = firstTokenId

        it('returns the owner of the given token ID', async function () {
          const owner = await this.token.ownerOf(tokenId)
          owner.should.be.equal(creator)
        })
      })

      describe('when the given token ID was not tracked by this token', function () {
        const tokenId = unknownTokenId

        it('reverts', async function () {
          await assertRevert(this.token.ownerOf(tokenId))
        })
      })
    })

    describe('transfers', function () {
      const owner = accounts[0]
      const approved = accounts[2]
      const operator = accounts[3]
      const unauthorized = accounts[4]
      const tokenId = firstTokenId
      const data = '0x42'

      let logs = null

      beforeEach(async function () {
        this.to = accounts[1]
        await this.token.approve(approved, tokenId, { from: owner })
        await this.token.setApprovalForAll(operator, true, { from: owner })
      })

      const transferWasSuccessful = function (expctedOwner, expectedTokenId, expectedApproved) {
        it('transfers the ownership of the given token ID to the given address', async function () {
          const newOwner = await this.token.ownerOf(expectedTokenId)
          newOwner.should.be.equal(this.to)
        })

        it('clears the approval for the token ID', async function () {
          const approvedAccount = await this.token.getApproved(expectedTokenId)
          approvedAccount.should.be.equal(ZERO_ADDRESS)
        })

        if (expectedApproved) {
          it('emits an approval and transfer events', async function () {
            logs.length.should.be.equal(2)
            logs[0].event.should.be.eq('Approval')
            logs[0].args._owner.should.be.equal(expctedOwner)
            logs[0].args._approved.should.be.equal(ZERO_ADDRESS)
            logs[0].args._tokenId.should.be.bignumber.equal(expectedTokenId)

            logs[1].event.should.be.eq('Transfer')
            logs[1].args._from.should.be.equal(expctedOwner)
            logs[1].args._to.should.be.equal(this.to)
            logs[1].args._tokenId.should.be.bignumber.equal(expectedTokenId)
          })
        } else {
          it('emits only a transfer event', async function () {
            logs.length.should.be.equal(1)
            logs[0].event.should.be.eq('Transfer')
            logs[0].args._from.should.be.equal(expctedOwner)
            logs[0].args._to.should.be.equal(this.to)
            logs[0].args._tokenId.should.be.bignumber.equal(expectedTokenId)
          })
        }

        it('adjusts owners balances', async function () {
          const newOwnerBalance = await this.token.balanceOf(this.to)
          newOwnerBalance.should.be.bignumber.equal(1)

          const previousOwnerBalance = await this.token.balanceOf(expctedOwner)
          previousOwnerBalance.should.be.bignumber.equal(1)
        })

        it('adjusts owners tokens by index', async function () {
          if (!this.token.tokenOfOwnerByIndex) return

          const newOwnerToken = await this.token.tokenOfOwnerByIndex(this.to, 0)
          newOwnerToken.toNumber().should.be.equal(expectedTokenId)

          const previousOwnerToken = await this.token.tokenOfOwnerByIndex(expctedOwner, 0)
          previousOwnerToken.toNumber().should.not.be.equal(expectedTokenId)
        })
      }

      const shouldTransferTokensByUsers = function (transferFunction) {
        describe('when called by the owner', function () {
          beforeEach(async function () {
            ({ logs } = await transferFunction.call(this, owner, this.to, tokenId, { from: owner }))
          })
          transferWasSuccessful(owner, tokenId, approved)
        })

        describe('when called by the approved individual', function () {
          beforeEach(async function () {
            ({ logs } = await transferFunction.call(this, owner, this.to, tokenId, { from: approved }))
          })
          transferWasSuccessful(owner, tokenId, approved)
        })

        describe('when called by the operator', function () {
          beforeEach(async function () {
            ({ logs } = await transferFunction.call(this, owner, this.to, tokenId, { from: operator }))
          })
          transferWasSuccessful(owner, tokenId, approved)
        })

        describe('when called by the owner without an approved user', function () {
          beforeEach(async function () {
            await this.token.approve(ZERO_ADDRESS, tokenId, { from: owner })
            ;({ logs } = await transferFunction.call(this, owner, this.to, tokenId, { from: operator }))
          })
          transferWasSuccessful(owner, tokenId, null)
        })

        describe('when sent to the owner', function () {
          beforeEach(async function () {
            ({ logs } = await transferFunction.call(this, owner, owner, tokenId, { from: owner }))
          })

          it('keeps ownership of the token', async function () {
            const newOwner = await this.token.ownerOf(tokenId)
            newOwner.should.be.equal(owner)
          })

          it('clears the approval for the token ID', async function () {
            const approvedAccount = await this.token.getApproved(tokenId)
            approvedAccount.should.be.equal(ZERO_ADDRESS)
          })

          it('emits an approval and transfer events', async function () {
            logs.length.should.be.equal(2)
            logs[0].event.should.be.eq('Approval')
            logs[0].args._owner.should.be.equal(owner)
            logs[0].args._approved.should.be.equal(ZERO_ADDRESS)
            logs[0].args._tokenId.should.be.bignumber.equal(tokenId)

            logs[1].event.should.be.eq('Transfer')
            logs[1].args._from.should.be.equal(owner)
            logs[1].args._to.should.be.equal(owner)
            logs[1].args._tokenId.should.be.bignumber.equal(tokenId)
          })

          it('keeps the owner balance', async function () {
            const ownerBalance = await this.token.balanceOf(owner)
            ownerBalance.should.be.bignumber.equal(2)
          })

          it('keeps same tokens by index', async function () {
            if (!this.token.tokenOfOwnerByIndex) return
            const tokensListed = await Promise.all(_.range(2).map((i) => { return this.token.tokenOfOwnerByIndex(owner, i) }))
            tokensListed.map((t) => { return t.toNumber() }).should.have.members([firstTokenId, secondTokenId])
          })
        })

        describe('when the address of the previous owner is incorrect', function () {
          it('reverts', async function () {
            await assertRevert(transferFunction.call(this, unauthorized, this.to, tokenId, { from: owner }))
          })
        })

        describe('when the sender is not authorized for the token id', function () {
          it('reverts', async function () {
            await assertRevert(transferFunction.call(this, owner, this.to, tokenId, { from: unauthorized }))
          })
        })

        describe('when the given token ID does not exist', function () {
          it('reverts', async function () {
            await assertRevert(transferFunction.call(this, owner, this.to, unknownTokenId, { from: owner }))
          })
        })

        describe('when the address to transfer the token to is the zero address', function () {
          it('reverts', async function () {
            await assertRevert(transferFunction.call(this, owner, ZERO_ADDRESS, tokenId, { from: owner }))
          })
        })
      }

      describe('via transferFrom', function () {
        shouldTransferTokensByUsers(function (from, to, tokenIdToTransfer, opts) {
          return this.token.transferFrom(from, to, tokenIdToTransfer, opts)
        })
      })

      describe('via safeTransferFrom', function () {
        const safeTransferFromWithData = function (from, to, tokenIdToTransfer, opts) {
          return sendTransaction(
            this.token,
            'safeTransferFrom',
            'address,address,uint256,bytes',
            [from, to, tokenIdToTransfer, data],
            opts
          )
        }

        const safeTransferFromWithoutData = function (from, to, tokenIdToTransfer, opts) {
          return this.token.safeTransferFrom(from, to, tokenIdToTransfer, opts)
        }

        const shouldTransferSafely = function (transferFun, transferData) {
          describe('to a user account', function () {
            shouldTransferTokensByUsers(transferFun)
          })

          describe('to a valid receiver contract', function () {
            beforeEach(async function () {
              this.receiver = await ERC721Receiver.new(RECEIVER_MAGIC_VALUE, false)
              this.to = this.receiver.address
            })

            shouldTransferTokensByUsers(transferFun)

            it('should call onERC721Received', async function () {
              const result = await transferFun.call(this, owner, this.to, tokenId, { from: owner })
              result.receipt.logs.length.should.be.equal(3)
              const [log] = decodeLogs([result.receipt.logs[2]], ERC721Receiver, this.receiver.address)
              log.event.should.be.eq('Received')
              log.args._address.should.be.equal(owner)
              log.args._tokenId.toNumber().should.be.equal(tokenId)
              log.args._data.should.be.equal(transferData)
            })
          })
        }

        describe('with data', function () {
          shouldTransferSafely(safeTransferFromWithData, data)
        })

        describe('without data', function () {
          shouldTransferSafely(safeTransferFromWithoutData, '0x')
        })

        describe('to a receiver contract returning unexpected value', function () {
          it('reverts', async function () {
            const invalidReceiver = await ERC721Receiver.new('0x42', false)
            await assertRevert(this.token.safeTransferFrom(owner, invalidReceiver.address, tokenId, { from: owner }))
          })
        })

        describe('to a receiver contract that throws', function () {
          it('reverts', async function () {
            const invalidReceiver = await ERC721Receiver.new(RECEIVER_MAGIC_VALUE, true)
            await assertRevert(this.token.safeTransferFrom(owner, invalidReceiver.address, tokenId, { from: owner }))
          })
        })

        describe('to a contract that does not implement the required function', function () {
          it('reverts', async function () {
            const invalidReceiver = this.token
            await assertRevert(this.token.safeTransferFrom(owner, invalidReceiver.address, tokenId, { from: owner }))
          })
        })
      })
    })

    describe('approve', function () {
      const tokenId = firstTokenId
      const sender = creator
      const to = accounts[1]

      let logs = null

      const itClearsApproval = function () {
        it('clears approval for the token', async function () {
          const approvedAccount = await this.token.getApproved(tokenId)
          approvedAccount.should.be.equal(ZERO_ADDRESS)
        })
      }
      const itApproves = function (address) {
        it('sets the approval for the target address', async function () {
          const approvedAccount = await this.token.getApproved(tokenId)
          approvedAccount.should.be.equal(address)
        })
      }
      const itEmitsApprovalEvent = function (address) {
        it('emits an approval event', async function () {
          logs.length.should.be.equal(1)
          logs[0].event.should.be.eq('Approval')
          logs[0].args._owner.should.be.equal(sender)
          logs[0].args._approved.should.be.equal(address)
          logs[0].args._tokenId.should.be.bignumber.equal(tokenId)
        })
      }
      describe('when clearing approval', function () {
        describe('when there was no prior approval', function () {
          beforeEach(async function () {
            ({ logs } = await this.token.approve(ZERO_ADDRESS, tokenId, { from: sender }))
          })

          itClearsApproval()

          it('does not emit an approval event', async function () {
            logs.length.should.be.equal(0)
          })
        })

        describe('when there was a prior approval', function () {
          beforeEach(async function () {
            await this.token.approve(to, tokenId, { from: sender })
            ;({ logs } = await this.token.approve(ZERO_ADDRESS, tokenId, { from: sender }))
          })

          itClearsApproval()
          itEmitsApprovalEvent(ZERO_ADDRESS)
        })
      })

      describe('when approving a non-zero address', function () {
        describe('when there was no prior approval', function () {
          beforeEach(async function () {
            ({ logs } = await this.token.approve(to, tokenId, { from: sender }))
          })

          itApproves(to)
          itEmitsApprovalEvent(to)
        })

        describe('when there was a prior approval to the same address', function () {
          beforeEach(async function () {
            await this.token.approve(to, tokenId, { from: sender })
            ;({ logs } = await this.token.approve(to, tokenId, { from: sender }))
          })

          itApproves(to)
          itEmitsApprovalEvent(to)
        })

        describe('when there was a prior approval to a different address', function () {
          beforeEach(async function () {
            await this.token.approve(accounts[2], tokenId, { from: sender })
            ;({ logs } = await this.token.approve(to, tokenId, { from: sender }))
          })

          itApproves(to)
          itEmitsApprovalEvent(to)
        })
      })

      describe('when the address that receives the approval is the owner', function () {
        it('reverts', async function () {
          await assertRevert(this.token.approve(sender, tokenId, { from: sender }))
        })
      })

      describe('when the sender does not own the given token ID', function () {
        it('reverts', async function () {
          await assertRevert(this.token.approve(to, tokenId, { from: accounts[2] }))
        })
      })

      describe('when the sender is approved for the given token ID', function () {
        it('reverts', async function () {
          await this.token.approve(accounts[2], tokenId, { from: sender })
          await assertRevert(this.token.approve(to, tokenId, { from: accounts[2] }))
        })
      })

      describe('when the sender is an operator', function () {
        const operator = accounts[2]
        beforeEach(async function () {
          await this.token.setApprovalForAll(operator, true, { from: sender })
          ;({ logs } = await this.token.approve(to, tokenId, { from: operator }))
        })

        itApproves(to)
        itEmitsApprovalEvent(to)
      })

      describe('when the given token ID does not exist', function () {
        it('reverts', async function () {
          await assertRevert(this.token.approve(to, unknownTokenId, { from: sender }))
        })
      })
    })

    describe('setApprovalForAll', function () {
      const sender = creator

      describe('when the operator willing to approve is not the owner', function () {
        const operator = accounts[1]

        describe('when there is no operator approval set by the sender', function () {
          it('approves the operator', async function () {
            await this.token.setApprovalForAll(operator, true, { from: sender })

            const isApproved = await this.token.isApprovedForAll(sender, operator)
            isApproved.should.be.equal(true)
          })

          it('emits an approval event', async function () {
            const { logs } = await this.token.setApprovalForAll(operator, true, { from: sender })

            logs.length.should.be.equal(1)
            logs[0].event.should.be.eq('ApprovalForAll')
            logs[0].args._owner.should.be.equal(sender)
            logs[0].args._operator.should.be.equal(operator)
            logs[0].args._approved.should.be.equal(true)
          })
        })

        describe('when the operator was set as not approved', function () {
          beforeEach(async function () {
            await this.token.setApprovalForAll(operator, false, { from: sender })
          })

          it('approves the operator', async function () {
            await this.token.setApprovalForAll(operator, true, { from: sender })

            const isApproved = await this.token.isApprovedForAll(sender, operator)
            isApproved.should.be.equal(true)
          })

          it('emits an approval event', async function () {
            const { logs } = await this.token.setApprovalForAll(operator, true, { from: sender })

            logs.length.should.be.equal(1)
            logs[0].event.should.be.eq('ApprovalForAll')
            logs[0].args._owner.should.be.equal(sender)
            logs[0].args._operator.should.be.equal(operator)
            logs[0].args._approved.should.be.equal(true)
          })

          it('can unset the operator approval', async function () {
            await this.token.setApprovalForAll(operator, false, { from: sender })

            const isApproved = await this.token.isApprovedForAll(sender, operator)
            isApproved.should.be.equal(false)
          })
        })

        describe('when the operator was already approved', function () {
          beforeEach(async function () {
            await this.token.setApprovalForAll(operator, true, { from: sender })
          })

          it('keeps the approval to the given address', async function () {
            await this.token.setApprovalForAll(operator, true, { from: sender })

            const isApproved = await this.token.isApprovedForAll(sender, operator)
            isApproved.should.be.equal(true)
          })

          it('emits an approval event', async function () {
            const { logs } = await this.token.setApprovalForAll(operator, true, { from: sender })

            logs.length.should.be.equal(1)
            logs[0].event.should.be.eq('ApprovalForAll')
            logs[0].args._owner.should.be.equal(sender)
            logs[0].args._operator.should.be.equal(operator)
            logs[0].args._approved.should.be.equal(true)
          })
        })
      })

      describe('when the operator is the owner', function () {
        const operator = creator

        it('reverts', async function () {
          await assertRevert(this.token.setApprovalForAll(operator, true, { from: sender }))
        })
      })
    })
  })
}