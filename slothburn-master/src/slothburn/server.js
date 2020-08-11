"use strict"
const { id, maxHeightNow, primeTimeWait } = require("./server/helpers.js")
const last = array => array[array.length - 1] // else returns undefined

const ratrod = require("./server/ratrod/ratrod.js") // for HTTP API
const getBalanceHandler = require("./server/getBalanceHandler.js")
const getBlockHandler   = require("./server/getBlockHandler.js")
const postTipHandler    = require("./server/postTipHandler.js")

const repl = require("repl")
const fs = require("fs")
const util = require("util")
const is = require("./server/is.js")
const findPeers = require("./server/findPeers.js")
const postTip   = require("./server/postTip.js")

// Runs the slothburn node server
function server (args) {
  console.log("Starting slothburn P2P server...")
  if (!args.ip) throw Error("No IP address")
  if (!args.SERVER) throw Error("No SERVER state")
  const SERVER = args.SERVER

  // API /////////////////////////////////////////////////////////////////////////////////////////////
  const rr = ratrod({ ip: args.ip, port: 9999 })

  // Responds with basic info about our blockchain
  rr["GET /"]           = () => JSON.stringify("Slothburn POC Server v2")
  rr["GET /v2/genesis"] = () => JSON.stringify(SERVER.STATE.genesis, null, " ")
  rr["GET /v2/height"]  = () => JSON.stringify(SERVER.STATE.chain.length - 1)
  rr["GET /v2/tip"]     = () => JSON.stringify(last(SERVER.STATE.chain), null, " ")

  // Responds with our blockchain's block(parent) or account(pubkey)
  rr["GET /v2/block"]   = getBlockHandler.bind(SERVER)
  rr["GET /v2/balance"] = getBalanceHandler.bind(SERVER)

  // Responds with the wait until the primetime for a new block
  rr["GET /v2/primetime-wait"] = () => {
    const currentHeight = SERVER.STATE.chain.length - 1
    const genesisTime   = SERVER.STATE.genesis.time
    const wait = primeTimeWait(currentHeight, genesisTime)
    return JSON.stringify(wait)
  }

  // Responds with the best parent block id to use for a new block, iff we're at primetime
  rr["GET /v2/primetime-parent"] = () => {
    const currentHeight = SERVER.STATE.chain.length - 1
    const genesisTime   = SERVER.STATE.genesis.time
    const wait = ~~primeTimeWait(currentHeight, genesisTime)
    if (wait < -1 || 1 < wait)
      throw Error("Template parent must be requested at primetime")

    // If we have a mergable tip at the maximum height (from some other peer, perhaps) give its parent
    const maxHeight = ~~maxHeightNow(genesisTime)
    if (currentHeight === maxHeight)
      return JSON.stringify(last(SERVER.STATE.chain).parent)

    // We have headroom for a new tip at the top of our blockchain, so give our current tip's id
    return JSON.stringify(id(last(SERVER.STATE.chain)))
  }

  // Receives a tip block, evaluates it, adds/merges/ignores/rejects it, and triggers followup actions
  rr["POST /v2/tip"] = postTipHandler.bind(SERVER)

  // Responds with a random peer from our collection
  rr["GET /v2/peer"] = (req) => {
    if (!req.url.search.match(/^\?random$/i))
      throw Error("Unexpected search parameter")

    const goodPeers = SERVER.PEERS.filter(p => p.online && ~~p.banScore < 5 && p.ip !== "127.0.0.1")
    if (!goodPeers.length)
      return false

    return JSON.stringify(goodPeers[Math.floor(Math.random() * goodPeers.length)].ip)
  }

  // REPL ////////////////////////////////////////////////////////////////////////////////////////////
  const REPL = repl.start({
    prompt: "REPL hints: SERVER addPeer(ip) findPeers(n) .chain .book .peers .tip .save .exit\n >",
    writer: object => util.inspect(object, {
      depth: 6,
      colors: true,
      maxArrayLength: 10,
      breakLength: 120
    })
  })
  REPL.context.SERVER = SERVER
  REPL.context.rr = rr
  REPL.context.last = last
  REPL.context.id = id
  REPL.context.maxHeightNow = maxHeightNow
  REPL.context.primeTimeWait = primeTimeWait
  REPL.context.postTip = postTip.bind(SERVER)
  REPL.context.findPeers = findPeers.bind(SERVER)
  REPL.context.addPeer = ip => {
    try {
      console.log("Adding peer...")
      console.log("IP:", ip)
      if (ip === rr.ip || ip.startsWith("127")) throw Error("Can't add ourselves as a peer")
      is.ip(ip)

      // Select/insert peer
      const peer = SERVER.PEERS.find(peer => peer.ip === ip) || SERVER.PEERS[SERVER.PEERS.push({
        ip: ip,
        online: "1",
        banScore: "0"
      }) - 1]
      peer.online = "1"
      peer.banScore = "0"

      console.log("Peer:", peer)
      postTip.bind(SERVER)(ip)
      console.log("...done adding peer")
    } catch (e) {
      console.error(e)
    }
  }

  REPL.defineCommand("chain",      () => console.table(SERVER.STATE.chain))
  REPL.defineCommand("book",       () => console.table(SERVER.STATE.book))
  REPL.defineCommand("peers",      () => console.table(SERVER.PEERS))
  REPL.defineCommand("tip",        () => console.log(last(SERVER.STATE.chain)))
  REPL.defineCommand("save",       () => {
    console.log("Writing server state to tmp file...")
    console.log(`File: ${args.db}.tmp`)
    if (fs.existsSync(`${args.db}.tmp`)) fs.unlinkSync(`${args.db}.tmp`)
    const tmpFile = fs.writeFileSync(`${args.db}.tmp`, JSON.stringify(SERVER, null, " "))

    console.log("...done writing tmp file. Replacing existing database file...")
    console.log(`File: ${args.db}`)
    if (fs.existsSync(`${args.db}.old`)) fs.unlinkSync(`${args.db}.old`)
    fs.renameSync(`${args.db}`,     `${args.db}.old`)
    fs.renameSync(`${args.db}.tmp`, `${args.db}`)
    console.log("...done replacing server state database file.")
  })
  REPL.defineCommand("exit",       () => process.exit(0))

  console.log("...started slothburn P2P server")
}

module.exports = server
