"use strict"

////////////////////////////////////////////////////////////////////////////////////////////////////
// Minimally-viable Slothburn wallet library ///////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
const slothWallet = (() => {
  console.log("Slothburn POC Wallet v2")

  // elliptic.js, is.js, helpers.js // browser
  const NODE = typeof exports === "object" && typeof module !== "undefined"
  const fetch    = NODE ? require("node-fetch")               : window.fetch
  const elliptic = NODE ? require("elliptic")                 : window.elliptic
  const is       = NODE ? require("./slothWallet/is.js")      : window.slothWalletIs
  const { ascii2bytes, compareHex } = NODE ?
                          require("./slothWallet/helpers.js") : window.slothWalletHelpers

  const last  = array => array[array.length - 1] // else returns undefined
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const die   = (...msgs) => { throw Error(msgs.join(" ")) }

  const EdDSA = elliptic.eddsa
  const ec    = new EdDSA("ed25519")

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Private functions cloned from upstream server code
  //////////////////////////////////////////////////////////////////////////////////////////////////

  // From checkSig.js
  // Checks a signature ("unsignedTx" DOES have parent but DOES NOT have signature)
  const checkSig = (hisSig, unsignedTx) => {
    console.log("Checking sig...", hisSig)
    if (!unsignedTx.parent)
      throw Error("Transaction doesn't include parent block id")

    // Convert the transaction to the byte array of its JSON representation
    const msg = ascii2bytes(JSON.stringify(unsignedTx))

    // Verify the actual signature
    const verifier = ec.keyFromPublic(unsignedTx.from, "hex")
    if (!unsignedTx.from || unsignedTx.from !== verifier.getPublic("hex"))
      throw Error("Failed to generate signature verifier from pubkey key")
    if (!verifier.verify(msg, hisSig))
      throw Error("Wrong signature")

    console.log("...done checking sig")
    return hisSig
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Public wallet library functions
  //////////////////////////////////////////////////////////////////////////////////////////////////

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Gets the time to wait until the preferred "primetime"
  const getPrimetimeWait = async (server = "127.0.0.1:9999", logger = console) => {
    logger.log("slothWallet: Getting primetime wait... @", server)

    const response = await fetch(`http://${server}/v2/primetime-wait`)
    if (!response.ok)
      throw Error("Failed to get primetime wait response")

    const body = await response.text()
    const wait = JSON.parse(body)
    logger.log("Got wait time (s):", wait)
    is.wait(wait)

    logger.log("...done getting primetime wait")
    return ~~wait
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Gets the parent block id to be used at primetime
  const getPrimetimeParent = async (server = "127.0.0.1:9999", logger = console) => {
    logger.log("slothWallet: Getting primetime parent... @", server)

    const response = await fetch(`http://${server}/v2/primetime-parent`)
    if (!response.ok)
      throw Error("Failed to get primetime parent response")

    const body = await response.text()
    const parent = JSON.parse(body)
    logger.log("Got parent:", parent)
    is.parent(parent)

    logger.log("...done getting primetime parent")
    return parent
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Gets an account balance
  const getBalance = async (pubkey, server = "127.0.0.1:9999", logger = console) => {
    logger.log("slothWallet: Getting account balance... @", server, "\n pubkey:", pubkey)
    is.pubkey(pubkey)

    const response = await fetch(`http://${server}/v2/balance?pubkey=${pubkey}`)
    if (!response.ok && response.status === 404)
      return false // 404 === zero balance (account could have previously existed)
    if (!response.ok)
      throw Error("Failed to get balance response")

    const body = await response.text()
    const balance = JSON.parse(body)
    logger.log("Got balance:", balance)
    is.balance(balance)

    logger.log("...done getting balance")
    return balance
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Makes a new transaction
  const makeTx = (parent, secret, to, gross, logger = console) => {
    logger.log("slothWallet: Making new transaction...",
      "\n parent:", parent,
      "\n secret:", secret.slice(0, 4) + "xx".repeat(30),
      "\n to:    ", to,
      "\n gross: ", gross
    )
    is.parent(parent)
    is.secret(secret)
    is.to(to)
    is.gross(gross)

    const signer = ec.keyFromSecret(secret, "hex")
    const from = signer.getPublic("hex").toLowerCase()
    is.from(from)

    const tx = {
      parent: parent,
      from:   from,
      to:     to,
      gross:  gross
    }
    tx.sig = signer.sign(ascii2bytes(JSON.stringify(tx))).toHex().toLowerCase()
    delete tx.parent

    logger.log(`...done making transaction:\n${JSON.stringify(tx, null, " ")}`)
    return tx
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Posts a new/merged tip block to the server, assuming we're at prime time
  const postTip = async (tip, server = "127.0.0.1:9999", logger = console) => {
    logger.log(`slothWallet: Posting new tip block... @ ${server}\n${JSON.stringify(tip, 0, 1)}`)
    is.block(tip)

    // Post the tip block to the server
    const response = await fetch(`http://${server}/v2/tip`, {
      method: "POST",
      body:   JSON.stringify(tip, null, " ")
    })

    // Check the response
    if (!response.ok)
      throw Error("Failed to post new/merged tip block. Maybe we're not at primetime?")
    const result = response.statusText

    logger.log("...done posting tip block. Result:", result)
    return result
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Compound functions
  //////////////////////////////////////////////////////////////////////////////////////////////////

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Does a complete transaction using all of the above steps
  const send = async (args) => {
    const secret  = args.secret          || die("Sender's private key is required")
    const to      = args.to              || die("Receiver's public key is required")
    (args.gross ? !args.net : args.net) || die("Net XOR gross amount sent is required")
    const gross   = args.gross ? args.gross : (BigInt(args.net) + 100n).toString()
    const used    = args.used            || [] // parents to avoid so we don't make conflicting txs
    const server  = args.server          || "127.0.0.1:9999"
    const logger  = args.logger          || console          // or compatible with console.log/error
    const signals = args.signals         || { abort: false } // use to abort during primetime wait
    logger.log("slothWallet: Making and sending new transaction... @", server,
      "\n from  (secret):", secret.slice(0, 4) + "xx".repeat(30),
      "\n to    (pubkey):", to,
      "\n gross (amount):", gross
    )
    is.secret(secret)
    is.to(to)
    is.gross(gross)

    // Wait for primetime (can abort while waiting)
    logger.log("Waiting for primetime...")
    const wait = await getPrimetimeWait(server, logger)
    if (signals.aborted) return logger.warn("Obeying abort signal - not posting transaction")

    if (wait) {
      logger.log("Sleeping for", wait, "seconds...")
      await sleep(wait*1000)
      logger.log("...done sleeping")

      // Ensure that the transaction wasn't cancelled
      if (signals.aborted) return logger.warn("Obeying abort signal - not posting transaction")
    }
    logger.log("...it's primetime!")

    // Check against balance right now
    const pubkey = ec.keyFromSecret(secret, "hex").getPublic("hex")
    const balance = await getBalance(pubkey, server, logger)
    if (signals.aborted) return logger.warn("Obeying abort signal - not posting transaction")
    if (BigInt(balance) < BigInt(gross))
      throw Error("Sender's balance can't cover the gross amount sent")

    // Get the parent block id to use in our new transaction's block
    const parent = await getPrimetimeParent(server, logger)
    if (signals.aborted) return logger.warn("Obeying abort signal - not posting transaction")
    if (used.some(usedParent => usedParent === parent))
      throw Error("Can't reuse parent block id - would result in conflicting transaction ban")

    // Make the new transaction and put it in a new tip block
    const tx = makeTx(parent, secret, to, gross, logger)
    const tip = {
      parent,
      txs: [tx],
      bans: []
    }

    // Go for it
    if (signals.aborted) return logger.warn("Obeying abort signal - not posting transaction")
    signals.commit()
    if (signals.committed) logger.log("Obeying commit signal - adding parent to used parents")
    used.push(parent)
    const result = await postTip(tip, server, logger)
    if (result !== "NEW STATE")
      throw Error(`Transaction rejected: ${result}`)

    logger.log("...done. Successfully sent transaction! :)")
    return true
  }

  console.log("...done initializing slothWallet library")
  return { getBalance, getPrimetimeWait, getPrimetimeParent, makeTx, postTip, send }
})()

if (typeof exports === "object" && typeof module !== "undefined") { // node
  module.exports = slothWallet
} else {
  window.slothWallet = slothWallet
}
