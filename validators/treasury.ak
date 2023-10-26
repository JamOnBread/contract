use aiken/transaction.{ScriptContext}
use aiken/transaction/value.{PolicyId}
use common/constant
use common/method
use common/types

/// Set of operation with Treasury
type TreasuryRedeemer {
  Pay
  Withdraw
  WithdrawAdmin
}

validator(admin_policy_id: PolicyId) {
  fn spend_v1(
    datum: types.WithdrawalMethod,
    redeemer: TreasuryRedeemer,
    context: ScriptContext,
  ) -> Bool {
    let address = method.get_script_address(context)

    when redeemer is {
      // Treasury is consumed without autorization
      Pay -> {
        // Get number of inputs with current script (payment credential and datum) and calculate sum of ada
        let inputs =
          method.get_number_inputs_ada_by_credential_datum(
            context.transaction.inputs,
            address.payment_credential,
            datum,
          )
        // Get number of outputs with current script (whole address and datum) and calculate sum of ada
        let outputs =
          method.get_number_outputs_ada_by_address_datum(
            context.transaction.outputs,
            address,
            datum,
          )
        // Treasury must be present only once as a input (to avoid treasury consumption),
        // but there is option to produce more then one treasury with same datum
        // (it is not problem, we can reduce number of treasuries by withdrawal method)
        (inputs.1st == 1)? && (outputs.1st == 1)? && (inputs.2nd < outputs.2nd)?
      }
      // Treasury is in withdrawal mode
      Withdraw -> {
        let inputs =
          method.get_number_inputs_by_address_datum(
            context.transaction.inputs,
            address,
            datum,
          )
        let outputs =
          method.get_number_outputs_by_address_datum(
            context.transaction.outputs,
            address,
            datum,
          )

        // If the transaction is autorized, we can withraw same number of treasuries like output, or we can reduce it to minimal number
        method.check_transaction_is_validated(context, datum)? && ((outputs >= constant.minimal_number_treasuries)? || (outputs == inputs)?)?
      }
      WithdrawAdmin ->
        when datum is {
          types.AddressWithdrawalMethod(withdraw_address) -> {
            let inputs =
              method.get_number_inputs_ada_by_credential_datum(
                context.transaction.inputs,
                address.payment_credential,
                datum,
              )
            let outputs =
              method.get_number_outputs_ada_by_address_datum(
                context.transaction.outputs,
                address,
                datum,
              )

            // Owner of admin tokens can withdraw ADA from treasury instead of user (ADA will be sent to registered address)
            method.check_inputs_contains_tokens(context, admin_policy_id, 1)? && method.check_required_ada(
              context.transaction.outputs,
              withdraw_address,
              inputs.2nd - outputs.2nd,
            ) && ((outputs.1st >= constant.minimal_number_treasuries)? || (outputs.1st == inputs.1st)?)?
          }
          _other -> False
        }
    }
  }
}
