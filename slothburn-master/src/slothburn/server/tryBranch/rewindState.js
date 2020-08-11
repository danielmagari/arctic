const addTip = require('./addTip.js')
const { copyState, genesisState } = require("./helpers.js")
const last = array => array[array.length - 1] // else returns undefined

// TODO: Optimize rewinding just the current tip so that propagation is faster / more efficient.

// Returns a rebuilt copy of our state as it was AFTER a tip at a certain (zero-indexed) height
const rewindState = (ourState, tipHeight) => {
  console.log('Rewinding a copy of our state to a tip block height...', tipHeight)
  if (tipHeight < 0) throw Error('Negative height')

  // Ensure that we actually have that height
  const ourHeight = ourState.chain.length - 1
  if (tipHeight > ourHeight) throw Error("Height is after our current tip block")

  // Handle the trivial case of it just being the current height
  if (tipHeight === ourHeight) {
    console.log("...Done rewinding state (kept same height)")
    return copyState(ourState)
  }

  // Rebuild the old state from genesis
  let state = genesisState(ourState.genesis)
  for (let i = 1; i <= tipHeight; i++) {           // NOT i = 0 (that's the hardcoded genesis block)
    state = addTip(ourState.chain[i], state)
  }

  console.log("...done rewinding to parent state at tip", last(state.chain))
  return state
}

module.exports = rewindState
