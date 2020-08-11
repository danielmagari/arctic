const checkTip   = require('./addTip/checkTip.js')
const updateBook = require('./addTip/updateBook.js')

// Returns the new state after adding a peer's block, if valid
const addTip = (hisTip, parentState) => {
  console.log("Adding tip...", hisTip)

  // Validate and rebuild his tip as our new tip...
  const tip = checkTip(hisTip, parentState)

  // Make an updated copy of our book with the transactions applied...
  const { book, carry } = updateBook(parentState.book, parentState.carry, tip)

  // OK. Return the new state
  const state = {
    genesis: parentState.genesis,
    chain:   [...parentState.chain, tip],
    book:    book,
    carry:   carry
  }
  console.log("...done adding tip")
  return state
}

module.exports = addTip
