"use strict"
const is = require("./is.js")

// Responds to a peer with a requested block
function getBlockHandler (req) {
  console.log("Handling request for one of our blocks...")
  const SERVER = this
  if (!SERVER.STATE) throw Error("WTF: Called getBlockHandler without binding our server state!?")
  if (!req.from)     throw Error("WTF: Called getBlockHandler without including the request!?")
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
  peer.online = "1"

  try {
    // Get search parameter
    const parent = req.url.searchParams.get("parent")
    console.log("Parent:", parent)
    is.parent(parent)

    // Ensure that he's not requesting something else that we don't know how to get
    if (!req.url.search.match(/^\?parent=[0-9a-f]{64}$/i)) throw Error("Unexpected search params")

    // Get the actual block
    const block = SERVER.STATE.chain.find(block => block.parent === parent)
    if (!block) return false // ratrod returns 404

    console.log("...giving block:", block)
    return JSON.stringify(block, null, " ")
  } catch (e) {
    peer.online = "0"
    peer.banScore = (~~peer.banScore + 1).toString()
    console.warn("...bad request. Upping banscore of peer:", peer)
    throw e // ratrod kills xn
  }
}

module.exports = getBlockHandler
