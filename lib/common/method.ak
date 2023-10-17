use aiken/cbor
use aiken/dict
use aiken/hash.{Blake2b_224, Hash}
use aiken/list
use aiken/transaction
use aiken/transaction/credential.{
  Address, Credential, Inline, ScriptCredential, VerificationKey,
  VerificationKeyCredential,
}
use aiken/transaction/value
use common/constant
use common/types

pub fn policy_id_of(values: value.Value, policy_id: value.PolicyId) -> Int {
  value.tokens(values, policy_id)
    |> dict.foldr(0, fn(_, v, r) { v + r })
}

pub fn get_script_hash(context: transaction.ScriptContext) -> Credential {
  expect transaction.Spend(output_reference) = context.purpose
  expect Some(input) =
    transaction.find_input(context.transaction.inputs, output_reference)

  input.output.address.payment_credential
}

pub fn number_outputs_address_datum(
  outputs: List<transaction.Output>,
  payment_credential: Credential,
  datum: Data,
) -> (Int, Int) {
  list.foldr(
    outputs,
    (0, 0),
    fn(output, acc) {
      if
      output.address.payment_credential == payment_credential && output.datum == transaction.InlineDatum(
        datum,
      ){
      
        let amount = value.lovelace_of(output.value)
        if amount < constant.min_ada_value {
          fail @"There is no minimal ada on Output"
        } else {
          (acc.1st + 1, acc.2nd + amount)
        }
      } else {
        acc
      }
    },
  )
}

pub fn number_inputs_address_datum(
  inputs: List<transaction.Input>,
  payment_credential: Credential,
  datum: Data,
) -> (Int, Int) {
  list.foldr(
    inputs,
    (0, 0),
    fn(input, acc) {
      if
      input.output.address.payment_credential == payment_credential && input.output.datum == transaction.InlineDatum(
        datum,
      ){
      
        (acc.1st + 1, acc.2nd + value.lovelace_of(input.output.value))
      } else {
        acc
      }
    },
  )
}

pub fn transaction_is_signed(
  context: transaction.ScriptContext,
  owner: Hash<Blake2b_224, VerificationKey>,
) -> Bool {
  list.has(context.transaction.extra_signatories, owner)
}

/// Check, if required amount of asset are present in transaction inputs
pub fn inputs_contains_tokens(
  context: transaction.ScriptContext,
  policy_id: value.PolicyId,
  number: Int,
) -> Bool {
  list.foldr(
    context.transaction.inputs,
    0,
    fn(input, acc) { acc + policy_id_of(input.output.value, policy_id) },
  ) >= number
}

/// Check, if trasnsaction is validated by user
/// There is two kinds of validation:
/// 1. Payment credential
/// 2. With number of assets with correct PolicyId
pub fn transaction_is_validated(
  context: transaction.ScriptContext,
  datum: types.WithdrawalMethod,
) -> Bool {
  when datum is {
    types.AddressWithdrawalMethod(Address { payment_credential, .. }) ->
      when payment_credential is {
        VerificationKeyCredential(credential) ->
          transaction_is_signed(context, credential)
        _ -> False
      }
    types.TokenWithdrawalMethod(token) ->
      inputs_contains_tokens(context, token.policy, token.count)
  }
}

pub fn get_treasury_input_value(
  inputs: List<transaction.Input>,
  script_hash: Hash<Blake2b_224, credential.Script>,
  stake_addresses: List<credential.StakeCredential>,
  datum: Data,
) -> Int {
  expect Some(input) =
    list.find(
      inputs,
      fn(i) {
        check_treasury_address(i.output.address, script_hash, stake_addresses) && i.output.datum == transaction.InlineDatum(
          datum,
        )
      },
    )

  value.lovelace_of(input.output.value)
}

pub fn get_treasury_output_value(
  outputs: List<transaction.Output>,
  script_hash: Hash<Blake2b_224, credential.Script>,
  stake_addresses: List<credential.StakeCredential>,
  datum: types.WithdrawalMethod,
) -> Int {
  expect Some(output) =
    list.find(
      outputs,
      fn(o) {
        check_treasury_address(o.address, script_hash, stake_addresses) && o.datum == transaction.InlineDatum(
          datum,
        )
      },
    )
  value.lovelace_of(output.value)
}

pub fn check_treasury_address(
  address: Address,
  treasury_script_hash: Hash<Blake2b_224, credential.Script>,
  stake_addresses: List<credential.StakeCredential>,
) {
  address.payment_credential == ScriptCredential(treasury_script_hash) && list.any(
    stake_addresses,
    fn(stake) { address.stake_credential == Some(stake) },
  )
}

pub fn test_check_treasury_address_1() {
  let raw_address = "payment_credential"
  let raw_stake_1 = "stake_credential_1"
  let raw_stake_2 = "stake_credential_2"
  let raw_stake_3 = "stake_credential_3"

  let address =
    Address {
      payment_credential: ScriptCredential(raw_address),
      stake_credential: Some(Inline(ScriptCredential(raw_stake_1))),
    }

  check_treasury_address(
    address,
    raw_address,
    list.map(
      [raw_stake_1, raw_stake_2, raw_stake_3],
      fn(stake) { Inline(ScriptCredential(stake)) },
    ),
  )
}

type Provision =
  (types.WithdrawalMethod, Int)

pub fn check_all_provisions(
  provisions: List<Provision>,
  transaction: transaction.Transaction,
  treasury_script_hash: Hash<Blake2b_224, credential.Script>,
  stake_addresses: List<credential.StakeCredential>,
) -> Bool {
  list.all(
    provisions,
    fn(provision) {
      get_treasury_output_value(
        transaction.outputs,
        treasury_script_hash,
        stake_addresses,
        provision.1st,
      ) - get_treasury_input_value(
        transaction.inputs,
        treasury_script_hash,
        stake_addresses,
        provision.1st,
      ) >= provision.2nd
    },
  )
}

pub fn check_required_paymnet(
  outputs: List<transaction.Output>,
  address: credential.Address,
  policy_id: value.PolicyId,
  asset_name: value.AssetName,
  amount: Int,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      if output.address == address {
        value.quantity_of(output.value, policy_id, asset_name) > amount
      } else {
        False
      }
    },
  )
}

pub fn provision_add(
  self: List<Provision>,
  treasury: types.WithdrawalMethod,
  amount: Int,
) -> List<(types.WithdrawalMethod, Int)> {
  when self is {
    [] ->
      [(treasury, amount)]
    [x, ..xs] ->
      if x.1st == treasury {
        [(treasury, x.2nd + amount), ..xs]
      } else {
        [x, ..provision_add(xs, treasury, amount)]
      }
  }
}

pub fn provision_add_portion(
  self: List<(types.WithdrawalMethod, Int)>,
  provision_base: Int,
  portions: List<types.SellingMarketplaceFeePart>,
) -> List<(types.WithdrawalMethod, Int)> {
  when portions is {
    [] -> self
    [x, ..xs] ->
      provision_add_portion(
        provision_add(
          self,
          x.treasury,
          provision_base * x.portion / constant.fixed_decimals,
        ),
        provision_base,
        xs,
      )
  }
}

pub fn provision_sum(self: List<(types.WithdrawalMethod, Int)>) -> Int {
  list.foldr(self, 0, fn(n, total) { total + n.2nd })
}

test test_procision_add_portions() {
  let provision_base = 100_000
  let treasury_1 =
    types.TokenWithdrawalMethod(types.Token { policy: "withdrawal1", count: 6 })

  let treasury_2 =
    types.TokenWithdrawalMethod(types.Token { policy: "withdrawal2", count: 6 })

  let portions_1 =
    [types.SellingMarketplaceFeePart { portion: 1_000, treasury: treasury_1 }]

  let portions_2 =
    [
      types.SellingMarketplaceFeePart { portion: 2_000, treasury: treasury_2 },
      ..portions_1
    ]

  let portions_3 =
    [
      types.SellingMarketplaceFeePart { portion: 2_000, treasury: treasury_1 },
      ..portions_2
    ]

  let provisions = provision_add_portion([], provision_base, portions_3)

  trace cbor.diagnostic(provisions)

  (provision_sum(provisions) <= provision_base * constant.selling_marketplace_portion / constant.fixed_decimals)?
}

test test_provision_add() {
  let job =
    types.TokenWithdrawalMethod(types.Token { policy: "withdrawal1", count: 6 })
  let affiliate1 =
    types.TokenWithdrawalMethod(types.Token { policy: "affiliate1", count: 6 })

  let affiliate2 =
    types.TokenWithdrawalMethod(types.Token { policy: "affiliate2", count: 6 })
  let royalty =
    types.AddressWithdrawalMethod(
      Address {
        payment_credential: VerificationKeyCredential(
          #"9261d385ba57cddb572ee85fd6643024f275ace68d392a8b37c34d37",
        ),
        stake_credential: None,
      },
    )

  let provisions =
    []
      |> provision_add(job, 1_000)
      |> provision_add(affiliate1, 4_000)
      |> provision_add(job, 5_000)
      |> provision_add(royalty, 10_000)
      |> provision_add(job, 5_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)
      |> provision_add(affiliate2, 4_000)

  let provision2 = list.unique(provisions)
  trace cbor.diagnostic(provisions)

  provision2 == provisions
}

pub fn check_portions(
  portions: List<types.SellingMarketplaceFeePart>,
  sum: Int,
) -> Bool {
  when portions is {
    [] -> True
    [x] -> (sum + x.portion <= constant.selling_marketplace_portion)?
    [x, ..xs] -> check_portions(xs, sum + x.portion)
  }
}

test test_check_portions() {
  let treasury =
    types.TokenWithdrawalMethod(types.Token { policy: "withdrawal1", count: 6 })
  let portions_1 =
    [types.SellingMarketplaceFeePart { portion: 1_000, treasury }]

  let portions_2 =
    [types.SellingMarketplaceFeePart { portion: 2_000, treasury }, ..portions_1]

  let portions_3 =
    [types.SellingMarketplaceFeePart { portion: 2_000, treasury }, ..portions_2]

  let portions_4 =
    [types.SellingMarketplaceFeePart { portion: 1_000, treasury }, ..portions_3]

  check_portions(portions_1, 0)? && check_portions(portions_2, 0)? && check_portions(
    portions_3,
    0,
  )? && !check_portions(portions_4, 0)?
}
