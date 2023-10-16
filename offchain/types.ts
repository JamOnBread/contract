export type InstantBuyDatumV1 = {
    beneficier: string,
    amount: bigint,
    listing: string,
    affiliate: string | undefined,
    royalty: string | undefined,
    percent: bigint | undefined
}