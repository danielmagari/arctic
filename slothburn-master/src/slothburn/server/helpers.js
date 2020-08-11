/*
====================================================================================================
BLOCK IDS

  Mergable block ID considerations
  ================================

  For the chain tip block, we want to be able to merge all tip candidates (siblings) into one.

  We also want it to end up with the same txs, banned pubkeys,
  and hence ID, no matter what order they were merged.

  If we allowed transactions to depend on other ones in the same block, then
  someone getting themselves banned could also get their receivers' accounts banned unless
  we use complicated rules and transaction ordering. What if Alice sends Bob 100 coins, then
  Bob sends Charles his entire balance, then Alice makes a conflicting tx and gets banned?
  Bob won't have had a sufficient balance to send all of his txs anymore.

  Therefore, we only allow accounts to send 1 tx per block, and don't update their
  balance until after the block is added. If someone tries to send 2 txs, they get
  put into a banlist entry.

  If we treated txs and banned pubkey keys as an unordered set, we'd have to sum up their individual
  hashes, which reduces the security level a lot, so we order txs by sender pubkey, ascending.
  As a side benefit, this allows accounts to be referenced by the block+txheight that their pubkey
  was first seen as a receiver (as long as the christening tx is buried by burns greater in value
  than someone's tx to him - otherwise someone might inject themselves at that txheight.)

  Conflicting-Transaction Forking Attack
  ======================================

  It's possible for an attacker to put conflicting transactions in different
  versions of the current block and broadcast them all to different peers.

  If peers simply rejected incoming blocks with conflicting transactions, they
  would all be forked!

  If they threw out the conflicting transactions that they had as well, their
  block burns would become smaller and the cycle could repeat!

  We therefore specify that if a peer is merging two blocks with conflicting
  transactions, the conflictor's pubkey keys are added to a banlist in the block
  and two conflicting transactions are moved to a respective banproof.

  If the banproof had the same burn as a transaction, this immunized
  block wouldn't propagate. We therefore specify that transactions must send at
  least one coin as an amount to forfeit in case they misbehave this block.

  Equivalent blocks with the same good transactions and the same banlist may
  have different banproofs.

  We don't hash the signatures because they don't matter as long as they're valid, and
  they will be optional for aggregate signatures.
*/

// Hashes a string into its fixed-length hex hash
const sha512 = require("hash.js/lib/hash/sha/512")
const hash = str => sha512().update(str).digest("hex").slice(0, 64)

// Calculates the ID of a VALID block (txs and bans MUST be sorted by sender in ascending order)
const id = block => {

  // Make a copy of the block with the stuff that's the same for every peer (no sigs/agg/conflicts)
  const hashedBlock = {
    parent: block.parent,
    txs:    block.txs.map(tx => ({
      from:   tx.from,
      to:     tx.to,
      gross:  tx.gross
      // sig not necessary (otherwise the block's not valid anyway)
    })),
    bans:   block.bans.map(ban => ({
      from: ban.from
      // conflicts may vary between peers, for the same block
    }))
  }

  return hash(JSON.stringify(hashedBlock))
}
/*
====================================================================================================
WAVES MINING SYSTEM

  TIMING
  Since transactions are supposed to refer to the same parent block, we need
  to give the network time to reach consensus before making new transactions. Otherwise, a lot of
  transactions will be rendered obsolete by forks. We therefore prefer to let the network settle for
  15s of "wait time" before mining a new block.
  We expect nodes to have a synchronized time of +/- 4 s from the true time. The node server
  software will ensure that the system unix time matches the true unix time with NTP on startup.

    Our time    Our activity
    T(H) +0     We begin accepting/rebroadcasting block H.
    T(H) +10    We mine our tx's block H, add/merge it into our blockchain, and broadcast it.
    T(H) +30    We begin accepting/rebroadcasting block H+1...

    True time   Network activity
    T(H) -4     Fastest nodes start accepting/rebroadcasting block H.
    T(H) +4     Slowest nodes start accepting/rebroadcasting block H.
    T(H) +6     Fastest nodes sign and broadcast their newly-mined block H's.
    T(H) +14    Slowest nodes sign and broadcast their newly-mined block H's.
    T(H) +26    Fastest nodes start accepting/rebroadcasting block H+1.
    T(H) +34    Slowest nodes start accepting/rebroadcasting block H+1.
    T(H) +36    Fastest nodes sign and broadcast their newly-mined block H+1's...

  The slowest nodes therefore have 22 seconds of propagation time after they broadcast their block
  H's and before the fastest nodes broadcast their block H+1's. Note that bad nodes could broadcast
  block H+1 a mere 12 seconds after the slowest well-behaved nodes broadcast block H, but those
  would only propagate on the fastest peers.
====================================================================================================
*/

// Determines the current maximum (zero-indexed) block height, assuming 30s/block since genesis time
const maxHeightNow = G => {
  const t = BigInt(Date.now()) / 1000n - BigInt(G)
  const H = t / 30n
  return H.toString()
}

// Determines the time to wait until the next primetime to mine
// Input: current height of blockchain (int), genesis time (int seconds)
// Output: time to wait until primetime OR zero if at primetime or we're behind (int seconds)
const primeTimeWait = (h, G) => {
  h = BigInt(h)
  const t = BigInt(Date.now()) / 1000n - BigInt(G)
  const H = t / 30n
  const T = H * 30n
  const wait = (h  >= H - 1n && t < T + 9n ) ? (T + 10n) - t : // too early
               (h === H      && t > T + 11n) ? (T + 40n) - t : // too late
               0n
  return wait.toString() // it's prime-time! (or catch-up time ;)
}

module.exports = { id, maxHeightNow, primeTimeWait }
