// Makes a safely mutable copy of an immutable state
// NOTE: Blocks are immutable
const copyState = state => ({
  genesis: state.genesis,
  chain:   [...state.chain],
  book:    state.book.map(account => ({
    pubkey:  account.pubkey,
    balance: account.balance
  })),
  carry:   state.carry
})

// Rebuilds the genesis state
const genesisState = genesis => ({
  genesis: genesis,
  chain:   [genesis.block],
  book:    [{
    pubkey:  genesis.account.pubkey,
    balance: genesis.account.balance
  }],
  carry:   genesis.carry
})

// Compare two fixed-length hex strings (Can be used by Array.prototype.sort())
const compareHex = (a, b) =>
    (a === b) ?  0  // compares ascii char codes from left-to-right (same order as hex)
  : (a  <  b) ? -1
  : (a  >  b) ?  1
  : undefined

module.exports = { copyState, genesisState, compareHex }
