"use strict"
const fetch = require("node-fetch")
const last = array => array[array.length - 1] // else returns undefined

// POSTs our tip block to a peer
async function postTip (ip) {
  console.log("Posting tip block...")
  const SERVER = this
  if (!SERVER.STATE) throw Error("Called postTip without binding SERVER")
  if (!ip)           throw Error("Called postTip without ip")

  // Select/insert peer
  const peer = SERVER.PEERS.find(peer => peer.ip === ip) || SERVER.PEERS[SERVER.PEERS.push({
    ip: ip,
    online: "1",
    banScore: "0"
  }) - 1]
  console.log("Peer:", peer)

  // Get the tip block from this server's state
  const tip = last(SERVER.STATE.chain)
  console.log("Block:", tip)

  try {
    // Send tip block
    const response = await fetch(`http://${peer.ip}:9999/v2/tip`, {
      method:   "POST",
      body:     JSON.stringify(tip, null, 1),
      redirect: "error",
      size:     99999,
      timeout:  5000
    })
    if (!response.ok) {
      peer.online = "0"
      console.warn("...cancelled. Unexpected response:", response.statusText)
      return false
    }

    console.log("...posted tip block to peer:", peer, "response:", response.statusText)
    return true
  } catch (e) {
    peer.online = "0"
    console.warn("...couldn't post tip block. Assuming offline peer:", peer, e)
    return false
  }
}

module.exports = postTip
