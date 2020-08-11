"use strict"
const fs = require("fs")
const is = require("./slothburn/server/is.js")
const server = require("./slothburn/server.js")

console.log("Slothburn POC Server v2")

// Get commad-line arguments
const args = {}
try {
  const ipv4regex = /^((0|1[0-9]{0,2}|2[0-9]?|2[0-4][0-9]|25[0-5]|[3-9][0-9]?)\.){3}(0|1[0-9]{0,2}|2[0-9]?|2[0-4][0-9]|25[0-5]|[3-9][0-9]?)$/
  args.ip = process.argv[2].match(ipv4regex)[0]
  args.db = process.argv[3].match(/.+/)[0]
  if (process.argv.length > 4) throw Error("Extra unknown arguments")
} catch (e) {
  console.warn("\nUsage: node slothburn2 ipv4_address database_path")
  console.warn("ex. ipv4_address  -> 0.0.0.0          <- will listen on the default interface")
  console.warn("ex. database_path -> blockchain2.json <- will be created if not found\n")
  console.warn(e)
  return process.exit(1)
}

// If we don't have an existing database file, write a new one using the genesis state
console.log("Looking for database file:", args.db)
if (!fs.existsSync(args.db)) {
  console.log("Existing database file not found")

  // Write the genesis server state to the database file
  const GENESIS_SERVER = require("./slothburn/genesis.js")
  console.log("Genesis state:", GENESIS_SERVER)
  console.log("Writing genesis state to new database file...")
  fs.writeFileSync(args.db, JSON.stringify(GENESIS_SERVER, null, " "))
  console.log("...wrote new database file")
} else console.log("Existing database file found")

// Read in (or back in) the database file as our initial server state
console.log("Reading in initial server state from database file...")
args.SERVER = JSON.parse(fs.readFileSync(args.db))
is.server(args.SERVER)
console.log("...read and parsed server state from database file")

// Start the server
const slothburn = server(args)
