"use strict"
const fetch = require("node-fetch")
const last = array => array[array.length - 1] // else returns undefined

// For evaluating blocks we get
const is        = require("./is.js")
const tryBranch = require("./tryBranch.js")

// For follow-up actions when we're done
const postTip  = require("./postTip.js")
const broadcastTip = require("./broadcastTip.js")

// GETs a peer's tip block and all of its parent blocks until we can sync blockchains
async function getBranch (ip) {
  console.log("Getting blockchain branch...")
  const SERVER = this
  if (!SERVER.STATE) throw Error("Called getBranch without server")
  if (!ip)           throw Error("Called getBranch without ip")

  // Select/insert peer
  const peer = SERVER.PEERS.find(peer => peer.ip === ip) || SERVER.PEERS[SERVER.PEERS.push({
    ip: ip,
    online: "1",
    banScore: "0"
  }) - 1]
  console.log("Peer:", peer)

  try {
    // First, get his tip block
    console.log("...first getting tip block...")
    const response = await fetch(`http://${peer.ip}:9999/v2/tip`, {
        redirect: "error",
        size:     99999, // response size limit
        timeout:  5000
    })
    if (!response.ok) {
      peer.banScore = (~~peer.banScore + 1).toString()
      peer.online = "0"
      console.warn("...cancelled. Unexpected response:", response.statusText)
      return false
    }
    const hisTip = await response.json()
    console.log("...got response from peer:", peer.ip, "with tip block:", hisTip)
    is.block(hisTip)

    // Make a working branch for the peer
    const hisBranch = [hisTip]

    // Evaluate his blocks after finding our common root ///////////////////////////////////////////
    const originalParent = last(SERVER.STATE.chain).parent
    for (const i = 0; i < 1000000; i++) {
      if (hisBranch[0].parent === SERVER.STATE.chain[0].parent || i >= 999999)
        throw Error("Peer's branch is impossibly long")

      // Cancel the process if our blockchain changed while waiting for his block
      if (originalParent !== last(SERVER.STATE.chain).parent) {
        console.warn("...cancelling getBranch. Our state changed")
        return false
      }

      // Get the result of trying to merge his working branch
      const result = tryBranch(hisBranch, SERVER.STATE) // if this throws, his block/branch is bad

      // Handle the "no-op" cases (don't need to do anything)
      if (result === "CONSENSUS") {
        console.log("...done: CONSENSUS")
        return result
      }
      if (result === "FORKED") {
        console.warn("...done: FORKED: Our blockchains have equal scores! We'll wait for new blocks")
        return result
      }

      // Handle the "we're better" case (send him our tip block to trigger him getting our branch)
      if (result === "OBSOLETE") {
        console.log("...done: OBSOLETE: We will post our (better) tip block to him")
        setTimeout(postTip.bind(SERVER), 100, peer.ip)
        return result
      }

      // Handle the "accepted branch" case
      if (result.newState) {
        console.log("...done: NEW STATE: We will add and broadcast our new tip block")
        SERVER.STATE = result.newState
        setTimeout(broadcastTip.bind(SERVER), 100, peer.ip) // skips broadcasting to this peer
        return "NEW STATE"
      }

      // Handle the "we still don't know" case (we need to download another parent and loop)
      if (result === "NEED PARENT") {
        console.log("...getting parent block...")
        const parent = hisBranch[0].parent
        const response = await fetch(`http://${peer.ip}:9999/v2/block?id=${parent}`, {
          size: 99999,
          timeout: 5000
        })
        if (!response.ok) {
          peer.banScore = (~~peer.banScore + 1).toString()
          peer.online = "0"
          console.warn("...cancelled. Unexpected response:", response.statusText)
          return false
        }
        const hisBlock = await response.json()
        hisBranch.unshift(hisBlock)

        console.log("...got branch parent from peer:", peer, "\nEvaluating...")
        continue
      }

      throw Error("Got unknown result from tryBranch")
    }

    throw Error("Peer sent a blockchain branch that was longer than what's possible")
  } catch (e) {
    peer.banScore = (~~peer.banScore + 99).toString()
    peer.online = "0"
    console.error("...failed to get branch. Banned peer:", peer, e)
    return false
  }
}

module.exports = getBranch
