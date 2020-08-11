"use strict"

// slothWallet helpers copied from server code

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

// Compare two fixed-length hex strings (Can be used as <array>.sort(compareHex))
const compareHex = (a, b) =>
    (a === b) ?  0  // compares ascii char codes from left-to-right (same order as hex)
  : (a  <  b) ? -1
  : (a  >  b) ?  1
  : undefined


if (typeof exports === "object" && typeof module !== "undefined") {
  module.exports = { ascii2bytes, compareHex }
} else {
  window.slothWalletHelpers = { ascii2bytes, compareHex }
}
