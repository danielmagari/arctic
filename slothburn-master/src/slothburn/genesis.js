// Hardcoded intial blockchain
const GENESIS = {
  time: (BigInt(Date.now()) / 1000n - 25n).toString(),
  block: {
    parent: "2000000000000000000000000000000000000000000000000000000000000000",
    txs:  [],
    bans: []
  },
  account: {
    pubkey:  "7310277b1c4e222adfe527308c021b290822e97d6544edc9bfc45e158bde841a",
    balance: "3000"
  },
  carry: "0"
}

// Hardcoded initial P2P state
const SERVER = {
  STATE: {
    genesis: GENESIS,
    chain: [GENESIS.block],
    book: [{
      pubkey:  GENESIS.account.pubkey,
      balance: GENESIS.account.balance
    }],
    carry: GENESIS.carry
  },
  PEERS: [{
    ip: "68.183.198.185", // sloth1 seed
    online: "1",
    banScore: "0"
  }]
}

module.exports = SERVER
