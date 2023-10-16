import { Lucid, Blockfrost, Data } from "https://deno.land/x/lucid@0.10.7/mod.ts"
import { mintUniqueAsset, encodeTreasuryDatumTokens, getCompiledCodeParams } from "./common.ts"


const privKey = "ed25519_sk1z5zd4ap8nyyvlh2uz5rt08xh76yjhs0v7yv58vh00z399m3vrppqfhxv0n" // Treaury
const jobPolicy = "74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a" as PolicyId
const jobAssetName = "556e69717565"
const lucid = await Lucid.new(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", "preprodVm9mYgzOYXlfFrFYfgJ2Glz7AlnMjvV9"),
    "Preprod",
);
lucid.selectWalletFromPrivateKey(privKey)
const pool = "pool13m26ky08vz205232k20u8ft5nrg8u68klhn0xfsk9m4gsqsc44v"
const stakeValidator = getCompiledCodeParams(
    'staking.withdrawal_v1', 
    [encodeTreasuryDatumTokens("74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a", 1n), 1n]
)

const stake = lucid.utils.validatorToScriptHash(stakeValidator)
const stakeCred = lucid.utils.scriptHashToCredential(stake);
console.log("StakeCred", stake, stakeCred)

const reward = lucid.utils.credentialToRewardAddress(stakeCred)
console.log("Reward", reward)

/*
const tx = await lucid.newTx()
    .registerStake(reward)
    .delegateTo(reward, pool, Data.void())
    .payToAddress(await lucid.wallet.address(), { [jobPolicy + jobAssetName]: 6n })
    .attachCertificateValidator(stakeValidator)
    .complete();

const signedTx = await tx.sign().complete()
const txHash = await signedTx.submit()
console.log(txHash)
*/


/*
const tx = await lucid.newTx()
    .payToAddress(await lucid.wallet.address(), { [jobPolicy + jobAssetName]: 6n })
    .withdraw(
        reward,
        10000,
        Data.void(),
    )    
    .attachCertificateValidator(stakingScript)
    .complete();

const signedTx = await tx.sign().complete()
const txHash = await signedTx.submit()
console.log(txHash)


/*const tx = lucid.newTx()
    .payToAddress()
*/
