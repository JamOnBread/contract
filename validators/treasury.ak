use aiken/transaction.{ScriptContext}
use common/constant
use common/method
use common/types

validator {
  fn spend_v1(
    datum: types.WithdrawalMethod,
    _redeemer: Data,
    context: ScriptContext,
  ) -> Bool {
    let address = method.get_script_address(context)
    let validated = method.transaction_is_validated(context, datum)

    let outputs =
      method.number_outputs_address_datum(
        context.transaction.outputs,
        address,
        datum,
      )

    // Check that number of inputs is same like number of outputs
    // If transaction is validated (by credential or token) or outputs (lovelace) are bigger then inputs (lovelace)
    if validated {
      outputs.1st >= constant.minimal_number_treasuries
    } else {
      let inputs =
        method.number_inputs_address_datum(
          context.transaction.inputs,
          address,
          datum,
        )

      inputs.1st == outputs.1st && inputs.2nd < outputs.2nd
    }
  }
}
