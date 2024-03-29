import { Lucid, Blockfrost, Script, Constr, Data, PolicyId, Unit, fromText, Tx, UTxO, OutRef, Credential } from "https://deno.land/x/lucid@0.10.7/mod.ts"
import { getCompiledCodeParams, encodeTreasuryDatumTokens, getCompiledCode, encodeAddress, applyCodeParamas, encodeTreasuryDatumAddress } from "./common.ts"

const privKey = "XXX" // Treaury

/*
const blockfrostApi = "https://cardano-preprod.blockfrost.io/api/v0"
const blockfrostToken = "preprodVm9mYgzOYXlfFrFYfgJ2Glz7AlnMjvV9"
const blockfrostNetwork = "Preprod"
*/

const blockfrostApi = "https://cardano-mainnet.blockfrost.io/api/v0"
const blockfrostToken = "mainnetLzarwTLCt7qIBUnFsvN6blZvtKYQSKgc"
const blockfrostNetwork = "Mainnet"

const numberOfStakes = 10n
const numberOfToken = 5n
const treasuryScriptTitle = "treasury.spend_v1"
const instantBuyScriptTitle = "instant_buy.spend_v1"
const offerScriptTitle = "offer.spend_v1"

const jamTokenPolicy = "5d87ebacd1b26282675a61a1cde3e8c64282677739abb58124138e9c"
const jamTokenName = "4a6f42"

function deployScript(lucid: Lucid, tx: Tx, scriptRef: Script, lock: Script, stake: string): Tx {
    const stakeCredential = {
        type: "Script",
        hash: stake
    }
    const address = lucid.utils.validatorToAddress(lock, stakeCredential)
    return tx.payToContract(
        address,
        {
            inline: Data.void(),
            scriptRef
        },
        {}
    )
}

async function addJamToken(lucid: Lucid, tx: Tx): Promise<Tx> {
    return tx.payToAddress(await lucid.wallet.address(), { [jamTokenPolicy + jamTokenName]: numberOfToken })
}

const lucid = await Lucid.new(
    new Blockfrost(blockfrostApi, blockfrostToken),
    blockfrostNetwork,
)
lucid.selectWalletFromPrivateKey(privKey)

const jobTreasury = encodeTreasuryDatumTokens(jamTokenPolicy, numberOfToken)
const jamStakes: Array<[string, string]> = []
for (let i = 1n; i <= numberOfStakes; i++) {
    const code = getCompiledCodeParams(
        'staking.withdrawal_v1',
        [encodeTreasuryDatumTokens(jamTokenPolicy, numberOfToken), BigInt(i)]
    )
    jamStakes.push([lucid.utils.validatorToScriptHash(code), code])
}

const treasuryScript = getCompiledCode(treasuryScriptTitle)
const instantBuyScript = applyCodeParamas(
    getCompiledCode(instantBuyScriptTitle),
    [
        lucid.utils.validatorToScriptHash(treasuryScript),
        Array.from(
            jamStakes.map(stake => new Constr(0, [new Constr(1, [stake[0]])]))
        ),
        jobTreasury
    ]
)
const offerScript = applyCodeParamas(
    getCompiledCode(offerScriptTitle),
    [
        lucid.utils.validatorToScriptHash(treasuryScript),
        Array.from(
            jamStakes.map(stake => new Constr(0, [new Constr(1, [stake[0]])]))
        ),
        jobTreasury
    ]
)

const lockScript = applyCodeParamas(
    getCompiledCode('staking.lock_v1'),
    [encodeTreasuryDatumTokens(jamTokenPolicy, numberOfToken)]
)


console.log(jamTokenPolicy, jamTokenName)
console.log(await lucid.wallet.address())

let tx = lucid.newTx()

/*
tx = deployScript(lucid, tx, treasuryScript, lockScript, jamStakes[0][0])
tx = deployScript(lucid, tx, instantBuyScript, lockScript, jamStakes[0][0])
tx = deployScript(lucid, tx, offerScript, lockScript, jamStakes[0][0])
*/

Array.from(jamStakes).forEach(stake => tx = deployScript(lucid, tx, stake[1], lockScript, jamStakes[0][0]))


//const utxos = await lucid.utxosByOutRef([
//    { txHash: '8ee250e3d78c01a684acec51be864eff5f36e74227a6b70586759fd36c70370e', outputIndex: 0 }
//])

/*
const ref = await lucid.utxosByOutRef([
    { txHash: '9b1d3d7015b7a038527f03bcbc5fa3f8a9738320ca10e38d5840d5f9ed2d83af', outputIndex: 0 }
])
*/
//console.log(utxos)
//console.log(ref)

//tx = tx.readFrom(ref)
//tx = tx.collectFrom(utxos, Data.void())
//
//tx = await addJamToken(lucid, tx)
//tx = tx.attachSpendingValidator(lockScript)

const txComplete = await tx.complete()
const signedTx = await txComplete.sign().complete()
const txHash = await signedTx.submit()

console.log(txHash)
