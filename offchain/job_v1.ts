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
    }

    public createJobToken(): PolicyId {
        return encodeTreasuryDatumTokens(this.jamTokenPolicy, JamOnBreadAdminV1.numberOfToken)
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

    getTreasuryAddress(stake: number): string {
        const paymentCredential = {
            type: "Script",
            hash: lucid.utils.validatorToScriptHash(this.treasuryScript)
        } as Credential

        const stakeCredential = {
            type: "Script",
            hash: this.jamStakes[stake]
        } as Credential


        console.log(paymentCredential, stakeCredential)

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

    getInstantBuyAddress(): string {
        const stakeId = Math.floor(Math.random() * this.jamStakes.length)

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
        console.log(address)
        return await this.lucid.utxosAt(address)
    }

    getTreasury(treasuries: UTxO[], datum: string): UTxO | undefined {
        const index = treasuries.findIndex((value: UTxO) => value.datum == datum)

        if (index > -1) {
            const element = treasuries[index]
            treasuries.splice(index, 1)
            return element
        }
        return undefined
    }

    parseInstantbuyDatum(lucid: Lucid, datumString: string): InstantBuyDatumV1 {
        const datum: Constr<any> = Data.from(datumString)
        const amount = datum.fields[3]
        const listing = Data.to(datum.fields[1])
        const beneficier_address = datum.fields[0].fields[0].fields[0]
        const beneficier_stake = datum.fields[0].fields[1].fields[0].fields[0].fields[0]

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

    async instantBuyCancel(utxo: OutRef) {
        const cancelRedeemer = Data.to(new Constr(1, []));
        const toSpend = await this.lucid.utxosByOutRef([utxo])
        const txCancel = await this.lucid
            .newTx()
            .collectFrom(toSpend, cancelRedeemer)
            .attachSpendingValidator(this.instantBuyScript)
            .addSigner(await lucid.wallet.address())
            .complete()

        const signedTx = await txCancel
            .sign()
            .complete()

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
//console.log(await job.instantbuyList(unit, 10_000_000n, "d87a9fd8799f581c74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a01ffff"))


console.log(await job.instantBuyCancel({
    txHash: "398620dd121fd5021b44a39ffbc9eae6d10be178a3407033fe5268dc8445e0c8",
    outputIndex: 0
}))
