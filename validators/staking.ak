use aiken/transaction.{ScriptContext}
use common/check
use common/types

validator(withdrawal_method: types.WithdrawalMethod, _number: Int) {
  fn withdrawal(_redeemer: Data, context: ScriptContext) -> Bool {
    check.transaction_is_validated(context, withdrawal_method)
  }
}
