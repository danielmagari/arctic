"use strict"
const is                          = require('./is.js')
const { id, maxHeightNow }        = require('./helpers.js')
const { copyState }               = require('./tryBranch/helpers.js')
const addTip                      = require('./tryBranch/addTip.js')
const rewindState                 = require('./tryBranch/rewindState.js')
const mergeTips                   = require('./tryBranch/mergeTips.js')
const last = array => array[array.length - 1] // else returns undefined

// Calculates the burn of a branch = 1/tx + 2/ban
const burn = branch => branch.reduce((sum, block) => block.txs.length + 2*block.bans.length, 0)
const croak = function (msg, obj) { throw Error(msg + JSON.stringify(obj, 0, 1)) }

// P2P Consensus Negotiation v4.9

/*
  Everything starts when we get a peer's blockchain tip block (from postTip)
  We put it in a branch and look for its parent
  - If we have its parent, we compare and add/merge/switch/discard branches
  - Otherwise, we set aside his branch ask for the parent block (with getBranch), and try again
  Note that addTip() does the state calculations.
*/

// Figure out what to do with a block/branch that a peer just gave us
/*
  Makes new state iff it results in a bigger burn
  Returns:
    'CONSENSUS'   = We did nothing. Delete his branch.
    'FORKED'      = We did nothing. Wait for a better block to come in.
    'OBSOLETE'    = We did nothing. Delete his branch. Respond with our tip.
    'NEED PARENT' = We still need to find a sibling root. Request his branch's parent.
    {newState}    = We made a better state. Delete all branches and broadcast our new tip.
*/
const tryBranch = (hisBranch, ourState) => {
  console.log("Considering peer's branch...")
  is.branch(hisBranch) || croak("Invalid branch format: ", hisBranch) // valid type formatting only

  // If our tips are the same, then we're all good! Done.
  const hisTip = last(hisBranch)
  const ourTip = last(ourState.chain)
  if (id(hisTip) === id(ourTip)) {
    console.log(`Tip blocks are twins. We're in consensus! :)`)

    return `CONSENSUS`
  }

  // If his root's parent is our tip, then just append his blocks. Done. ***************************
  const hisRoot = hisBranch[0]
  if (hisRoot.parent === id(ourTip)) {
    console.log(`Extending our own blockchain with his branch...`)

    let state = copyState(ourState)
    hisBranch.forEach(hisTip => {
      state = addTip(hisTip, state) // ensures that maxheight isn't exceeded
    })
    return {newState: state}
  }

  // Can we find a place to potentially merge in his branch? ***************************************
  const rootHeight = ourState.chain.findIndex(ourRoot => ourRoot.parent === hisRoot.parent)
  if (rootHeight > 0) { // Never try merging the genesis block at height 0
    console.log("Have sibling root block. Comparing branches...")

    // Ensure that merging in his branch wouldn't make the blockchain too long
    const hisHeight = rootHeight + hisBranch.length - 1
    const maxHeight = maxHeightNow(ourState.genesis.time)
    if (hisHeight > maxHeight)
      throw "His branch's tip block is too high"

    // Ensure that his root is not the same as our sibling root (Prevents race condition?)
    const ourBranch = ourState.chain.slice(rootHeight) // remember it might be just one block
    const ourRoot   = ourBranch[0]
    if (id(hisRoot) === id(ourRoot)) {
      console.log("...both branches have the same root. We probably already switched to his branch")

      return "OBSOLETE"
    }

    // Try merging the roots as a potential tip (will be new tip if branches are singletons)
    const hisBurn = burn(hisBranch)
    const ourBurn = burn(ourBranch)
    const parentState = rewindState(ourState, rootHeight - 1)
    const mergedTip = mergeTips(hisRoot, ourRoot, parentState)

    // Does the merged block have the biggest-burn?
    if (mergedTip && is.block(mergedTip)) {
      const mergedBurn = burn([mergedTip])
      if (mergedBurn > hisBurn && mergedBurn > ourBurn) {
        console.log(`Switching to a merged tip (from root or only branch block) for biggest-burn`)

        const state = addTip(mergedTip, parentState)
        return {newState: state}
      }
      console.log(`The merged tip didn't have a bigger burn. Discarding it.`)
    }
    console.log(`Comparing our competing branches without merging them...`)

    // Does his branch have the biggest-burn?
    if (hisBurn > ourBurn) {
      console.log(`Switching to his branch for the biggest-burn`)

      let state = parentState
      hisBranch.forEach(hisTip => {
        state = addTip(hisTip, state)
      })
      return {newState: state}
    }

    // Does our branch have the biggest-burn?
    if (hisBurn < ourBurn) {
      console.log(`Keeping our branch for the biggest-burn`)

      return `OBSOLETE`
    }

    // Is his branch the same-burn but longest?
    if (hisBranch.length > ourBranch.length) {
      console.log(`Switching to his branch for the same-burn but longer`)

      let state = parentState
      hisBranch.forEach(hisTip => {
        state = addTip(hisTip, state)
      })
      return {newState: state}
    }

    // Is our branch the same-burn but longest?
    if (hisBranch.length < ourBranch.length) {
      console.log(`Keeping our branch for the same-burn but longer`)

      return `OBSOLETE`
    }

    // Uh oh...the network is forked
    console.warn(`???Our branches are different but same-burn and length!`)
    console.warn(`The network is forked. We need someone to make a tx on just one branch.`)
    console.warn(`More consensus rules might fix this???`)

    return `FORKED`
  }

  // Set aside his branch and request the next parent until we have a sibling roots ****************
  return `NEED PARENT`
}

module.exports = tryBranch
