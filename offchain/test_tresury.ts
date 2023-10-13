import { Lucid, Blockfrost, C, SpendingValidator, paymentCredentialOf, applyParamsToScript, PolicyId, ScriptHash, Constr, Data } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { getCompiledCode, getCompiledCodeParams, encodeTreasuryDatumTokens } from "./common.ts";

const contract = "5905f3010000323232323232323232323222232533300932323232323232533301000514a22a66602066e1cdd698088011bad30110011337106eb4c048008dd698090008a503332223330060034bded8c10100000101000022533301453330143375e660206024660206024004900024000008266ebccc040c04800920043374a90021980c001a5eb80528099bb0375066e00dd6980a800a40046ea0cdc01bad301600130073756660206024004900108009bac3300b300d3300b300d00848001200400600a3332223330050034bded8c10100000101000022533301353330133375e6601e60226601e60226601e60220049001240009000002099baf3300f30113300f30110024800920043374a90021980b801a5eb80528099bb0375066e00dd6980a000a40046ea0cdc01bad3015001300637566601e60226601e602200490012400420026eb0cc028c030cc028c03001d2000480000140248c8c8c94ccc044cdc3a4004002290000991bad3017001300f002300f0013253330103370e90010008a6103d87a800013232323300100100222533301700114c103d87a800013232323253330183371e9110000213374a90001980e1ba80014bd700998030030019bad3019003375c602e004603600460320026eacc058004c038008c038004cc01000522100222323300100100422533301400110041323233005002330040040013018002301600132533300c3370e900000089919191919299980899b87480000044c8c8cc88c8cc00400400c894ccc06800452809919299980c99b8f00200514a2266008008002603c0046eb8c070004dd61980798089980798088062400090080009bae3017001300f00214a0601e002602800260180026024002601400e26464664466e24004ccc888c8cc004004010894ccc06000440104c8c8cc014008cc010010004c070008c068004dd6198061807198061807004a40009000240004466e00004cc88c8c8cc004004008894ccc0680045200013232323232337000040026600c00c0066eb4c07000cdd7180d001180f001180e0009919299980b19b874800800452f5bded8c02646eacc070004c050008c050004cc028008004dd59980718081980718080012400490010021bae3300a300c00148000dd6998051806000a40046024002601400e601400c44646600200200644a666022002298103d87a800013232323253330123371e00e004266e95200033016374c00297ae0133006006003375660260066eb8c044008c054008c04c004c94ccc028cdc3a400460120022646464a66601a66e1d2000300c001132323300b300d3300b300d3300b300d00148009200048000c04c004c02c00458cc88c8cc00400400c894ccc04c0045300103d87a80001323253330123375e6601c60200049000002899ba548000cc0580092f5c0266008008002602e004602a0026eb0cc020c028cc020c028015200048000004c040004c02000458cc014c01c0092002149858cc88c94ccc02ccdc3a400000226464a66602060260042649319299980719b87480000044c8c8c8c94ccc054c0600084c8c9263253330143370e900000089919299980c980e00109924c64a66602e66e1d200000113232533301c301f002132498c04400458c074004c05400854ccc05ccdc3a40040022646464646464a66604060460042930b1bad30210013021002375a603e002603e0046eb4c074004c05400858c05400458c068004c04800c54ccc050cdc3a40040022a66602e60240062930b0b180900118050018b180b000980b001180a00098060010b18060008b180880098048010a99980599b87480080044c8c94ccc040c04c0084c92632533300e3370e9000000899191919299980a980c0010a4c2c6eb4c058004c058008dd7180a00098060010b18060008b180880098048010b1804800919299980519b87480000044c8c94ccc03cc04800852616375c602000260100042a66601466e1d200200113232533300f3012002149858dd7180800098040010b180400080199800800a40004444666600e66e1c00400c0308cccc014014cdc000224004601c0020040044600a6ea80048c00cdd5000ab9a5573aaae7955cfaba05742ae881"
const hash = "83cef3e0cfa6da2374005ca3178c97d8eabab7003f49e9b364dd6813"
const privKey = "ed25519_sk1z5zd4ap8nyyvlh2uz5rt08xh76yjhs0v7yv58vh00z399m3vrppqfhxv0n" // Treaury
const keyList = [
    "ed25519_sk15pn6zaq4lntnmtk280434gc24vxh3f6jmuz2gpskeqckq5uxh2es8e0ccy", // 1
    "ed25519_sk1605rvkwqtgrdxcjmjvm5cppkd475cna3sd4m4gfca9v7q743hxqq3ecmzs",
    "ed25519_sk18z93rx38307z7xn2xg00pck26l7awsacsqyc6r4pqv2gw5q043sqq62d2z",
    "ed25519_sk164dq2dzgx5uegrjd3s0rcek0zgtl2g6nmf0welv69rp8t3r4uayquwgcz5",
    "ed25519_sk14ljjydcrh36wqxa6ldymakwnv4ndsheq9pur2erpwyeaaja2lmrs6s256n",
    "ed25519_sk1mgpzprxf7h577tlrtnf7hsnna9mj8wzhvtajcp0chf3wzndz20eqdq2d7m",
    "ed25519_sk10gur89e08u4ur7cu77lyupxskjjze0hz2cwscplpzjlvdkxyfgmq55zk0x",
    "ed25519_sk1u99hfqz70237sxsh2eg5nxyw7p8qehqtrxl9ll4rfzrzrfpwqglsw6flxn",
    "ed25519_sk199jt0t7ad8vp0l5qwjqadl73vg8ygagssnn7ecudeh6supjhsmdsz0s8fd",
    "ed25519_sk1nugkm42afqtjwzxgw70xv4zkuyk8amp5q633sc8w34u4dc3r7xnsezgl9x", // 10
    "ed25519_sk1dz6frupmeynvky98gy9qdmh8m8rm7amqtd36nlf3gqe87k605a0qd7pwtl",
    "ed25519_sk1qce3v42x0gwx4cpncrpcw59sseuf5fgt2pmtqq6hykx32zld5vhst9xpak",
    "ed25519_sk1xjy49xevfmn792f40emqkvsrne95tpfmes2mc0g7c5yek8yplwzsgr3pj5",
    "ed25519_sk1sp6yf08346sggprwhnqf0kfkc9mzwpphsp39yglt67x6kk72w4zs56k6ce",
    "ed25519_sk16trz8sxcydfqsmn8dglzgw3t9c7xpk8ps9xkdv8cwd5z2kjv3jpqv5sze7",
    "ed25519_sk14a4nq6h9hc9wf7662w4wmn5r5ys0rwz42v5c9lv6crzyjecv5amqp9qtxl",
    "ed25519_sk179gt0amc532vve6evxg3586vw546z26yvmqpxv24k68ygggmvags3ccp8c",
    "ed25519_sk1lnzqau4r5j8xjdkh003kn4xuur2m4x532gss3ycuw4karc50kw7q45l3j7",
    "ed25519_sk1cf6p4hslr48ls2uq5g4j2pf3vnajqf8ve7djg0u8ydu28fr735cqlwskfd",
    "ed25519_sk17mdvywaze38m8ruv5pjthgtxgq3sukunzxp368wemg3r8hvt29hq5fy9pz", // 20
    "ed25519_sk1a9lljvjma5xs3p0x348yanvsy4375wk8fdjhxgq34njfrq7pc8cquumx3l",
    "ed25519_sk1uepnzwjhswg03tzsux5h5shamx34ry9g9fknukjmncr65gmxkwysudz6dz",
    "ed25519_sk1dfvp03ns0xqgzsvw3wwe5nr5a3j974s3kd4l88erv6adrmlzyzcqrnxhvj",
    "ed25519_sk1vs8wxc0hzz6g97ty8ghafdm78kaa62vmpdmg78swe6l5nlpgp82splav0w",
    "ed25519_sk1txrnrqlh5pajzjytexyvl72gfgsd3d4uj25ph5pwdtd7at8p97ks50lmym"
]
const walletList = await Promise.all(keyList.map(async (privKey) => {
    const lucid = await Lucid.new(
        new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", "preprodVm9mYgzOYXlfFrFYfgJ2Glz7AlnMjvV9"),
        "Preprod",
    );
    lucid.selectWalletFromPrivateKey(privKey)
    return lucid;
}))

const addressList = await Promise.all(walletList.map(async (lucid) => {return await lucid.wallet.address()}));
console.log(addressList)
const lucid = await Lucid.new(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", "preprodVm9mYgzOYXlfFrFYfgJ2Glz7AlnMjvV9"),
    "Preprod",
);
lucid.selectWalletFromPrivateKey(privKey)

const treasuryValidator = getCompiledCode("treasury.spending_v1")
const stakeValidator = getCompiledCodeParams(
    'staking.withdrawal_v1', 
    [encodeTreasuryDatumTokens("74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a", 1n), 1n]
)
const stakeValidatorHash = lucid.utils.validatorToScriptHash(stakeValidator)
const stakeCredential = lucid.utils.scriptHashToCredential(stakeValidatorHash)
const address = lucid.utils.validatorToAddress(treasuryValidator, stakeCredential)
console.log(address)
/*
let tx = await lucid.newTx()
tx = await tx.payToContract(
    address,
    { inline: Data.to(encodeTreasuryDatumTokens("74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a", 1n))},
    {lovelace: 5_000_000n}
).complete()
*/

/*
const [utxo] = await lucid.utxosByOutRef([{
    txHash: "3f45744454713556ecf7ea13027bc27394f38d3ccbe3fc2d67efebe74ec47778",
    outputIndex: 0
}])
const tx = await lucid
    .newTx()
    .collectFrom([utxo], Data.void())
    .payToContract(
        address,
        { inline: Data.to(encodeTreasuryDatumTokens("74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a", 1n))},
        {lovelace: 2_000_000n}
    )  
    .payToAddress(await lucid.wallet.address(), {["74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a556e69717565"]: 1n})
    .attachSpendingValidator(treasuryValidator)
    .complete()
*/


/*
const treasuryScript: SpendingValidator = {
    type: "PlutusV2",
    script: contract
};
console.log(await lucid.wallet.address())
const address = lucid.utils.validatorToAddress(treasuryScript)
console.log(address)
const datum1 = encodeTreasuryDatumAddress(paymentCredentialOf(await lucid.wallet.address()).hash)

console.log(datum1)
const datum2 = Data.to(datum1)
console.log(datum2)
*/

/*
let tx = await lucid.newTx()
for(const wallet of walletList) {
    tx = tx.payToContract(
        address,
        { inline: Data.to(encodeTreasuryDatumTokens("74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a", 1n))},
        {lovelace: 2_000_100n}
    )
}
tx = await tx.complete()
*/


const oldUtxo = Array.from(Array(8).keys()).map(n => {
    // 0c0001261e45b5d1ee357491fa6fd5a12acbc17a81739572c206b8e885485cb8
    return {
        txHash: "fe1184d755bd2a0976876aa3df54f6aabd23507483dbc4b3a17b36129e68739b",
        outputIndex: 9 + n
    }
})



const utxos = await lucid.utxosByOutRef(oldUtxo)
//console.log(utxos)


let tx = await lucid
    .newTx()
    .collectFrom(utxos, Data.void())
    .attachSpendingValidator(treasuryValidator)

for(let utxo of utxos) {
    tx = tx .payToContract(
        utxo.address,
        { inline:  utxo.datum},
        {lovelace: utxo.assets.lovelace + 100n}
    )    
}
tx = await tx.complete()



//let tx = await lucid.newTx().payToAddress("addr_test1vr49pv7cpft4fekwg7atl4lv7fc839u72fkc9v39e0x3svcmytec9", {lovelace: 10_000_000n}).complete()

/*
console.log(lucid.utils.credentialToAddress(lucid.utils.keyHashToCredential("ea50b3d80a5754e6ce47babfd7ecf27078979e526d82b225cbcd1833")))
const [utxo] = await lucid.utxosByOutRef([{
    txHash: "3352ccf1ddf423ae90207b763d7af99f142f9e9e2d78fc988630094d561dffd0",
    outputIndex: 0
}])
console.log(utxo.datum)
let tx = await walletList[10]
    .newTx()
    .collectFrom([utxo], Data.void())
    .attachSpendingValidator(treasuryScript)
    .addSigner("addr_test1vr49pv7cpft4fekwg7atl4lv7fc839u72fkc9v39e0x3svcmytec9")
    .complete()
*/



const signedTx = await tx.sign().complete()
const txHash = await signedTx.submit()
console.log(txHash)
