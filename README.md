# Jam on Bread contract
NFT marketplace, which allows you to buy and sell Cardano-based NFTs.

## Design
* Market with Cardano assets (NFTs)
* Offer participation on the market to 3rd parties
* Offer to use contract in own market
* There is a fixed fee of 2.5% that is distributed between all parties, that participated in successful trade
* Is possible to make a profit from user's treasuries by staking
* **All datums should be compatible with original the contract designed by Vacuumlabs (verified by Cbor serialization)**

## Fees and royalty calculation
* 10% to JoB
* 20% listing marketplace
* 20% listing affiliate (can be same as a marketplace)
* 50% to selling marketplace, which can be divided into many records (affiliates)

* Royalty

**The calculation for price 100 ADA, and a typical set of treasuries and 5% royalty:**
* 92.5 ADA to the seller (100 - 2.5 (fees) - 5 (5% royalty) )
* 0.25 ADA to JoB treasury (100 * 0.25 * 0.1)
* 0.5 ADA to listing marketplace treasury(100 * 0.025 * 0.2)
* 0.5 ADA to listing affiliate treasury (100 * 0.025 * 0.2)
* 0.625 ADA to selling marketplace treasury (100 * 0.25 * 0.25)
* 0.625 ADA to selling affiliate treasury (100 * 0.25 * 0.25)
* 5 ADA to royalty treasury (100 * 0.05)

## Major changes
* There are no more script params
* It is not necessary to mint values
* There is an option to produce treasury during a transaction
* There is an option to consume treasury
* Logic is divided between Treasury the contract and function contracts (InstantBuy/Offer)

### Mint
Simple contract, that checks argument [OutputReference](https://aiken-lang.github.io/stdlib/aiken/transaction.html#OutputReference) is present on inputs.
The purpose is only for minting disposable assets (for treasury validation method)

### Staking
A simple contract that is validated same as the Withdrawal method, which is passed as an argument.
The second argument is just salt for [PolicyId](https://aiken-lang.github.io/stdlib/aiken/transaction/value.html#PolicyId)
It is a stake address that can be withdrawn by the wallet/token holder

### Treasury
Common contract where user can collect ADA value during manipulation with a market.
There are two purposes:
* Use the treasury in transaction
* Withdraw treasury

The contract holds information about the withdrawal method in [datum](https://jamonbread.github.io/contract/common/types.html#WantedAsset)

#### Usage in transaction
Typical usage of the treasury is, that the original UTxO is spending during the transaction and a new one is created on output. The diff between output and input is provision.

* Check, that the count of UTxOs with the same script hash and datum like spending UTxO is equal to one (there is no need to spend more than one)
* Check, that the count of UTxOs with the same address (payment credential and spending credential) is equal to One (it is not possible to burn it or change stake address)
* Check, that the output ADA on UTxO is bigger than the input ADA
* Check, that the output values of ADA are bigger than the defined minimal value
* ~~Check, that treasury UTxOs do not contain another asset except ADA~~


#### Usage during withdrawal
There are two validation mechanisms, depending on the type of treasury:

* by payment credential 
* by validation token

* Check, that the validation mechanism is valid
* Check outputs UTxOs, ~~that only ADA is present~~ and is bigger than a minimal value
* The number of the same treasury (credential, datum, stake) is present on the input and output
* The number of output treasury (credential, datum, stake) can be reduced to 5 (another can be spent without creating new ones)

**Question:**
* Is necessary to check the stake address during the withdrawal operation? (Can be a significant treasury owner a bad guy? It is a problem to squash treasury with different stake addresses)

### Instant buy
Contract for buying NFTs

There are two purposes:
* Accept
* Cancel

The validator has a params:

```
validator(
  treasury_script_hash: Hash<Blake2b_224, credential.Script>, // Reference to treasury validator
  stake_addresses: List<credential.StakeCredential>,          // List of accepted JoB stake address
  job: types.WithdrawalMethod,                                // JoB treasury, what is present in each transaction
)
```

Information about price, royalty etc., are stored in [datum](https://jamonbread.github.io/contract/common/types.html#InstantBuyDatum)

#### Accept
* Check, that the ADA sent to a user is correct
* Check, that all provisions are correct
* Check, that asset_price is bigger than a minimal value
* ~~Check, that the basis of royalty is lower than the minimal value~~
* Check, that portions defined in the redeemer are correct
* If the royalty (payment credential) is the same as the seller's address, the royalty is not paid to a treasury, but directly to the seller's address

#### Cancel
The transaction is signed by stored payment credentials
There is no other check for the spending contract

#### Improvements
* Store selling Unit to datum and check, that Unit is present in UTxO (easy to parse, but there is a problem with CIP68)

### Offer
Is very similar to instant buying instead of a final check to pay assets/ADA to the offerer's address.

Information about price, royalty etc., are stored in [datum](https://jamonbread.github.io/contract/common/types.html#OfferDatum)

### Possible vectors of attack

#### Treasury blocking - Low-impact

Attackers can block happy path usage of the contract by using treasury outside of the contract. It is a problem, because a user cannot use predefined treasuries, what is unaccessible

* There is no problem to spawn more treasury to prevent attack (it is possible to block only one treasury in one transaction)
* There is an option to create the treasury during the transaction. A user can withdraw locked ADA by squashing treasuries during withdrawal
* It is problematic only for NFT with low value (NFT is more expansive than expected)


### UnImplemented - Treasury flooding with useless assets
Attackers can send to the treasury many Assets to increase memory consumption and block successful transactions because the memory limit

* Prevent sending Assets to treasury during manipulation (spend/withdraw)
* Do not list free treasury with another asset in an internal database

### UnImplemented - Treasury with datum by hash
Attacker can create treasuries with datum, that is not Inline or with less ADA than is allowed, this treasury SHOULD NOT be listed


## Building

A standard build is very simple by command:

```sh
aiken build
```

or if you want to keep traces:
```sh
aiken build -k
```
## Testing

You can write tests in any module using the `test` keyword. For example:

```gleam
test foo() {
  1 + 1 == 2
}
```

To run all tests, simply do:

```sh
aiken check
```

To run only tests matching the string `foo`, do:

```sh
aiken check -m foo
```

## Documentation

If you're writing a library, you might want to generate HTML documentation for it.

Use:

```sh
aiken docs
```

## Resources

Find more on [Aiken's user manual](https://aiken-lang.org).
