use aiken/transaction.{ScriptContext}
use common/constant
use common/method
use common/types

/// Set of operation with Treasury
type TreasuryRedeemer {
  Pay
  Withdraw
}

validator {
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
        method.transaction_is_validated(context, datum)? && ((outputs >= constant.minimal_number_treasuries)? || (outputs == inputs)?)?
      }
    }
  }
}
