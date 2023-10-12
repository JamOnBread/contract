use aiken/transaction.{OutputReference, ScriptContext, Mint, find_input}


validator(utxo: OutputReference) {

    fn mint(_redeemer: Data, context: ScriptContext) -> Bool {

        // Check if we spend predefined input
        let ScriptContext { transaction, purpose } = context

        // Purpose is Mint
        expect Mint(_policy_id) = purpose

        // UTxO is present in inputs
        when find_input(transaction.inputs, utxo) is {
            Some(_input) -> True
            None -> error @"UTxO is not present as a input"
        }
        
    }
}
