use aiken/hash.{Blake2b_224, Hash}
use aiken/list
use aiken/transaction.{ScriptContext}
use aiken/transaction/credential.{VerificationKey}

use common/types


type Redeemer {
  msg: ByteArray,
}

validator() {
  fn treasury_validator(datum: types.WithdrawalMethod, redeemer: _, context: ScriptContext) -> Bool {
    when datum is {
      types.AddressWithdrawalMethod(address) -> {
        todo @"address"
      }
      types.TokenWithdrawalMethod(token) -> {
        todo @"address"
      }
    }
  }
}