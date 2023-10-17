import { Lucid, Blockfrost, Script, Constr, Data, PolicyId, Unit, fromText, Tx, UTxO, OutRef, Credential } from "https://deno.land/x/lucid@0.10.7/mod.ts"
import { getCompiledCodeParams, encodeTreasuryDatumTokens, getCompiledCode, encodeAddress, applyCodeParamas } from "./common.ts"
import { InstantBuyDatumV1 } from "./types.ts"

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
            console.log(value.datum, datum)
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

    parseInstantbuyDatum(lucid: Lucid, datumString: string): InstantBuyDatumV1 {
        const datum: Constr<any> = Data.from(datumString)
        const amount = datum.fields[3]
        const listing = Data.to(datum.fields[1])
        const beneficier_address = datum.fields[0].fields[0].fields[0]
        const beneficier_stake = ((datum) => {
            if(datum.fields[0].fields[1].constructor == 0) {
                return datum.fields[0].fields[1].fields[0].fields[0].fields[0]
            } else {
                return undefined
            }
        }) (datum)

        const beneficier = lucid.utils.credentialToAddress(
            lucid.utils.keyHashToCredential(beneficier_address),
            beneficier_stake ? lucid.utils.keyHashToCredential(beneficier_stake) : undefined
        )

        return {
            amount,
            listing,
            beneficier,

            affiliate: undefined,
            percent: undefined,
            royalty: undefined
        }
    }

    async instantBuyListTx(tx: Tx, unit: Unit, price: bigint, listing: string, affiliate?: string, royalty?: string, percent?: number): Promise<Tx> {
        const sellerAddr = await this.getEncodedAddress()
        const datum = new Constr(0, [
            sellerAddr,
            Data.from(listing),
            affiliate ? new Constr(0, [Data.from(affiliate)]) : new Constr(1, []),
            price,
            royalty && percent ? new Constr(0, [new Constr(0, [BigInt(percent * 10_000), Data.from(royalty)])]) : new Constr(1, [])
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

    async instantbuyList(unit: Unit, price: bigint, listing: string, affiliate?: string, royalty?: string, percent?: number) {
        let tx = lucid.newTx()
        tx = await this.instantBuyListTx(tx, unit, price, listing, affiliate, royalty, percent)
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

    async instantBuyProceed(utxo: OutRef, marketTreasury?: string) {

        if (typeof marketTreasury == "undefined") {
            marketTreasury = Data.to(this.treasuryDatum)
        }

        const [collectUtxo] = await this.lucid.utxosByOutRef([
            utxo
        ])

        const treasuries = await this.getTreasuries()
        console.log(marketTreasury)
        console.log(treasuries)
        const params = this.parseInstantbuyDatum(this.lucid, collectUtxo.datum!)
        console.log(params)

        const job = this.getTreasury(treasuries, Data.to(this.treasuryDatum))!
        console.log(job)
        const listing = this.getTreasury(treasuries, params.listing)!
        const market = this.getTreasury(treasuries, marketTreasury!)!

        const provision = 0.025 * Number(params.amount)
        const payFeesRedeemer = Data.to(new Constr(0, []))
        const buyRedeemer = Data.to(
            new Constr(0, [
                new Constr(0,
                    [BigInt(10_000),
                    Data.from(marketTreasury)
                ])
            ])
        )

        // JoB treasury
        const collectFromTreasuries = {
            [job!.datum!]: job
        }
        const payToTreasuries = {
            [job!.datum!]: provision * 0.1
        }

        // Listing marketplace
        if (listing!.datum! in collectFromTreasuries) {
            payToTreasuries[listing!.datum!] += provision * 0.4
        } else {
            collectFromTreasuries[listing?.datum!] = listing
            payToTreasuries[listing!.datum!] = provision * 0.4
        }

        // Selling marketplace
        if (market!.datum! in collectFromTreasuries) {
            payToTreasuries[market!.datum!] += provision * 0.5
        } else {
            payToTreasuries[market!.datum!] = provision * 0.5
            collectFromTreasuries[market!.datum!] = market
        }


        let buildTx = this.lucid
            .newTx()
            .collectFrom(
                Object.values(collectFromTreasuries),
                payFeesRedeemer
            )
            .collectFrom(
                [
                    collectUtxo
                ],
                buyRedeemer
            )
            .attachSpendingValidator(this.treasuryScript)
            .attachSpendingValidator(this.instantBuyScript)

        for (let treasury of Object.values(collectFromTreasuries)) {
            buildTx = buildTx.payToContract(
                treasury.address,
                { inline: treasury.datum! },
                { lovelace: BigInt(treasury.assets.lovelace) + BigInt(payToTreasuries[treasury.datum!]) }
            )
        }


        buildTx = buildTx.payToAddress(
            params.beneficier,
            { lovelace: params.amount + collectUtxo.assets.lovelace }
        )
            .addSigner(await lucid.wallet.address())

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
);
lucid.selectWalletFromPrivateKey(privKey)



const job = new JamOnBreadAdminV1(lucid, "74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a", "556e69717565")
const unit = "eb029a3fc7fcb011f047011189eb0845b06c5b3d11506ee1dc659cea" + "4d794e4654"
//console.log(await job.getTreasuries())
// console.log(await job.instantbuyList(unit, 10_000_000n, "d87a9fd8799f581c74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a01ffff"))

/*
console.log(await job.instantBuyCancel({
    txHash: "398620dd121fd5021b44a39ffbc9eae6d10be178a3407033fe5268dc8445e0c8",
    outputIndex: 0
}))
*/


console.log(await job.instantBuyProceed(
    {
        txHash: "6e5ba4fc057c938dcd195fdf711d6d9999cb56cee7f01ac2930d8183641038f4",
        outputIndex: 0
    }
))


console.log(job.getTreasuryAddress(0))