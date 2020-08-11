"use strict"

// For checking datatypes of the blocks we get from peers, and of the state we load from disk
const is = {}

const not = x => { throw Error('Wrong type: ' + JSON.stringify(x)) }

// Bulletproof "primitive" types. No nonsense! >:(
is._ipv4   = x => typeof x === 'string' && /^((0|1[0-9]{0,2}|2[0-9]?|2[0-4][0-9]|25[0-5]|[3-9][0-9]?)\.){3}(0|1[0-9]{0,2}|2[0-9]?|2[0-4][0-9]|25[0-5]|[3-9][0-9]?)$/.test(x) || not(x)
is._string = x => typeof x === 'string' && /^[\x30-\x39\x61-\x7A]{1,256}$/.test(x) || not(x) //0-9az
is._array  = x => Array.isArray(x) || not(x) // arrays can be empty
is._object = x => {
  typeof x === 'object' && x !== null || not(x)
  Object.getPrototypeOf(x) === Object.prototype || not(x) // plain objects only!
  Object.keys(x).length > 0 && Object.values(x).length > 0 || not(x) // must not be empty objects
  return true
}

// String-encoded stuff
is._bool   = x => is._string(x) && /^[01]$/.test(x) || not(x)        // '0' == false and '1' == true
is._dec    = x => is._string(x) && /^(0|([1-9][0-9]{0,18}))$/.test(x) || not(x) // 0 to 9{19} < 2^64
is._hex    = x => is._string(x) && /^([0-9a-f][0-9a-f]){1,64}$/.test(x) || not(x)      // 1-64 bytes

// Cryptographic primitives (serialized) (DEFERRED TODO: BN256 or BLS381)
is._hash   = x => is._hex(x) && x.length/2 === 32 || not(x) // 256-bit hashes         -> 32 bytes
is._secret = x => is._hex(x) && x.length/2 === 32 || not(x) // 256-bit private keys   -> 32 bytes
is._pubkey = x => is._hex(x) && x.length/2 === 32 || not(x) // 256-bit coordinate     -> 32 bytes*
is._sig    = x => is._hex(x) && x.length/2 === 64 || not(x) // Compressed EdDSA sig   -> 64 bytes
             // TODO: use shorter ones via self-checking - WARNING: zero-pad them for elliptic.js!!!

// Types actually used *****************************************************************************

// Block & transaction property primitive types
is.parent   = x => is._hash  (x) || not(x)
is.from     = x => is._pubkey(x) || not(x)
is.to       = x => is._pubkey(x) || not(x)
is.gross    = x => is._dec   (x) && /^[1-9][0-9]{2,8}$/.test(x) || not(x) // 100 to 999999999 < 2^32
is.sig      = x => is._sig   (x) || not(x)

// Account property primitive types
is.pubkey   = x => is._pubkey(x) || not(x)
is.balance  = x => is._dec   (x) || not(x) // TODO: Account balances are always > 0 due to pruning?

// State paraphenalia
is.time     = x => is._dec   (x) || not(x) // seconds, not ms
is.carry    = x => is._dec   (x) || not(x) // distribution remaining from rounding-down

// Wallet paraphenalia
is.wait     = x => is._dec   (x) && /^([0-9]|([1-2][0-9]))$/.test(x) || not(x) // 0-29s to primetime
is.secret   = x => is._secret(x) || not(x)

// P2P
is.ip       = x => is._ipv4  (x) || not(x)
is.online   = x => is._bool  (x) || not(x)
is.banScore = x => is._dec   (x) || not(x)

// Compound types **********************************************************************************

// Transaction ("tx") objects and Transaction List ("txs") arrays
is.tx = x => {
  is._object(x) || not(x)
  const keys = Object.keys  (x)
  const vals = Object.values(x)
  keys.length === 4      && vals.length === 4    || not(x)
  keys[0] === 'from'     && is.from    (vals[0]) || not(x)
  keys[1] === 'to'       && is.to      (vals[1]) || not(x)
  keys[2] === 'gross'    && is.gross   (vals[2]) || not(x)
  keys[3] === 'sig'      && is.sig     (vals[3]) || not(x)
  return true
}
is.txs = x => is._array(x) && (x.length === 0 || x.every(x => is.tx(x))) || not(x)

// Banproof ("ban") objects and related
is.conflict = x => {
  is._object(x) || not(x)
  const keys = Object.keys  (x)
  const vals = Object.values(x)
    keys.length === 3      && vals.length === 3    || not(x)
    keys[0] === 'to'       && is.to      (vals[0]) || not(x)
    keys[1] === 'gross'    && is.gross   (vals[1]) || not(x)
    keys[2] === 'sig'      && is.sig     (vals[2]) || not(x)
    return true
}
is.conflicts = x => is._array(x) && x.length === 2 && x.every(x => is.conflict(x)) || not(x)
is.ban = x => {
  is._object(x) || not(x)
  const keys = Object.keys  (x)
  const vals = Object.values(x)
    keys.length === 2        && vals.length === 2     || not(x)
    keys[0] === 'from'       && is.from     (vals[0]) || not(x)
    keys[1] === 'conflicts'  && is.conflicts(vals[1]) || not(x)
    return true
}
is.bans = x => is._array(x) && (x.length === 0 || x.every(x => is.ban(x))) || not(x)

// Blockchain ("chain") objects and related
is.block = x => {
  is._object(x) || not(x)
  const keys = Object.keys  (x)
  const vals = Object.values(x)
  keys.length === 3         && vals.length === 3  || not(x)
  keys[0] === 'parent'      && is.parent(vals[0]) || not(x)
  keys[1] === 'txs'         && is.txs   (vals[1]) || not(x)
  keys[2] === 'bans'        && is.bans  (vals[2]) || not(x)
  return true
}
is.chain  = x => is._array(x) && x.every(x => is.block(x)) || not(x)
is.branch = x => is._array(x) && x.every(x => is.block(x)) || not(x)

// Balance sheet ("account") objects and related
is.account = x => {
  is._object(x) || not(x)
  const keys = Object.keys  (x)
  const vals = Object.values(x)
  keys.length === 2           && vals.length === 2  || not(x)
  keys[0] === 'pubkey'        && is.pubkey (vals[0]) || not(x)
  keys[1] === 'balance'       && is.balance(vals[1]) || not(x)
  return true
}
is.book = x => is._array(x) && x.every(x => is.account(x)) || not(x)

// Hardcoded state genesis info
is.genesis = x => {
  is._object(x) || not(x)
  const keys = Object.keys  (x)
  const vals = Object.values(x)
  keys.length === 4          && vals.length === 4 || not(x)
  keys[0] === 'time'         && is.time   (vals[0]) || not(x)
  keys[1] === 'block'        && is.block  (vals[1]) || not(x)
  keys[2] === 'account'      && is.account(vals[2]) || not(x)
  keys[3] === 'carry'        && is.carry  (vals[3]) || not(x)
  return true
}

// State compound type (imported from disk)
is.state = x => {
  is._object(x) || not(x)
  const keys = Object.keys  (x)
  const vals = Object.values(x)
  keys.length === 4           && vals.length === 4
  keys[0] === 'genesis'       && is.genesis(vals[0]) || not(x)
  keys[1] === 'chain'         && is.chain  (vals[1]) || not(x)
  keys[2] === 'book'          && is.book   (vals[2]) || not(x)
  keys[3] === 'carry'         && is.carry  (vals[3]) || not(x)
  return true
}

// Peer compound type
is.peer = x => {
  is._object(x) || not(x)
  const keys = Object.keys  (x)
  const vals = Object.values(x)
  keys.length === 3           && vals.length === 3
  keys[0] === 'ip'            && is.ip      (vals[0]) || not(x)
  keys[1] === 'online'        && is.online  (vals[1]) || not(x)
  keys[2] === 'banScore'      && is.banScore(vals[2]) || not(x)
  return true
}
is.peers = x => is._array(x) && x.every(x => is.peer(x)) || not(x)

// Overall server state type (from disk)
is.server = x => {
  is._object(x) || not(x)
  const keys = Object.keys  (x)
  const vals = Object.values(x)
  keys.length === 2           && vals.length === 2
  keys[0] === 'STATE'         && is.state(vals[0]) || not(x)
  keys[1] === 'PEERS'         && is.peers(vals[1]) || not(x)
  return true
}

if (typeof exports === "object" && typeof module !== "undefined") { // for node only
  module.exports = is
} else {
  window.slothWalletIs = is
}
