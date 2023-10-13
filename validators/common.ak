validator {
  fn always_succeed_v1(_datum: Data, _redeemer: Data, _context: a) -> Bool {
    True
  }
}

validator {
  fn always_fail_v1(_datum: Data, _redeemer: Data, _context: a) -> Bool {
    False
  }
}
