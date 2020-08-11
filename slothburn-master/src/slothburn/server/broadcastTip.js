"use strict"
const postTip = require("./postTip.js")

function broadcastTip (skipped) {
  console.log("Starting broadcast of tip block...")
  const SERVER = this
  if (!SERVER.STATE) throw Error("Called broadcastTip without binding SERVER")

  // See if we have any good peers to choose from
  const goodPeers = SERVER.PEERS.filter(peer =>
    peer.online && ~~peer.banScore < 5 && peer.ip !== "127.0.0.1" && peer.ip !== skipped
  )
  if (!goodPeers.length)
    return console.warn("...cancelled broadcast. No good peers.")

  // Choose 10 random peers from the good ones
  const targetPeers = []
  for (let i = 0; i < 100; i++) {
    const peer = goodPeers[Math.floor(Math.random() * goodPeers.length)]
    if (targetPeers.includes(peer)) continue // skip dupes
    targetPeers.push(peer)
    if (targetPeers.length < 10)    continue // loop until we get 10 unique peers or tried 100 times
    break
  }

  targetPeers.forEach(peer => {
    setTimeout(postTip.bind(SERVER), 50, peer.ip)
  })
  console.log("...broadcast started")
}

module.exports = broadcastTip
