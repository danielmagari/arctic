Slothburn Proof-of-Concept Implementation v2
====================================================================================================
By Dylan Sharhon

Slothburn is an experimental cryptocurrency consensus mechanism that scores blocks by their total
transaction fees. It is fully decentralizable with no miners, no stakeholders, and no supernodes.

Double-spend forks are disincentivized because an attacker must personally outpay the sum of all of
the fees in the blocks burying his original transaction. The drawback is that transaction recipients
need to wait many blocks until their payment is well-buried (when an attacker's loss in fees
overwhelms his potential gain). But sloths are allowed to be slow.

In this implementation, fixed transaction fees are "burned" and are not distributed back to anyone.
Every block, a fixed number of coins are minted and distributed pro-rata to all accounts, rounded
down (with roundings carried forward to the next block). Thus, users are incentivized to ration
shared resources - their quantity of on-chain transactions and accounts.
