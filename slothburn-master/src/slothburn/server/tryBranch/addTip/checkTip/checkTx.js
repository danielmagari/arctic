const checkSig = require('./checkTx/checkSig.js')

// Validates and rebuilds a transaction for a new tip block (before bans)
const checkTx = (hisTx, parent, txs, bans, parentState) => {
  console.log("Checking tx...", hisTx)

  // Validate his tx by rebuilding it...
  const unsignedTx = {}
  unsignedTx.parent = parent

  // Validate and add the sender (ensure that this is the only tx from this sender in this block)
  if (txs.some(tx => tx.from === hisTx.from))
    throw Error("The sender has already sent a transaction in this block")
  if (bans.some(ban => ban.from === hisTx.from))
    throw Error("The sender has been banned in this block")
  const sender = parentState.book.find(account => account.pubkey === hisTx.from)
  if (!sender)
    throw Error("The sender was not found in the account book")
  unsignedTx.from = sender.pubkey

  /* NOTE: We must allow receivers who have been newly banned in this block, because otherwise this
      block's total burn could go DOWN by deleting the txs going to the newly-banned receiver, and
      then the ban wouldn't stick! */
  // TODO: Require these to be valid pubkeys so they can be aggregated
  // Add the receiver
  unsignedTx.to = hisTx.to

  // Validate and add the gross amount sent
  const gross   = BigInt(hisTx.gross)
  const balance = BigInt(sender.balance)
  if (gross > balance)
    throw Error("The sender can't afford this transaction")
  if (gross < 100n)
    throw Error("The gross amount sent doesn't cover the required 100 coin transaction fee")

  // POSSIBLE OTHERS:
  //if (!to && gross < 200n)                    // Required to cover network costs of more accounts
  //  throw Error("The gross amount sent doesn't cover the required 100 coin account-creation fee")
  //if (gross % 100n !== 0n)                 // Required so that % fees will map 1:1 to coins sent?
  //  throw Error("Amount sent is not divisible by 100 to have a unique 1% transaction fee")
  //if (gross + 100n > balance)        // Required so that banned accounts forfeit an extra amount?
  //  throw `Sender has insufficient funds to cover amount sent + 100 coin burn`
  unsignedTx.gross = gross.toString()

  // Validate and add the signature
  const sig = checkSig(hisTx.sig, unsignedTx)

  // Return the signed tx as it is in the block
  const tx = {
    from:  unsignedTx.from,
    to:    unsignedTx.to,
    gross: unsignedTx.gross,
    sig:   sig
  }

  // OK
  console.log("...done checking tx")
  return tx
}

module.exports = checkTx
