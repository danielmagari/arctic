"use strict"

const ratrod = require("./ratrod.js")

const rr = ratrod(80)

rr["GET /favicon.ico"] = function getFavicon (req) {
  return false
}

rr["GET /cheese"] = function getCheese (req) {
  const type = req.url.searchParams.get("type")
  if (!type) throw Error("Type not given!")
  if (type !== "good") return false
  return `Here's some good cheese, ${req.from}!`
}

rr["POST /cheese"] = function postCheese (req) {
  const cheese = req.body
  if (!cheese) throw Error("Cheese not given!")
  if (cheese !== "good cheese") return false
  console.log(cheese)
  return true
}
