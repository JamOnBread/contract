use aiken/transaction.{ScriptContext}
use common/method
use common/types

validator {
  fn spend_v1(
    datum: types.WithdrawalMethod,
    _redeemer: Data,
    context: ScriptContext,
  ) -> Bool {
    let credential = method.get_script_hash(context)
    let validated = method.transaction_is_validated(context, datum)
    let inputs =
      method.number_inputs_address_datum(
        context.transaction.inputs,
        credential,
        datum,
      )
    let outputs =
      method.number_outputs_address_datum(
        context.transaction.outputs,
        credential,
        datum,
      )

    // Check that number of inputs is same like number of outputs
    // If transaction is validated (by credential or token) or outputs (lovelace) are bigger then inputs (lovelace)
    inputs.1st == outputs.1st && ( validated || inputs.2nd < outputs.2nd )
  }
}
