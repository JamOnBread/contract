validator() {
    fn always_succeed(_datum: Data, _redeemer: Data, _context: a) -> Bool {
        True
    }
}

validator() {
    fn always_fail(_datum: Data, _redeemer: Data, _context: a) -> Bool {
        False
    }
}
