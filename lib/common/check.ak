use aiken/transaction
use aiken/transaction/credential.{Address, Credential, VerificationKey, VerificationKeyCredential, ScriptCredential}
use aiken/transaction/value
use aiken/hash.{Blake2b_224, Hash}
use aiken/list
use aiken/dict

use common/types
use common/constant


pub fn policy_id_of(
  values: value.Value,
  policy_id: value.PolicyId
) -> Int {
  value.tokens(values, policy_id)
  |> dict.foldr(0, fn(_, v, r) { v + r})
}

pub fn get_script_hash(context: transaction.ScriptContext) -> Credential {
    expect transaction.Spend(output_reference) = context.purpose
    expect Some(input) =
        transaction.find_input(context.transaction.inputs, output_reference)

    input.output.address.payment_credential
}

pub fn number_outputs_address_datum(outputs: List<transaction.Output>, payment_credential: Credential, datum: Data) -> (Int, Int) {        
    list.foldr(outputs, (0, 0), 
        fn(output, acc) {
            if output.address.payment_credential == payment_credential && output.datum == transaction.InlineDatum(datum) {
                let amount = value.lovelace_of(output.value)
                if amount < constant.min_ada_value {
                    error @"There is no minimal ada on Output"
                }
                else {
                    (acc.1st + 1, acc.2nd + amount)
                }
            } else {
                acc
            }
        }
    )
}

pub fn number_inputs_address_datum(inputs: List<transaction.Input>, payment_credential: Credential, datum: Data) -> (Int, Int) {
    list.foldr(inputs, (0, 0), 
        fn(input, acc) {
           if input.output.address.payment_credential == payment_credential && input.output.datum == transaction.InlineDatum(datum) {
             (acc.1st + 1, acc.2nd + value.lovelace_of(input.output.value))
           } else {
             acc
           }
        }
    )
}

pub fn transaction_is_signed(context: transaction.ScriptContext, owner: Hash<Blake2b_224, VerificationKey>) -> Bool {
    list.has(context.transaction.extra_signatories, owner)
}

pub fn inputs_contains_tokens(context: transaction.ScriptContext, policy_id: value.PolicyId, number: Int) -> Bool {
    list.foldr(context.transaction.inputs, 0, fn(input, acc) {
        acc + policy_id_of(input.output.value, policy_id)
    }) >= number
}

pub fn transaction_is_validated(context: transaction.ScriptContext, datum: types.WithdrawalMethod) -> Bool {
    when datum is {
      types.AddressWithdrawalMethod(Address{payment_credential, ..}) -> {
        when payment_credential is {
            VerificationKeyCredential(credential) ->
                transaction_is_signed(context, credential)
            _ -> False
        }
      }
      types.TokenWithdrawalMethod(token) -> {
        inputs_contains_tokens(context, token.policy, token.count)
      }
    }
}