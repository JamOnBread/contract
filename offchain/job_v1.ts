import { Lucid, Blockfrost, Script, Constr, Data, PolicyId, Unit, fromText, Tx, UTxO, OutRef, Credential } from "https://deno.land/x/lucid@0.10.7/mod.ts"
import { getCompiledCodeParams, encodeTreasuryDatumTokens, getCompiledCode, encodeAddress, applyCodeParamas, encodeTreasuryDatumAddress } from "./common.ts"
import { InstantBuyDatumV1, Portion } from "./types.ts"

class JamOnBreadAdminV1 {
    private static numberOfStakes = 10n
    private static numberOfToken = 1n
    private static treasuryScriptTitle = "treasury.spend_v1"
    private static instantBuyScriptTitle = "instant_buy.spend_v1"
    private static minimumAdaAmount = 2_000_000n

    private jamTokenPolicy: string = "74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a"
    private jamTokenName: string = "556e69717565"
    private jamStakes: string[]
    private lucid: Lucid


    private treasuryScript: Script
    private instantBuyScript: Script

    private treasuryDatum: Constr<any>

    public static getTreasuryScript(): Script {
        return getCompiledCode(JamOnBreadAdminV1.treasuryScriptTitle)
    }

    public static getJamStakes(lucid: Lucid, policyId: PolicyId, amount: bigint, number: bigint): string[] {
        const stakes: string[] = []

        for (let i = 1n; i <= number; i++) {
            const code = getCompiledCodeParams(
                'staking.withdrawal_v1',
                [encodeTreasuryDatumTokens(policyId, amount), BigInt(i)]
            )

            stakes.push(lucid.utils.validatorToScriptHash(code))
        }

        return stakes
    }

    constructor(
        lucid: Lucid,
        jamTokenPolicy: string,
        jamTokenName: string,
    ) {
        this.lucid = lucid
        this.jamTokenPolicy = jamTokenPolicy
        this.jamTokenName = jamTokenName
        this.jamStakes = JamOnBreadAdminV1.getJamStakes(
            lucid,
            this.jamTokenPolicy,
            JamOnBreadAdminV1.numberOfToken,
            JamOnBreadAdminV1.numberOfStakes
        )

        this.treasuryScript = JamOnBreadAdminV1.getTreasuryScript()
        this.instantBuyScript = applyCodeParamas(
            this.getInstantBuyScript(),
            [
                this.lucid.utils.validatorToScriptHash(this.treasuryScript),
                Array.from(
                    this.jamStakes.map(stakeHash => new Constr(0, [new Constr(1, [stakeHash])]))
                ),
                this.createJobToken()
            ]
        )

        this.treasuryDatum = this.createJobToken()
    }

    public createJobToken(): Constr<any> {
        return encodeTreasuryDatumTokens(this.jamTokenPolicy, BigInt(Math.floor(Number(JamOnBreadAdminV1.numberOfToken) / 2) + 1))
    }

    async payJoBToken(tx: Tx, amount: bigint): Tx {
        return tx.payToAddress(
            await this.lucid.address(),
            {
                [this.jamTokenPolicy + this.jamTokenName]: amount
            }
        )
    }

    async squashNft(): Promise<OutRef> {
        const utxos = await lucid.wallet.getUtxos()
        const assets = {
            lovelace: 0n
        }
        for(let utxo of utxos) {
            for(let asset in utxo.assets) {
                if(asset in assets) {
                    assets[asset] += BigInt(utxo.assets[asset])
                } else {
                    assets[asset] = BigInt(utxo.assets[asset])
                }
            }
        }
        assets.lovelace -= 2_000_000n

        const tx = await this.lucid
            .newTx()
            .collectFrom(utxos)
            .payToAddress(await this.lucid.wallet.address(), assets)
            .complete()

        const signedTx = await tx
            .sign()
            .complete()

        const txHash = await signedTx.submit();

        return {
            txHash,
            outputIndex: 0
        }
    }

    public getInstantBuyScript(): Script {
        return getCompiledCode(JamOnBreadAdminV1.instantBuyScriptTitle)
    }

    getTreasuryAddress(stakeId?: number): string {
        if (typeof stakeId === "undefined")
            stakeId = stakeId || Math.round(Math.random() * this.jamStakes.length)

        const paymentCredential = {
            type: "Script",
            hash: lucid.utils.validatorToScriptHash(this.treasuryScript)
        } as Credential

        const stakeCredential = {
            type: "Script",
            hash: this.jamStakes[stakeId]
        } as Credential

        return lucid.utils.credentialToAddress(paymentCredential, stakeCredential)
    }

    async getEncodedAddress() {
        const address = await lucid.wallet.address()
        const payCred = lucid.utils.paymentCredentialOf(address)
        try {
            const stakeCred = lucid.utils.stakeCredentialOf(address)
            return encodeAddress(payCred.hash, stakeCred!.hash)
        }
        catch (e) {
            return encodeAddress(payCred.hash)
        }
    }

    getInstantBuyAddress(stakeId?: number): string {
        if (typeof stakeId === "undefined")
            stakeId = stakeId || Math.round(Math.random() * this.jamStakes.length)

        const paymentCredential = {
            type: "Script",
            hash: lucid.utils.validatorToScriptHash(this.instantBuyScript)
        } as Credential

        const stakeCredential = {
            type: "Script",
            hash: this.jamStakes[stakeId]
        } as Credential

        return lucid.utils.credentialToAddress(paymentCredential, stakeCredential)
    }

    async getTreasuries(): Promise<UTxO[]> {
        const address = this.getTreasuryAddress(0)
        return await this.lucid.utxosAt(address)
    }

    getTreasury(treasuries: UTxO[], datum: string): UTxO | undefined {
        const index = treasuries.findIndex((value: UTxO) => {
            return value.datum == datum
        })

        if (index > -1) {
            const element = treasuries[index]
            // Removed splice
            // treasuries.splice(index, 1)
            return element
        }
        return undefined
    }

    parseRoyalty(datum: Constr<any>) : Portion | undefined {
        if(datum.index == 0) {
            return {
                percent: Number(datum.fields[0].fields[0]) / 10_000,
                treasury: Data.to(datum.fields[0].fields[1])
            }
        }else {
            return undefined
        }
    }

    parseInstantbuyDatum(datumString: string): InstantBuyDatumV1 {
        const datum: Constr<any> = Data.from(datumString)
        
        const beneficier_address = datum.fields[0].fields[0].fields[0]
        const beneficier_stake = datum.fields[0].fields[1].index == 0 ?
            datum.fields[0].fields[1].fields[0].fields[0].fields[0]
            :
            undefined
        const beneficier = this.lucid.utils.credentialToAddress(
            this.lucid.utils.keyHashToCredential(beneficier_address),
            beneficier_stake ? this.lucid.utils.keyHashToCredential(beneficier_stake) : undefined
        )
        const listingMarketDatum = Data.to(datum.fields[1])

        const listingAffiliateDatum = datum.fields[2].index == 0 ? Data.to(datum.fields[2].fields[0]) : listingMarketDatum
        const amount = datum.fields[3]
        const royalty = this.parseRoyalty(datum.fields[4])

        return {
            beneficier,
            listingMarketDatum,
            listingAffiliateDatum,
            amount,
            royalty
        }
    }

    async instantBuyListTx(tx: Tx, unit: Unit, price: bigint, listing?: string, affiliate?: string, royalty?: Portion): Promise<Tx> {
        if (typeof listing == "undefined") {
            listing = Data.to(this.treasuryDatum)
        }

        const sellerAddr = await this.getEncodedAddress()
        const datum = new Constr(0, [
            sellerAddr,
            Data.from(listing),
            affiliate ? new Constr(0, [Data.from(affiliate)]) : new Constr(1, []),
            price,
            royalty ? new Constr(0, [new Constr(0, [BigInt(Math.ceil(royalty.percent * 10_000)), Data.from(royalty.treasury)])]) : new Constr(1, [])
        ]);

        tx = tx.payToContract(
            this.getInstantBuyAddress(),
            { inline: Data.to(datum) },
            {
                [unit]: BigInt(1),
                lovelace: JamOnBreadAdminV1.minimumAdaAmount
            }
        )

        return tx
    }

    async instantbuyList(unit: Unit, price: bigint, listing?: string, affiliate?: string, royalty?: Portion) {
        let tx = lucid.newTx()
        tx = await this.instantBuyListTx(tx, unit, price, listing, affiliate, royalty)
        tx = await tx.complete();

        const signedTx = await tx.sign().complete();
        const txHash = await signedTx.submit();

        return {
            txHash,
            outputIndex: 0
        }
    }

    async instantBuyCancelTx(tx: Tx, utxo: OutRef): Promise<Tx> {
        const toSpend = await this.lucid.utxosByOutRef([utxo])
        tx = tx.collectFrom(toSpend, Data.to(new Constr(1, [])))
        return tx
    }

    async instantBuyCancel(utxo: OutRef): Promise<string> {
        let txCancel = this.lucid.newTx()
        txCancel = await this.instantBuyCancelTx(txCancel, utxo)
        txCancel = await txCancel
            .attachSpendingValidator(this.instantBuyScript)
            .addSigner(await lucid.wallet.address())
            .complete()

        const signedTx = await txCancel
            .sign()
            .complete()

        const txHash = await signedTx.submit()
        return txHash
    }

    addToTreasuries(treasuries, datum, value) {
        if(datum in treasuries) {
            treasuries[datum] = treasuries[datum] + value
        } else {
            treasuries[datum] = value
        }
    }

    async instantBuyProceed(utxo: OutRef, ...sellMarketPortions: Portion[]) {

        const [collectUtxo] = await lucid.utxosByOutRef([
            utxo
        ])

        const params = this.parseInstantbuyDatum(collectUtxo.datum!)
        const provision = 0.025 * Number(params.amount)

        console.debug("Instant buy", params)
        const payToTreasuries = {
            [Data.to(this.treasuryDatum)]: provision * 0.1
        }
        this.addToTreasuries(payToTreasuries, params.listingMarketDatum, provision * 0.2)
        this.addToTreasuries(payToTreasuries, params.listingAffiliateDatum, provision * 0.2)

        for(let portion of sellMarketPortions) {
            this.addToTreasuries(payToTreasuries, portion.treasury, provision * 0.5 * portion.percent)
        }

        if(params.royalty) {
            this.addToTreasuries(payToTreasuries, params.royalty.treasury, BigInt(Math.ceil(Number(params.amount) * params.royalty.percent)))
        }

        const buyRedeemer = Data.to(new Constr(0, [
            sellMarketPortions.map(portion =>
                new Constr(0,
                    [
                        BigInt(Math.ceil(portion.percent * 10_000)),
                        Data.from(portion.treasury)
                    ]
                ), // selling marketplace
            )]))

        // JoB treasury
        const allTreasuries = await this.getTreasuries()
        const collectFromTreasuries = {}
        
        for(let datum in payToTreasuries) {
            const treasuery = this.getTreasury(allTreasuries, datum)
            collectFromTreasuries[datum] = treasuery
        }

        console.debug("Pay to treasuries", payToTreasuries)

        let buildTx = this.lucid
            .newTx()
            .collectFrom(await this.lucid.wallet.getUtxos())
            .collectFrom(
                Object.values(collectFromTreasuries),
                Data.void()
            )
            .collectFrom(
                [
                    collectUtxo
                ],
                buyRedeemer
            )
            .attachSpendingValidator(this.treasuryScript)
            .attachSpendingValidator(this.instantBuyScript)

        for (let datum in collectFromTreasuries) {
            const treasury = collectFromTreasuries[datum]
            buildTx = buildTx.payToContract(
                treasury.address,
                { inline: treasury.datum! },
                { lovelace: BigInt(treasury.assets.lovelace) + BigInt(payToTreasuries[datum]) }
            )
        }

        buildTx = buildTx.payToAddress(
            params.beneficier,
            { lovelace: params.amount + collectUtxo.assets.lovelace }
        )            

        const tx = await buildTx.complete()
        const signedTx = await tx.sign().complete()
        const txHash = await signedTx.submit()

        return {
            txHash,
            outputIndex: 0
        }
    }

}

const privKey = "ed25519_sk1z5zd4ap8nyyvlh2uz5rt08xh76yjhs0v7yv58vh00z399m3vrppqfhxv0n" // Treaury
const lucid = await Lucid.new(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", "preprodVm9mYgzOYXlfFrFYfgJ2Glz7AlnMjvV9"),
    "Preprod",
)
lucid.selectWalletFromPrivateKey(privKey)



const job = new JamOnBreadAdminV1(lucid, "74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a", "556e69717565")
const unit = "b1ecd813e9084e3592d0986c41b63197fe2eb8e8994c4269933f8363" + "4a6f42566572696669636174696f6e"
// console.log(await job.getTreasuries())
// console.log(await job.squashNft())
console.log(await lucid.wallet.address())


/*
console.log(
    await job.instantbuyList(
        unit, 
        10_000_000n, 
        Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vp54hwj38ykwyvek6vdkug6flwrdtwuazqlwuqngzw5deks388fd7").hash
        )),
        Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vry4ww84sje8lmvw35glqgkdt6ahzdz04x8yqkfmpt5t3xcrve047").hash
        )),
        {percent: 0.1, treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vrelgt8camtmzktcykamyh8rgpq5sutueeawpzwykwpdujq05epfh").hash
        ))} as Portion
    )
)
*/

/*
console.log(await job.instantBuyCancel({
    txHash: "36f3c3105e00319629bf922e69677360a51629079882e16028cd7dc781eeb183",
    outputIndex: 0
}))
*/


console.log(await job.instantBuyProceed(
    {
        txHash: "b111d210134930433a81b0bc8b1348a96d54c4c8ea19ffcbda03e2909fb42cda",
        outputIndex: 0
    },
    {
        percent: 0.2,
        treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vz6r5aetvn6m6y8lax7zlx9dl7hnfm53q4njwzdcyzqmzdct4jjws").hash
        ))
    },
    {
        percent: 0.2,
        treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vz695rlavrxv8wm2r7ur6skp5f3gtkx3xsqk20gpvest92qd42p39").hash
        ))
    },
    {
        percent: 0.1,
        treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vr0yzzjnsnxpkf48n56s5jp06df2tx4dylch7j2zwm0tnrcwrmc4c").hash
        ))
    },
    {
        percent: 0.1,
        treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vqrmaa655rtcxu5lg9nd7tph6wxzq5su646nmweuh798ayqa4z4hc").hash
        ))
    },
    {
        percent: 0.1,
        treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vplh9cjn8vhmzn7qs8ynv7aea3t567a9w4lagetrf896q3q0xamca").hash
        ))
    },/*
    {
        percent: 0.1,
        treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vr6v0wmlzs8xashkqdpm9k47l0q9aek0mucef273ky2xuhcfwqj92").hash
        ))
    },/*
    {
        percent: 0.1,
        treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vqxzql8rxfxefdzjz9t6rdnly0lrffcngk9wy29c6l6j7sss5m2p6").hash
        ))
    },/*
    {
        percent: 0.1,
        treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vr49pv7cpft4fekwg7atl4lv7fc839u72fkc9v39e0x3svcmytec9").hash
        ))
    },
    {
        percent: 0.1,
        treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vqcg5dsaz9kq8n7nj8kpkr8yvpst3me4qzpzpcwkh8sexhc7n5pm7").hash
        ))
    },
    {
        percent: 0.1,
        treasury: Data.to(encodeTreasuryDatumAddress(
            lucid.utils.paymentCredentialOf("addr_test1vrhvvu6kn96f05ucldwlmdg46djdrerrat4qqc28xaj44kcz8j4sd").hash
        ))
    }*/
))


// console.log(job.getTreasuryAddress(0))