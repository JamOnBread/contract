use aiken/transaction.{ScriptContext}
use common/method
use common/types

validator(withdrawal_method: types.WithdrawalMethod, _number: Int) {
  fn withdrawal_v1(_redeemer: Data, context: ScriptContext) -> Bool {
    method.transaction_is_validated(context, withdrawal_method)
  }
}
