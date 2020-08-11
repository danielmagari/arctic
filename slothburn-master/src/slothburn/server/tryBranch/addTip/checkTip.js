const { id, maxHeightNow }          = require('../../helpers.js') // need better place for this
const { compareHex }                = require('../helpers.js')
const checkTx                       = require('./checkTip/checkTx.js')
const checkBan                      = require('./checkTip/checkBan.js')
const last = array => array[array.length - 1] // else returns undefined

// Validates and returns a peer's new tip block
const checkTip = (hisTip, parentState) => {
  console.log("Checking tip block...", hisTip)

  // Validate his block as if it was our tip by rebuilding it...
  const tip = {}

  // Validate the block's height
  const height = parentState.chain.length
  const maxHeight = maxHeightNow(parentState.genesis.time)
  if (height > maxHeight)
    throw Error("Blockchain is already at max height at this time")

  // Validate and add the parent block ID (our current tip)
  const parent = id(last(parentState.chain))
  if (parent !== hisTip.parent)
    throw Error("Tried to append tip block on top of wrong parent block (shouldn't happen)")
  tip.parent = parent

  // Validate and add the transactions and bans...
  const txs = []
  const bans = []
  hisTip.txs.forEach(hisTx => {
    const tx = checkTx(hisTx, parent, txs, bans, parentState)
    txs.push(tx)
  })
  hisTip.bans.forEach(hisBan => {
    const ban = checkBan(hisBan, parent, txs, bans, parentState)
    bans.push(ban)
  })

  // Ensure that the txs and bans are sorted by from, ascending
  for (let i = 1; i < txs.length; i++) {
    if (compareHex(txs[i-1].from, txs[i].from) >= 0)
      throw "Transactions not sorted!"
  }
  for (let i = 1; i < bans.length; i++) {
    if (compareHex(bans[i - 1].from, bans[i].from) >= 0)
      throw "Banlist not sorted!"
  }
  tip.txs = txs
  tip.bans = bans

  console.log("...done checking tip block")
  return tip
}

module.exports = checkTip
