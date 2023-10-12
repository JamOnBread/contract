use aiken/hash.{Blake2b_224, Hash}
use aiken/list
use aiken/transaction.{ScriptContext}
use aiken/transaction/credential.{VerificationKey}
use common/check
use common/types

validator {
  fn spending(
    datum: types.WithdrawalMethod,
    _redeemer: Data,
    context: ScriptContext,
  ) -> Bool {
    let credential = check.get_script_hash(context)
    let validated = check.transaction_is_validated(context, datum)
    let inputs =
      check.number_inputs_address_datum(
        context.transaction.inputs,
        credential,
        datum,
      )
    let outputs =
      check.number_outputs_address_datum(
        context.transaction.outputs,
        credential,
        datum,
      )

    // Check that number of inputs is same like number of outputs
    // If transaction is validated (by credential or token) or outputs (lovelace) are bigger then inputs (lovelace)
    inputs.1st == outputs.1st && ( validated || inputs.2nd < outputs.2nd )
  }
}
