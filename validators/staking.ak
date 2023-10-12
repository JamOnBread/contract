use aiken/transaction.{ScriptContext}
use common/types
use common/check

validator(withdrawal_method: types.WithdrawalMethod, _number: Int) {
    fn withdrawal(redeemer: _, context: ScriptContext) -> Bool {
        check.transaction_is_validated(context, withdrawal_method)
    }
}