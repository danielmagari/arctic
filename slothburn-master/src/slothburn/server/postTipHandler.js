"use strict"
const is = require("./is.js")

// The core consensus function that validates untrusted blocks and chooses the new best blockchain
const tryBranch = require("./tryBranch.js")

// Potentially triggered followup actions
const broadcastTip = require("./broadcastTip.js")
const getBranch    = require("./getBranch.js")
const postTip      = require("./postTip.js")

// Handle POSTed tip from peer. Return true if 200 OK, throw if error (banScore++)
function postTipHandler (req) {
  console.log("Receiving tip block...")
  const SERVER = this
  if (!SERVER.STATE) throw Error("Called postTipHandler without binding server state")
  if (!req.from)     throw Error("Called postTipHandler without a request")
  const ip = req.from

  // Select/insert peer
  const peer = SERVER.PEERS.find(peer => peer.ip === ip) || SERVER.PEERS[SERVER.PEERS.push({
    ip: ip,
    online: "1",
    banScore: "0"
  }) - 1]
  console.log("Peer:", peer)

  // Filter out banned peers and update online status
  if (~~peer.banScore > 5) throw Error("Banscore too high")
  peer.online = "0"

  try {
    // Determine the consensus result assuming that his branch = his tip only
    const hisTip = JSON.parse(req.body)
    console.log("Block:", hisTip)
    is.block(hisTip)

    // Try appending or merging the block into our blockchain
    const result = tryBranch([hisTip], SERVER.STATE) // pure, slow, and synchronous (as of yet)

    // Handle the "no-op" cases (don't need to do anything)
    if (result === "CONSENSUS") {
      console.log("...done: CONSENSUS")
      return result
    }
    if (result === "FORKED") {
      console.warn("...done: FORKED: Our blockchains have equal scores! We'll wait for new blocks")
      return result
    }

    // Handle the "we're better" case (send him our tip block to trigger him downloading our branch)
    if (result === "OBSOLETE") {
      console.log("...done: OBSOLETE: We will post our (better) tip block to him")
      setTimeout(postTip.bind(SERVER), 100, peer.ip)
      return result
    }

    // Handle the "we don't know" case (we need to download his branch now)
    if (result === "NEED PARENT") {
      console.log("...done: NEED PARENT: We will download his branch and compare it with ours")
      setTimeout(getBranch.bind(SERVER), 100, peer.ip)
      return result
    }

    // Handle the "accepted block" case
    if (result.newState) {
      console.log("...done: NEW STATE: We will add and broadcast our new tip block")
      SERVER.STATE = result.newState
      setTimeout(broadcastTip.bind(SERVER), 100, peer.ip) // skips broadcasting to this peer
      return "NEW STATE"
    }

    throw Error("Got unknown result from tryBranch")
  } catch (e) {
    peer.online = "0"
    peer.banScore = (~~peer.banScore + 99).toString()
    console.warn("...bad request. Banned peer:", peer)
    throw e
  }
}

module.exports = postTipHandler
