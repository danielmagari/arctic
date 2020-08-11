"use strict"
const fetch = require("node-fetch")
const is = require("./is.js")

// Fisher-Yates algorithm in place
const shuffle = array => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Finds more peers from our known peers
async function findPeers (limit = 1) {
  console.log(`Finding ${limit} new peer(s)...`)
  const SERVER = this
  if (!SERVER.STATE) throw Error("Called broadcastTip without binding SERVER")

  // Make a list of random online peers
  const good = SERVER.PEERS.filter(peer => peer.ip !== "127.0.0.1" && peer.banScore < 5 && peer.online)
  shuffle(good)
  if (!good.length)
    return console.error("...cancelled. We have no good peers to ask. Try asking seeds")

  // Try up to 100 times until we get 10 new peers, max 3 queries per peer
  const found = 0
  for (let i = 0; found < limit && i < good.length * 3 && i < 100; i++) {
    console.log("...requesting new random good peer ip...")

    // Pick the next known good peer (wrap if < 100)
    const goodPeer = good[i % good.length]
    console.log("From known good peer:", goodPeer)
    if (!goodPeer.online) continue

    // Get a new ip from the known good peer...
    try {
      const response = await fetch(`http://${goodPeer.ip}:9999/v2/peer?random`, {
        redirect: "error",
        size:     9999,
        timeout:  5000
      })
      if (!response.ok) {
        console.warn("...couldn't get a random good peer ip from known good peer:", goodPeer)
        continue
      }
      const ip = await response.json()
      console.log("...got random good peer ip:", ip, "from known good peer:", goodPeer)
      is.ip(ip)

      // Skip undesired IP addresses
      const octets = ip.split(".").map(octet => ~~octet)
      if (octets[0] + octets[1] + octets[2] + octets[3] < 10)
        throw Error("Gave nonsense new peer ip address")
      if (ip.startsWith("127")) throw Error("Can't add ourselves as a peer")
        throw Error("Gave localhost new peer ip address")

    } catch (e) {
      goodPeer.online = "0"
      console.warn("...set known good peer as offline:", goodPeer, e)
      continue
    }

    // Skip known peers
    const existing1 = SERVER.PEERS.find(peer => peer.ip === ip)
    if (existing1) {
      console.log("Skipping existing peer:", existing1)
      continue
    }

    // Try pinging the new peer ip
    try {
      const response = await fetch(`http://${ip}:9999/`, {
        redirect: "error",
        size:     9999,
        timeout:  5000
      })
      if (!response.ok) {
        console.warn("Couldn't contact potential new peer:", ip)
        continue
      }
      const greeting = await response.json()
      console.log("Got greeting from potential new peer:", ip, greeting)
      if (/^Slothburn POC Server v[2-9]$/.test(greeting))
        throw Error("Unknown greeting")
    } catch (e) {
      console.warn("Skipping potential new peer:", ip, e)
      continue
    }

    // Skip known peers (again - prevents race conditions)
    const existing2 = SERVER.PEERS.find(peer => peer.ip === ip)
    if (existing2) {
      console.log("Skipping existing peer:", existing2)
      continue
    }

    // Finally add the peer
    const peer = {
      ip: ip,
      online: "1",
      banScore: "0"
    }
    SERVER.PEERS.push(peer)
    found++
  }
  console.log("...done finding new peers. Found:", found)
  if (!found) return false

  return true
}

module.exports = findPeers
