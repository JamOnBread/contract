use aiken/cbor
use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction/credential.{
  Address, Inline, Script, ScriptCredential, StakeCredential,
  VerificationKeyCredential,
}
use aiken/transaction/value.{PolicyId}

pub type TokenValidation {
  Token { policy: PolicyId, count: Int }
}

pub type WithdrawalMethod {
  AddressWithdrawalMethod(Address)
  TokenWithdrawalMethod(TokenValidation)
}

test test_withdrawal_method_typ_compatible() {
  let datum1 =
    AddressWithdrawalMethod(
      Address {
        payment_credential: VerificationKeyCredential(
          #"9261d385ba57cddb572ee85fd6643024f275ace68d392a8b37c34d37",
        ),
        stake_credential: None,
      },
    )
  let datum2 =
    TokenWithdrawalMethod(
      Token {
        policy: #"b1ecd813e9084e3592d0986c41b63197fe2eb8e8994c4269933f8363",
        count: 6,
      },
    )

  trace cbor.diagnostic(datum1)
  and {
    // TxHash ecdf82c7230dc04c920e76e06523ce3b71635511d237aa168f8d2fdafef7af17
    cbor.diagnostic(datum1) == @"121([_ 121([_ 121([_ h'9261D385BA57CDDB572EE85FD6643024F275ACE68D392A8B37C34D37']), 122([])])])",
    // TxHash 5bd064d16b2bbbfcc01182671acffd4f3f5414d3b6679498f257137ff353fe79
    cbor.diagnostic(datum2) == @"122([_ 121([_ h'B1ECD813E9084E3592D0986C41B63197FE2EB8E8994C4269933F8363', 6])])",
  }
}

pub type ProtocolParams {
  instant_buy_validator_hash: Hash<Blake2b_224, Script>,
  instant_buy_currency_symbol: PolicyId,
  offer_calidator_hash: Hash<Blake2b_224, Script>,
  accept_offer_currency_symbol: PolicyId,
  treasury_validator_hash: Hash<Blake2b_224, Script>,
  withdraw_fees_currency_symbol: PolicyId,
  jam_on_bread_treasury: WithdrawalMethod,
  jam_staking_credentials: List<StakeCredential>,
}

test test_protocol_parametres() {
  let protocol_parametres =
    ProtocolParams {
      instant_buy_validator_hash: #"5538eab65a2b3a38f3e159d0ee14aa68510e5a06a422385abd6f6001",
      instant_buy_currency_symbol: #"f6043416180a15721ff8f8daf830695cc7d98868725a6c5ca9743bc2",
      offer_calidator_hash: #"0c2fbeb2aef0c26b09c7536e1fa8486ea8d691553b39288dfcfa1d74",
      accept_offer_currency_symbol: #"509be16ac79ad9c92c2615c349d14ab6ae108fc78481f4e5066c9d7b",
      treasury_validator_hash: #"567aa15400d9d693fdc00ab731f5f4763ade20f145bf1d3cf2d6d05e",
      withdraw_fees_currency_symbol: #"b975a67e713d337f0b2cea1a5079f13a411730e2b8c20b9b5561292a",
      jam_on_bread_treasury: TokenWithdrawalMethod(
        Token {
          policy: #"b1ecd813e9084e3592d0986c41b63197fe2eb8e8994c4269933f8363",
          count: 6,
        },
      ),
      jam_staking_credentials: [
        Inline(
          ScriptCredential(
            #"fd865714e87374670bd34b8536536c9971fa568d2a0ac923d330d70b",
          ),
        ),
        Inline(
          ScriptCredential(
            #"65333c4f945b59975ac9e9a96c5085d7ed1eb76209ea7da63419d099",
          ),
        ),
        Inline(
          ScriptCredential(
            #"58da875b0cc9a2edc10be2dd1c589d23a3a315860af272413ccf0563",
          ),
        ),
      ],
    }

  cbor.diagnostic(protocol_parametres) == @"121([_ h'5538EAB65A2B3A38F3E159D0EE14AA68510E5A06A422385ABD6F6001', h'F6043416180A15721FF8F8DAF830695CC7D98868725A6C5CA9743BC2', h'0C2FBEB2AEF0C26B09C7536E1FA8486EA8D691553B39288DFCFA1D74', h'509BE16AC79AD9C92C2615C349D14AB6AE108FC78481F4E5066C9D7B', h'567AA15400D9D693FDC00AB731F5F4763ADE20F145BF1D3CF2D6D05E', h'B975A67E713D337F0B2CEA1A5079F13A411730E2B8C20B9B5561292A', 122([_ 121([_ h'B1ECD813E9084E3592D0986C41B63197FE2EB8E8994C4269933F8363', 6])]), [_ 121([_ 122([_ h'FD865714E87374670BD34B8536536C9971FA568D2A0AC923D330D70B'])]), 121([_ 122([_ h'65333C4F945B59975AC9E9A96C5085D7ED1EB76209EA7DA63419D099'])]), 121([_ 122([_ h'58DA875B0CC9A2EDC10BE2DD1C589D23A3A315860AF272413CCF0563'])])]])"
}

pub type SellingMarketplaceFeePart {
  portion: Int,
  treasury: WithdrawalMethod,
}

pub type Royalty {
  basis: Int,
  treasury: WithdrawalMethod,
}

pub type InstantBuyRedeemer {
  InstantBuyRedeemerBuy(List<SellingMarketplaceFeePart>)
  InstantBuyRedeemerCancel
}

pub type InstantBuyDatum {
  seller_address: Address,
  listing_marketplace_treasury: WithdrawalMethod,
  listing_affiliate_treasury: Option<WithdrawalMethod>,
  asset_price: Int,
  royalty: Option<Royalty>,
}

test test_instant_buy_datum() {
  let datum =
    InstantBuyDatum {
      seller_address: Address {
        payment_credential: VerificationKeyCredential(
          #"bd72b8c93f8d9b995c3381936fbc5166ba44bae685c5664fb22c401c",
        ),
        stake_credential: None,
      },
      listing_marketplace_treasury: TokenWithdrawalMethod(
        Token {
          policy: #"74ce41370dd9103615c8399c51f47ecee980467ecbfcfbec5b59d09a",
          count: 1,
        },
      ),
      listing_affiliate_treasury: None,
      asset_price: 10_000_000,
      royalty: None,
    }

  cbor.diagnostic(datum) == @"121([_ 121([_ 121([_ h'BD72B8C93F8D9B995C3381936FBC5166BA44BAE685C5664FB22C401C']), 122([])]), 122([_ 121([_ h'74CE41370DD9103615C8399C51F47ECEE980467ECBFCFBEC5B59D09A', 1])]), 122([]), 10000000, 122([])])"
}
