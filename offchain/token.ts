import { Lucid, Blockfrost, Script, Constr, Data, PolicyId, Unit, fromText, Tx, UTxO, OutRef, Credential } from "https://deno.land/x/lucid@0.10.7/mod.ts"
import { getCompiledCodeParams, encodeTreasuryDatumTokens, getCompiledCode, encodeAddress, applyCodeParamas, encodeTreasuryDatumAddress } from "./common.ts"


const blockfrostApi = "https://cardano-mainnet.blockfrost.io/api/v0"
const blockfrostToken = "mainnetLzarwTLCt7qIBUnFsvN6blZvtKYQSKgc"
const blockfrostNetwork = "Mainnet"

const lucid = await Lucid.new(
    new Blockfrost(blockfrostApi, blockfrostToken),
    blockfrostNetwork,
)


const privateKey = 'XXX'
lucid.selectWalletFromPrivateKey(privateKey)

const address = await lucid.wallet.address()
const utxos = await lucid.utxosAt(address)
const utxo = utxos[0]
const params = [new Constr(0, [new Constr(0, [utxo.txHash]), BigInt(utxo.outputIndex)])]
const validator = getCompiledCodeParams("assets.mint_v1", params)

console.log(validator)

const nftPolicyId: PolicyId = lucid.utils.mintingPolicyToId(validator)
const tokenName = fromText('JoB')
const unit: Unit = nftPolicyId + tokenName;

console.log(unit)

const tx = await lucid.newTx().mintAssets(
    { [unit]: BigInt(10) },
    Data.void() // Number of tokens must be equal to the number in redeemer
)
    .attachMintingPolicy(validator)
    .collectFrom([utxo])
    .complete()
const signedTx = await tx.sign().complete();
const txHash = await signedTx.submit()
console.log(signedTx)
console.log(txHash)