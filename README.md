# KNOWN ISSUES

1. transfering sol. the ./src/components/Transfer.jsx file.
   Problem:
   "This transaction reverted during simulation. Funds may be lost if submitted"
   how to recreate:

a. connect PHANTOM wallet. try to transfer sol. (no issue on backpack)
b. tranfer some amount to another wallet
c. error is shown on the popup that phantom shows.

assumptions:
maybe the simulate transaction function must be accepting different parameters. the transaction should be of the modern versioned transaction function.
and also pass in params.

how to fix:
get rid of the legacy transaction function

```javascript
// Build transaction
const messageV0 = new TransactionMessage({
  payerKey: publicKey,
  recentBlockhash: blockhash,
  instructions: [
    SystemProgram.transfer({...})
  ],
}).compileToV0Message();

const txn = new VersionedTransaction(messageV0);

// Simulate to get units
const simulation = await connection.simulateTransaction(txn, {
  sigVerify: false,
});

const unitsUsed = simulation.value.unitsConsumed;

// Rebuild with compute budget
const finalMessage = new TransactionMessage({
  payerKey: publicKey,
  recentBlockhash: blockhash,
  instructions: [
    ComputeBudgetProgram.setComputeUnitLimit({
      units: Math.ceil(unitsUsed * 1.1)
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 1
    }),
    SystemProgram.transfer({...})
  ],
}).compileToV0Message();

const finalTxn = new VersionedTransaction(finalMessage);
```

references:
[Requesting optimal compute](https://solana.com/developers/guides/advanced/how-to-request-optimal-compute)
[Simulating transaction](https://solana.com/docs/rpc/http/simulatetransaction)
