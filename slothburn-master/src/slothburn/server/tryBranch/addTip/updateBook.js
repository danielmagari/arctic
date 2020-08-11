const fip = (a, c, n = 0) => a.forEach(v => c(v) && (a[n++] = v)) || a.splice(n)  // filter in-place

// NOTE: Everything done here should have been approved by checkTip()
// TODO: Make this easier to rewind so that rewindState is faster?
// TODO: Flip the chain ;)
// Makes an updated copy of our account book after a new valid tip is applied (should always work)
const updateBook = (parentBook, parentCarry, tip) => {
  console.log("Making updated copy of our account book...")

  // Copy our account book
  let book = parentBook.map(account => ({
    pubkey:  account.pubkey,
    balance: account.balance
  }))

  // Keep track of the amount of coins to be distributed from minted coins, banned accts, and fees
  const mint = 100n * 1n * 30n // supply the 100 burn/tx * 1 tx/s * 30 s/block design capacity
  const distribution = mint + BigInt(parentCarry)

  // 1. Apply the transactions
  tip.txs.forEach(tx => {
    const gross = BigInt(tx.gross)
    const net   = gross - 100n

    // Subtract the gross amounts sent
    const sender = book.find(account => account.pubkey === tx.from)
    sender.balance = (BigInt(sender.balance) - gross).toString()

    // Make the created accounts
    let receiver = book.find(account => account.pubkey === tx.to)
    if (!receiver) {
      receiver = {
        pubkey: tx.to,
        balance: "0"
      }
      book.push(receiver)
    }

    // Add the net amounts received
    receiver.balance = (BigInt(receiver.balance) + net).toString()
  })

  // 2. Delete the banned accounts
  tip.bans.forEach(ban => {
    const banned = book.findIndex(banned => banned.pubkey === ban.from)
    book.splice(banned, 1)
  })

  // 3. Delete any dust accounts with < 100 coins
  fip(book, account => BigInt(account.balance) >= 100n)

  // 4. Disburse the distribution, and carry forward the rounding remainders to the next block
  const total = book.reduce((total, account) => total += BigInt(account.balance), 0n)
  let carry = distribution
  book.forEach(account => {
    const balance      = BigInt(account.balance)
    const disbursement = (distribution * balance) / total // rounds down
    account.balance    = (balance + disbursement).toString()
    carry -= disbursement
  })
  carry = carry.toString()

  return { book, carry }
}

module.exports = updateBook
