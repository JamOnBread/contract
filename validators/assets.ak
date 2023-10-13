use aiken/transaction.{Mint, OutputReference, ScriptContext, find_input}

validator(utxo: OutputReference) {
  fn mint_v1(_redeemer: Data, context: ScriptContext) -> Bool {
    // Check if we spend predefined input
    let ScriptContext { transaction, purpose } = context

    // Purpose is Mint
    expect Mint(_policy_id) = purpose

    // UTxO is present in inputs
    when find_input(transaction.inputs, utxo) is {
      Some(_input) -> True
      None -> fail @"UTxO is not present as a input"
    }
  }
}
