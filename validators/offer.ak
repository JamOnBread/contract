use aiken/hash.{Blake2b_224, Hash}
use aiken/math.{max}
use aiken/transaction
use aiken/transaction/credential
use aiken/transaction/value
use common/constant
use common/method
use common/types

type OfferRedeemer {
  Accept(List<types.SellingMarketplaceFeePart>)
  Cancel
}

validator(
  treasury_script_hash: Hash<Blake2b_224, credential.Script>,
  stake_addresses: List<credential.StakeCredential>,
  job: types.WithdrawalMethod,
) {
  fn spend_v1(
    datum: types.OfferDatum,
    redeemer: OfferRedeemer,
    context: transaction.ScriptContext,
  ) -> Bool {
    // Purpose must be spend
    when context.purpose is {
      transaction.Spend(output_reference) -> {
        // Get transaction input
        expect Some(transaction.Input { output: input, .. }) =
          transaction.find_input(context.transaction.inputs, output_reference)

        when redeemer is {
          // When canceling listing
          Cancel ->
            when datum.offerer_address.payment_credential is {
              credential.VerificationKeyCredential(credential) ->
                method.check_transaction_is_signed(context, credential)
              _ -> False
            }
          Accept(selling_marketplace_portions) -> {
            let provision_base =
              datum.offered_price * constant.fees_basis / constant.fixed_decimals

            let provisions =
              []
                |> method.provision_add(
                     // Add JoB treasury by default
                     job,
                     max(
                       provision_base * constant.jam_on_bread_fee_portion / constant.fixed_decimals,
                       constant.minimal_job_reward,
                     ),
                   )
                |> method.provision_add(
                     // Add Listing marketplace treasury
                     datum.listing_marketplace_treasury,
                     provision_base * constant.listing_marketplace_portion / constant.fixed_decimals,
                   )
                |> method.provision_add_option(
                     // Add Listing affiliate, if exists
                     datum.listing_affiliate_treasury,
                     provision_base * constant.listing_affiliate_portion / constant.fixed_decimals,
                   )
                |> method.provision_add_portion(
                     // Add Sell marketplace treasuries
                     provision_base,
                     selling_marketplace_portions,
                   )
            // Add royalty if defined
            let (provisions, _final_price) =
              method.get_provisions_final_price(
                provisions,
                datum.offered_price,
                provision_base,
                datum.offerer_address,
                datum.royalty,
              )

            // Final checks
            (value.lovelace_of(input.value) >= datum.offered_price + constant.min_ada_value)? && (datum.offered_price > constant.minimal_contract_price)? && method.check_portions(
              selling_marketplace_portions,
              0,
            ) && method.check_all_provisions(
              provisions,
              context.transaction,
              treasury_script_hash,
              stake_addresses,
            )? && method.check_required_payment(
              context.transaction.outputs,
              datum.offerer_address,
              datum.wanted_asset,
              constant.min_ada_value,
            )? && method.check_input_scripts(
              context.transaction.inputs,
              credential.ScriptCredential(treasury_script_hash),
              output_reference,
            )
          }
        }
      }
      _other_purpose -> False
    }
  }
}
