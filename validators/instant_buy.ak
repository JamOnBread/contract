use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction.{ScriptContext}
use aiken/transaction/credential.{
  Address, Inline, Script, ScriptCredential, StakeCredential,
  VerificationKeyCredential,
}
use common/check
use common/types

validator(
  treasury_script: Hash<Blake2b_224, Script>,
  stake_addresses: List<StakeCredential>,
  job: types.WithdrawalMethod,
) {
  fn spend_v1(
    datum: types.InstantBuyDatum,
    redeemer: types.InstantBuyRedeemer,
    context: ScriptContext,
  ) -> Bool {
    when redeemer is {
      // When canceling listing
      types.InstantBuyRedeemerCancel ->
        when datum.seller_address.payment_credential is {
          VerificationKeyCredential(credential) ->
            check.transaction_is_signed(context, credential)
          _ -> False
        }
      types.InstantBuyRedeemerBuy(selling_marketplace_portion) -> False
    }
  }
}
