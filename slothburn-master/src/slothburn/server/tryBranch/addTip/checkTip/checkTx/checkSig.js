const elliptic = require("elliptic")

const EdDSA = elliptic.eddsa
const ec = new EdDSA("ed25519")

// Converts ascii string to array of bytes
const ascii2bytes = str => {
  if (!str.match(/^[\x20-\x7e]*$/))
    throw Error("String not plain ascii")

  const bytes = []
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.codePointAt(i))
  }
  return bytes
}

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
module.exports = checkSig
