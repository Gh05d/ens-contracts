const ENS = artifacts.require('./registry/ENSRegistry.sol');
const PublicResolver = artifacts.require('PublicResolver.sol');
const NameWrapper = artifacts.require('DummyNameWrapper.sol');

const namehash = require('eth-ens-namehash');
const sha3 = require('web3-utils').sha3;

const { shouldBehaveLikeAResolver } = require("./Resolver.behaviour");
const { exceptions } = require("../test-utils");

contract('PublicResolver', function (accounts) {
    let ens, resolver, nameWrapper;
    const node = namehash.hash('eth');

    before(async () => {
        ens = await ENS.new();
        nameWrapper = await NameWrapper.new();
        resolver = await PublicResolver.new(ens.address, nameWrapper.address);
        await ens.setSubnodeOwner('0x0', sha3('eth'), accounts[0], {from: accounts[0]});
    });

    beforeEach(async () => {
        result = await ethers.provider.send('evm_snapshot');
    });

    afterEach(async () => {
        await ethers.provider.send('evm_revert', [result])
    });

    shouldBehaveLikeAResolver(() => ({ownerAccount: accounts[0], nonOwnerAccount: accounts[1], ens, resolver}));

    describe('authorisations', async () => {

        it('permits authorisations to be set', async () => {
            await resolver.setApprovalForAll(accounts[1], true, {from: accounts[0]});
            assert.equal(await resolver.isApprovedForAll(accounts[0], accounts[1]), true);
        });

        it('permits authorised users to make changes', async () => {
            await resolver.setApprovalForAll(accounts[1], true, {from: accounts[0]});
            assert.equal(await resolver.isApprovedForAll(await ens.owner(node), accounts[1]), true);
            await resolver.methods['setAddr(bytes32,address)'](node, accounts[1], {from: accounts[1]});
            assert.equal(await resolver.addr(node), accounts[1]);
        });

        it('permits authorisations to be cleared', async () => {
            await resolver.setApprovalForAll(accounts[1], false, {from: accounts[0]});
            await exceptions.expectFailure(resolver.methods['setAddr(bytes32,address)'](node, accounts[0], {from: accounts[1]}));
        });

        it('permits non-owners to set authorisations', async () => {
            await resolver.setApprovalForAll(accounts[2], true, {from: accounts[1]});

            // The authorisation should have no effect, because accounts[1] is not the owner.
            await exceptions.expectFailure(
                resolver.methods['setAddr(bytes32,address)'](node, accounts[0], {from: accounts[2]})
            );
        });

        it('checks the authorisation for the current owner', async () => {
            await resolver.setApprovalForAll(accounts[2], true, {from: accounts[1]});
            await ens.setOwner(node, accounts[1], {from: accounts[0]});

            await resolver.methods['setAddr(bytes32,address)'](node, accounts[0], {from: accounts[2]});
            assert.equal(await resolver.addr(node), accounts[0]);
        });

        it('emits an ApprovalForAll log', async () => {
            var owner = accounts[0]
            var operator = accounts[1]
            var tx = await resolver.setApprovalForAll(operator, true, {from: owner});
            assert.equal(tx.logs.length, 1);
            assert.equal(tx.logs[0].event, "ApprovalForAll");
            assert.equal(tx.logs[0].args.owner, owner);
            assert.equal(tx.logs[0].args.operator, operator);
            assert.equal(tx.logs[0].args.approved, true);
        });

        it('reverts if attempting to approve self as an operator', async () => {
            await expect(
                resolver.setApprovalForAll(accounts[1], true, {from: accounts[1]})
            ).to.be.revertedWith(
                'ERC1155: setting approval status for self',
            );
        });

        it('permits name wrapper owner to make changes if owner is set to name wrapper address', async () => {
            var owner = await ens.owner(node)            
            var operator = accounts[2]
            await exceptions.expectFailure(resolver.methods['setAddr(bytes32,address)'](node, owner, {from: operator}));
            await ens.setOwner(node, nameWrapper.address, {from: owner})
            await expect(resolver.methods['setAddr(bytes32,address)'](node, owner, {from: operator}))
        });
    });
});
