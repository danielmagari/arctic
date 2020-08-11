const checkTx = require('./checkTx.js') // used to check that the banned txs are otherwise valid

// Validates and rebuilds a banlist entry for a new tip block
const checkBan = (hisBan, parent, txs, bans, parentState) => {
  console.log("Checking ban...", hisBan)

  // Validate his ban by rebuilding it from its banned transactions...
  const ban = {}
  const hisTx0 = {}
  const hisTx1 = {}
  hisTx0.parent = parent
  hisTx1.parent = parent

  // Add the conflicting transaction sender (Check that he's not already banned in this block)
  if (bans.some(ban => ban.from === hisBan.from))
    throw Error("Sender was already banned in this block")
  hisTx0.from = hisBan.from
  hisTx1.from = hisBan.from

  // Add the conflicting transaction receiver(s) and amount(s)
  if (hisBan.conflicts[0].to       === hisBan.conflicts[1].to &&
      hisBan.conflicts[0].gross    === hisBan.conflicts[1].gross)
    throw Error("Conflicting transactions aren't different")
  hisTx0.to     = hisBan.conflicts[0].to
  hisTx1.to     = hisBan.conflicts[1].to
  hisTx0.gross  = hisBan.conflicts[0].gross
  hisTx1.gross  = hisBan.conflicts[1].gross

  // Add the conflicting transaction signatures
  hisTx0.sig = hisBan.conflicts[0].sig
  hisTx1.sig = hisBan.conflicts[1].sig

  // Check that the conflicting transactions would have been valid (including signatures)
  const tx0 = checkTx(hisTx0, parent, txs, bans, parentState)
  const tx1 = checkTx(hisTx1, parent, txs, bans, parentState)

  // Move the banned sender reference from the conflicts to the ban (saves space)
  if (hisBan.from !== tx0.from || tx0.from !== tx1.from)
    throw Error("Something changed by rebuilding the banned txs (shouldn't happen)")
  ban.from = tx0.from
  delete tx0.from
  delete tx1.from

  // Add the conflicting transactions (sans sender) to the banned sender's ban ;)
  ban.conflicts = [tx0, tx1]

  // OK
  console.log("...done checking ban")
  return ban
}

module.exports = checkBan
