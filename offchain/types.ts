
export type Portion = {
    percent: number,
    treasury: string,
}

export type InstantBuyDatumV1 = {
    beneficier: string,
    listingMarketDatum: string,
    listingAffiliateDatum: string,
    amount: bigint,
    royalty: Portion | undefined
}