//use aiken/cbor
use aiken/hash.{Blake2b_224, Hash}
use aiken/option
use aiken/transaction
use aiken/transaction/credential
use aiken/transaction/value
use common/constant
use common/method
use common/types

validator(
  treasury_script_hash: Hash<Blake2b_224, credential.Script>,
  stake_addresses: List<credential.StakeCredential>,
  job: types.WithdrawalMethod,
) {
  fn spend_v1(
    datum: types.InstantBuyDatum,
    redeemer: types.InstantBuyRedeemer,
    context: transaction.ScriptContext,
  ) -> Bool {
    when redeemer is {
      // When canceling listing
      types.InstantBuyRedeemerCancel ->
        when datum.seller_address.payment_credential is {
          credential.VerificationKeyCredential(credential) ->
            method.transaction_is_signed(context, credential)
          _ -> False
        }
      types.InstantBuyRedeemerBuy(selling_marketplace) -> {
        let provision_base =
          datum.asset_price * constant.fees_basis / constant.fixed_decimals

        let provisions =
          []
            |> method.provision_add(
                 // Add JoB treasury by default
                 job,
                 provision_base * constant.jam_on_bread_fee_portion / constant.fixed_decimals,
               )
            |> method.provision_add(
                 // Add Listing marketplace treasury
                 datum.listing_marketplace_treasury,
                 provision_base * constant.listing_marketplace_portion / constant.fixed_decimals,
               )
            |> method.provision_add(
                 // Add Listing affiliate or listing market place treasury
                 option.or_else(
                   datum.listing_affiliate_treasury,
                   datum.listing_marketplace_treasury,
                 ),
                 provision_base * constant.listing_affiliate_portion / constant.fixed_decimals,
               )
            |> method.provision_add(
                 // Add sell marketplace treasury
                 selling_marketplace.treasury,
                 provision_base * (
                   selling_marketplace.portion * constant.selling_marketplace_portion / constant.fixed_decimals
                 ) / constant.fixed_decimals,
               )

        // Add royalty if defined
        let (provisions, final_price) =
          when datum.royalty is {
            Some(royalty) -> {
              let provision =
                datum.asset_price * royalty.portion / constant.fixed_decimals

              when royalty.treasury is {
                types.AddressWithdrawalMethod(credential.Address(
                  payment_credential,
                  ..,
                )) ->
                  if
                  payment_credential == datum.seller_address.payment_credential{
                  
                    (provisions, datum.asset_price)
                  } else {
                    (
                      method.provision_add(
                        provisions,
                        royalty.treasury,
                        provision,
                      ),
                      datum.asset_price - provision,
                    )
                  }
                _other ->
                  (
                    method.provision_add(
                      provisions,
                      royalty.treasury,
                      provision,
                    ),
                    datum.asset_price - provision,
                  )
              }
            }
            None -> (provisions, datum.asset_price)
          }

        (datum.asset_price > 0)? && selling_marketplace.portion <= constant.fixed_decimals && method.check_all_provisions(
          provisions,
          context.transaction,
          treasury_script_hash,
          stake_addresses,
        )? && method.check_required_paymnet(
          context.transaction.outputs,
          datum.seller_address,
          value.ada_policy_id,
          value.ada_asset_name,
          final_price,
        )?
      }
    }
  }
}

test test__multiply_rounding() {
  let provision =
    100_000_000_000_000_000_000_000_000 * 10_000 * constant.selling_marketplace_portion / (
      constant.fixed_decimals * constant.fixed_decimals
    )

  provision == 50_000_000_000_000_000_000_000_000
}
///  let provisions = 
///    dict.new()
///    // Add JoB provision
///    |> dict.insert_with(
///        key: cbor.serialise(job), 
///        value: (job, provision_base * constant.jam_on_bread_fee_portion / constant.fixed_decimals), 
///        with: sum, 
///        compare: bytearray.compare
///    )
///    // Add Listing market treasury
///    |> dict.insert_with(
///        key: cbor.serialise(job), 
///        value: (job, provision_base * constant.jam_on_bread_fee_portion / constant.fixed_decimals), 
///        with: sum, 
///        compare: bytearray.compare
///    )
///    // Add Listing market affiliate
///
///    // Add Selling market treasury
///
///    // Add Selling market affiliate
///
///    // Add Selling market affiliate 2
///
///    // Add Royalty
