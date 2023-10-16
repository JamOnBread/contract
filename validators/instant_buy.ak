use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction/credential.{
  Address, Inline, Script, ScriptCredential, StakeCredential,
  VerificationKeyCredential,
}
use common/types

validator(
  treasury_script: Hash<Blake2b_224, Script>,
  stake_addresses: List<StakeCredential>,
  job: types.WithdrawalMethod,
) {
  fn spend(datum: Data, _redeemer: Data, _context: a) -> Bool {
    False
  }
}
