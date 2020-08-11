const addTip         = require('./addTip.js')
const { compareHex } = require('./helpers.js')
const last = array => array[array.length - 1] // else returns undefined

// NOTE: Equal or subset tip blocks are not merged (there is no need)
// TODO: Optimize the most common case of merging the current propagating tip

// Merges two tip blocks (best-effort) (should be validated later by addTip)
const mergeTips = (hisTip, ourTip, parentState) => {
  console.log("Merging tip blocks...", hisTip, ourTip)

  // QUESTION: Is it actually necessary to validate his tip block BEFORE merging it?
  // Completely validate his tip block by seeing if it can get added to the parent state
  const hisTipState = addTip(hisTip, parentState)
  hisTip = last(hisTipState.chain)

  // Potentially merge these sets
  const ourTxs = ourTip.txs
  const hisTxs = hisTip.txs
  const ourBans = ourTip.bans
  const hisBans = hisTip.bans

  // Build the merged block...
  // NOTE: One block might be a subset of the other one at this point, but that's okay
  const merged = {}
  merged.parent = ourTip.parent

  // Make the deduped set of existing bans...

  // * Sender banned in one or both blocks (thus no tx in that block)
  const bans = [
    ...ourBans,
    ...hisBans.filter(hisBan => ourBans.every(ourBan => hisBan.from !== ourBan.from))
  ]

  // Add the set of new bans from conflicting, non-banned txs
  // * Same sender in both blocks (thus no existing ban)
  // * Different sigs (thus have conflicting receivers and/or amounts)
  ourTxs.forEach(ourTx => {
    // Get the conflicting tx in the other block, if any
    const hisTx = hisTxs.find(hisTx => hisTx.from === ourTx.from && hisTx.sig !== ourTx.sig)
    if (!hisTx) return

    // Build the ban
    const ban = {
      from: ourTx.from,
      conflicts: [{
        to:       ourTx.to,
        gross:    ourTx.gross,
        sig:      ourTx.sig
      }, {
        to:       hisTx.to,
        gross:    hisTx.gross,
        sig:      hisTx.sig
      }]
    }
    bans.push(ban)
  })

  // Make the set of transactions that were the same in both tip blocks (and hence not banned)
  const sharedTxs = ourTxs.filter(ourTx => hisTxs.some(hisTx => hisTx.sig === ourTx.sig))

  // Make the set of transactions that were present in only one block, but not from banned senders
  const uniqueTxs = [...ourTxs, ...hisTxs]
    .filter(tx => sharedTxs.every(sharedTx => sharedTx.from !== tx.from)) // not shared
    .filter(tx => bans     .every(ban      => ban     .from !== tx.from)) // not banned

  // Merge the sets of not-banned transactions
  const txs = [...sharedTxs, ...uniqueTxs]

  // Sort and include the txs and bans, by sender pubkey, ascending
  merged.txs  = txs .sort((a, b) => compareHex(a.from, b.from))
  merged.bans = bans.sort((a, b) => compareHex(a.from, b.from))

  console.log("...done merging blocks", merged)
  return merged
}

module.exports = mergeTips
