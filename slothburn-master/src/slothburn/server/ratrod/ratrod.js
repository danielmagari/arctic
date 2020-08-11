"use strict"
let logger, verbose
const CORS = "Access-Control-Allow-Origin: *\r\n"

function onConnectionError (e, ...rest) {
  clearTimeout(this.slowloris)
  if (verbose) logger.error("ratrod: Connection killed:", this.req, e, ...rest)
  else         logger.error("ratrod: Connection killed:", e, ...rest)
  this.destroy()                                             // instantly stop all i/o on the socket
}
function squeak (msg) { throw Error(msg) }

async function onPOST (k) {
  try {
    clearTimeout(k.slowloris)
    const path   = (k.req.head.match(/(?<=^POST ).+(?= HTTP)/i)   || squeak("No path given"))[0]
    k.req.url    = new URL(path, "http://" + k.server.hostname)
    const route  = k.server["POST " + k.req.url.pathname]   || squeak(`No route found ${k.req.url}`)
    k.res        = await route(k.req)
    if (k.res && (typeof k.res !== "string" || !k.res.match(/^[a-z0-9 ]+$/i))) k.res = "OK"
    if (k.res) k.end(`HTTP/1.0 200 ${k.res}\r\n${CORS}\r\n`)      || squeak("Failed to respond 200")
    else       k.end(`HTTP/1.0 404 Not Found\r\n${CORS}\r\n`)     || squeak("Failed to respond 404")
    logger.log(`ratrod: Responded to: ${k.req.from}: POST ${k.req.url}: With ${k.res}`)
  } catch (e) {
    k.emit("error", e)
  }
}

async function onGET (k) {
  try {
    clearTimeout(k.slowloris)
    const path   = (k.req.head.match(/(?<=^GET ).+(?= HTTP)/i)    || squeak("No path given"))[0]
    k.req.url    = new URL(path, "http://" + k.server.hostname)
    const route  = k.server["GET " + k.req.url.pathname]    || squeak(`No route found ${k.req.url}`)
    k.res        = await route(k.req)
    if (typeof k.res !== "string" || !k.res.length) k.res = false
    if (k.res) k.end(`HTTP/1.0 200 OK\r\n${CORS}Content-Length: ${k.res.length}\r\n\r\n${k.res}`)
                                                                  || squeak("Failed to respond 200")
    else       k.end(`HTTP/1.0 404 Not Found\r\n${CORS}\r\n`)     || squeak("Failed to respond 404")
    logger.log(`ratrod: Responded to: ${k.req.from}: GET ${k.req.url}: With ${k.res}`)
  } catch (e) {
    k.emit("error", e)
  }
}

function onConnectionData (chunk) {    // catch incoming chunks until we get a complete http request
  const k = this
  const r = k.req
  try {
    if (k.bytesRead > 100000)                        squeak("Request too big")
    r.msg += chunk
    r.head = r.head || (r.msg.match(/.+\r\n(?=\r\n)/s) || [""])[0]     // j11y.io's parsing trick :)
    if (r.head) {                                                  // wait for the entire head first
      if ( r.head.startsWith("GET "))                return setImmediate(onGET, k)   // got full GET
      if (!r.head.startsWith("POST "))               squeak(`Method not GET nor POST: ${r.head}`)
      r.cl = r.cl || ~~(r.head.match(/(?<=\r\nContent-Length: )[0-9]{1,6}(?=\r\n)/i) || ["-1"])[0]
      r.body = (r.msg.match(/(?<=\r\n\r\n).+/s) || [""])[0]
      if (r.cl  <  r.body.length)                    squeak(`Wrong or no content-length: ${r.head}`)
      if (r.cl === r.body.length)                    return setImmediate(onPOST, k) // got full POST
    }
    this.once("data", onConnectionData)                               // wait for a full GET or POST
  } catch (e) {
    this.emit("error", e)
  }
}

function onClientTimeout () { this.emit("error", Error("Client took too long to send request")) }
function onTCPtimeout    () { this.emit("error", Error("Server took too long to respond")) }

function onServerConnection (k) {
  k.once("error", onConnectionError)
  try {
    k.req = {}

    k.req.from = k.remoteAddress || squeak("No remote IP address")      // sometimes Node "loses it"
    logger.log("ratrod: Received connection from:", k.req.from)

    k.slowloris = setTimeout(onClientTimeout.bind(k), 1000)   // only give 1 second to get a request
    k.setTimeout(10000, onTCPtimeout)            // give us 10 seconds to start sending packets back

    k.setEncoding("ascii")                                             // keep all data as plaintext
    k.cork()                                   // don't leak response until we explicitly call end()

    k.req.msg = ""
    k.once("data", onConnectionData)                                   // handle one chunk at a time
  } catch (e) {
    k.emit("error", e)
  }
}

function onServerError   (e) { logger.error(e, this); this.close() }
function onServerClose   (e) { logger.log("ratrod: Server closed:", this.address(), e) }
function onServerListen  ()  { logger.log("ratrod: Server open:", this.address()) }

module.exports = function ratrod (options) {
  const port = options.port     || 80
  const ip   = options.ip       || "0.0.0.0"
  verbose    = options.verbose  || false
  logger     = options.logger   || console
  const rr = require("net").createServer(onServerConnection).listen(port, ip, onServerListen)
  .once("error",  onServerError)
  .once("close",  onServerClose)
  rr.hostname = options.hostname || "localhost"
  rr.ip = ip
  return rr
}
//k.req.cookie = (k.req.head.match(/(?<=Cookie: ).+(?=\r\n)/i) || [])[0]          // Optional cookie
