import { Lucid, Script, Constr, Data, PolicyId, Unit, applyParamsToScript, fromText } from "https://deno.land/x/lucid@0.10.7/mod.ts"


export const plutus = await Deno.readTextFile('plutus.json').then(data => {
    const plutus = JSON.parse(data)
    console.info("Version:", plutus.preamble.version)
    return plutus
})

export function version(): string {
    return plutus.preamble.version
}

export function getValidator(title: string): any {
    for (const validator of plutus.validators) {
        if (validator.title == title) {
            return validator
        }
    }
}

export function getCompiledCode(title: string): Script {
    return {
        type: "PlutusV2",
        script: getValidator(title).compiledCode
    }
}

export function applyCodeParamas(code: Script, params: any): Script {
    return {
        type: "PlutusV2",
        script: applyParamsToScript(
            code.script,
            params
        )
    }
}

export function getCompiledCodeParams(title: string, params: any): Script {
    return applyCodeParamas(getCompiledCode(title), params)
}


export function getRewardAddress(lucid: Lucid, stake: string): string {
    return lucid.utils.credentialToRewardAddress(
        lucid.utils.scriptHashToCredential(stake)
    )
}

export function encodeAddress(
    paymentPubKeyHex: string,
    stakingPubKeyHex?: string
): Constr {
    const paymentCredential = new Constr(0, [paymentPubKeyHex])

    const stakingCredential = stakingPubKeyHex
        ? new Constr(0, [new Constr(0, [new Constr(0, [stakingPubKeyHex])])])
        : new Constr(1, [])

    return new Constr(0, [paymentCredential, stakingCredential])
}

export function encodeTreasuryDatumAddress(
    paymentPubKeyHex: string,
    stakingPubKeyHex?: string
): Constr {
    const address = encodeAddress(paymentPubKeyHex, stakingPubKeyHex)
    return new Constr(0, [address])
}

export const encodeTreasuryDatumTokens = (
    currencySymbol: string,
    minTokens: BigInt
): Constr => {
    return new Constr(1, [new Constr(0, [currencySymbol, minTokens])])
}
