"use strict"
const is = require("./is.js")

// Responds to a peer with a requested account balance
function getBalanceHandler (req) {
  console.log("Getting account balance...")
  const SERVER = this
  if (!SERVER.STATE) throw Error("Called getBalanceHandler without binding our server state")
  if (!req.from)     throw Error("Called getBalanceHandler without including the request")
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
    const pubkey = req.url.searchParams.get("pubkey")
    console.log("Pubkey:", pubkey)
    is.pubkey(pubkey)

    // Ensure that he's not requesting something that we don't know how to get
    if (!req.url.search.match(/^\?pubkey=[0-9a-f]{64}$/i)) throw Error("Unexpected search params")

    // Get the actual account
    const account = SERVER.STATE.book.find(account => account.pubkey === pubkey)
    if (!account) return false // 404 === no account === zero balance (pruned)

    console.log("...giving balance:", account.balance)
    return JSON.stringify(account.balance, null, " ")
  } catch (e) {
    peer.online = "0"
    peer.banScore = (~~peer.banScore + 1).toString()
    console.warn("...bad request. Upping banscore of peer:", peer)
    throw e
  }
}

module.exports = getBalanceHandler
