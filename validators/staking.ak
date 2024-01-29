use aiken/transaction.{ScriptContext}
use common/method
use common/types

validator(withdrawal_method: types.WithdrawalMethod, _number: Int) {
  fn withdrawal_v1(_redeemer: Data, context: ScriptContext) -> Bool {
    method.check_transaction_is_validated(context, withdrawal_method)
  }
}

validator(withdrawal_method: types.WithdrawalMethod) {
  fn lock_v1(_datum: Data, _redeemer: Data, context: ScriptContext) -> Bool {
    method.check_transaction_is_validated(context, withdrawal_method)
  }
}
