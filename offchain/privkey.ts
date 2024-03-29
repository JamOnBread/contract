import { Lucid, Blockfrost, Script, Constr, Data, PolicyId, Unit, fromText, Tx, UTxO, OutRef, Credential } from "https://deno.land/x/lucid@0.10.7/mod.ts"
import { getCompiledCodeParams, encodeTreasuryDatumTokens, getCompiledCode, encodeAddress, applyCodeParamas, encodeTreasuryDatumAddress } from "./common.ts"


const blockfrostApi = "https://cardano-mainnet.blockfrost.io/api/v0"
const blockfrostToken = "mainnetLzarwTLCt7qIBUnFsvN6blZvtKYQSKgc"
const blockfrostNetwork = "Mainnet"

const lucid = await Lucid.new(
    new Blockfrost(blockfrostApi, blockfrostToken),
    blockfrostNetwork,
)


const privateKey = lucid.utils.generatePrivateKey(); // Bech32 encoded private key
lucid.selectWalletFromPrivateKey(privateKey);

console.log(privateKey)
console.log(await lucid.wallet.address())