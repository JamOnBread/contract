use aiken/transaction/credential.{Address, Credential, VerificationKeyCredential}
use aiken/transaction/value.{PolicyId}
use aiken/list.{all}
use aiken/cbor

pub type TokenValidation {
    Token{policy: PolicyId, count: Int}
}

pub type WithdrawalMethod {
  AddressWithdrawalMethod(Address)
  TokenWithdrawalMethod(TokenValidation)
}

test test_withdrawal_method_typ_compatible() {
    let datum1 = AddressWithdrawalMethod(
      Address{
        payment_credential: VerificationKeyCredential(#"9261d385ba57cddb572ee85fd6643024f275ace68d392a8b37c34d37"), 
        stake_credential: None
      }
    )
    let datum2 = TokenWithdrawalMethod(Token{policy: #"b1ecd813e9084e3592d0986c41b63197fe2eb8e8994c4269933f8363", count: 6})

  trace(cbor.diagnostic(datum1))
    and{
        // TxHash ecdf82c7230dc04c920e76e06523ce3b71635511d237aa168f8d2fdafef7af17
        cbor.diagnostic(datum1) == @"121([_ 121([_ 121([_ h'9261D385BA57CDDB572EE85FD6643024F275ACE68D392A8B37C34D37']), 122([])])])",
        
        // TxHash 5bd064d16b2bbbfcc01182671acffd4f3f5414d3b6679498f257137ff353fe79
        cbor.diagnostic(datum2) == @"122([_ 121([_ h'B1ECD813E9084E3592D0986C41B63197FE2EB8E8994C4269933F8363', 6])])"
    }
}