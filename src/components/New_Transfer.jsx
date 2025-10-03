import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { ComputeBudgetProgram } from "@solana/web3.js";
import { TransactionMessage } from "@solana/web3.js";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function NewTransfer() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState(0);

  // Fetch balance when wallet connects
  useEffect(() => {
    const fetchBalance = async () => {
      if (publicKey) {
        try {
          const balance = await connection.getBalance(publicKey);
          setBalance(balance / 1e9);
        } catch (error) {
          console.error("Failed to fetch balance:", error);
        }
      } else {
        setBalance(0);
      }
    };

    fetchBalance();
  }, [publicKey, connection, isTransferring]);

  // Estimate transaction fee
  useEffect(() => {
    const estimateFee = async () => {
      if (!publicKey || !recipient || !amount) {
        setEstimatedFee(0);
        return;
      }

      try {
        const recipientPubKey = new PublicKey(recipient);
        const lamports = Math.round(parseFloat(amount) * 1e9);
        const recentBlockhash = await connection.getLatestBlockhash();

        const messageV0 = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: recentBlockhash.blockhash,
          instructions: [
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: recipientPubKey,
              lamports,
            }),
          ],
        }).compileToV0Message();

        const txn = new VersionedTransaction(messageV0);
        const feeResponse = await connection.getFeeForMessage(txn.message);
        console.log("Estimated fee (lamports):", feeResponse.value);
        setEstimatedFee((feeResponse.value || 5000) / 1e9);
      } catch (error) {
        console.warn("Fee estimation failed:", error);
        setEstimatedFee(0.000005); // Default estimate
      }
    };

    const timeoutId = setTimeout(estimateFee, 500);
    return () => clearTimeout(timeoutId);
  }, [publicKey, connection, recipient, amount]);

  const transferFunds = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!recipient || !amount) {
      toast.error("Please enter recipient address and amount");
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (transferAmount + estimatedFee > balance) {
      toast.error("Insufficient balance (including fees)");
      return;
    }

    try {
      setIsTransferring(true);
      toast.info("Preparing transaction...");

      const recipientPubKey = new PublicKey(recipient);
      const lamports = Math.round(transferAmount * 1e9);

      const recentBlockhash = await connection.getLatestBlockhash();

      // Build initial transaction for simulation
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: recentBlockhash.blockhash,
        instructions: [
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubKey,
            lamports,
          }),
        ],
      }).compileToV0Message();

      const txn = new VersionedTransaction(messageV0);

      // Simulate to get compute units
      const simulation = await connection.simulateTransaction(txn, {
        sigVerify: false,
      });

      console.log("Simulation result:", simulation);

      if (simulation.value.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }

      const unitsUsed = simulation.value?.unitsConsumed || 200000;

      // Rebuild with compute budget
      const finalMessage = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: recentBlockhash.blockhash,
        instructions: [
          ComputeBudgetProgram.setComputeUnitLimit({
            units: Math.ceil(unitsUsed * 1.1),
          }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubKey,
            lamports,
          }),
        ],
      }).compileToV0Message();

      const finalTxn = new VersionedTransaction(finalMessage);

      toast.info("Please approve the transaction in your wallet...");

      // Send transaction with Phantom-friendly options
      // For Phantom: sometimes skipPreflight helps with false simulation errors
      const signature = await sendTransaction(finalTxn, connection, {
        skipPreflight: true, // Skip Phantom's problematic simulation
        preflightCommitment: 'processed',
        maxRetries: 3,
      });

      toast.info("Transaction sent, waiting for confirmation...");

      // Confirm transaction
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: recentBlockhash.blockhash,
          lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      toast.success(`Transfer successful! 🎉`);
      console.log("Transaction signature:", signature);

      // Clear form
      setRecipient("");
      setAmount("");

    } catch (error) {
      console.error("Transfer failed:", error);
      
      if (error.message?.includes("User rejected")) {
        toast.error("Transaction was rejected");
      } else if (error.message?.includes("insufficient funds")) {
        toast.error("Insufficient funds for this transaction");
      } else if (error.message?.includes("Invalid public key")) {
        toast.error("Invalid recipient address");
      } else {
        toast.error(`Transfer failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsTransferring(false);
    }
  };

  const setMaxAmount = () => {
    const maxTransfer = Math.max(0, balance - estimatedFee - 0.001); // Leave small buffer
    setAmount(maxTransfer.toFixed(6));
  };

  if (!publicKey) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <svg className="w-16 h-16 text-blue-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">SOL Transfer</h2>
            <p className="text-gray-600 mb-6">Connect your wallet to send SOL using versioned transactions</p>
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-lg">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Wallet not connected
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-purple-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Modern SOL Transfer</h1>
          <p className="text-gray-600">Send SOL using optimized versioned transactions</p>
        </div>

        {/* Balance Card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Your Balance</p>
              <p className="text-2xl font-bold text-gray-900">{balance.toFixed(6)} SOL</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Wallet</p>
              <p className="text-sm font-mono text-gray-700">
                {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
              </p>
            </div>
          </div>
        </div>

        {/* Transfer Form */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="space-y-6">
            {/* Recipient Input */}
            <div>
              <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                id="recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Enter Solana address (e.g., 4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                disabled={isTransferring}
              />
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                  Amount (SOL)
                </label>
                <button
                  onClick={setMaxAmount}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  disabled={isTransferring}
                >
                  Use Max
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  min="0"
                  step="0.000001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-16"
                  disabled={isTransferring}
                />
                <span className="absolute right-4 top-3 text-gray-500 font-medium">SOL</span>
              </div>
            </div>

            {/* Transaction Summary */}
            {amount && recipient && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Transfer Amount:</span>
                  <span className="font-medium">{parseFloat(amount || 0).toFixed(6)} SOL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Estimated Fee:</span>
                  <span className="font-medium">{estimatedFee.toFixed(6)} SOL</span>
                </div>
                <div className="flex justify-between text-sm font-medium border-t pt-2">
                  <span>Total Cost:</span>
                  <span>{(parseFloat(amount || 0) + estimatedFee).toFixed(6)} SOL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remaining Balance:</span>
                  <span className={`font-medium ${
                    balance - parseFloat(amount || 0) - estimatedFee < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {(balance - parseFloat(amount || 0) - estimatedFee).toFixed(6)} SOL
                  </span>
                </div>
              </div>
            )}

            {/* Transfer Button */}
            <button
              onClick={transferFunds}
              disabled={
                isTransferring || 
                !recipient || 
                !amount || 
                parseFloat(amount || 0) <= 0 ||
                parseFloat(amount || 0) + estimatedFee > balance
              }
              className={`w-full py-4 px-6 rounded-lg font-medium text-white transition-all duration-200 ${
                isTransferring || 
                !recipient || 
                !amount || 
                parseFloat(amount || 0) <= 0 ||
                parseFloat(amount || 0) + estimatedFee > balance
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
              }`}
            >
              {isTransferring ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Transfer...
                </div>
              ) : parseFloat(amount || 0) + estimatedFee > balance ? (
                'Insufficient Balance'
              ) : (
                '🚀 Send SOL'
              )}
            </button>

            {/* Phantom Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-amber-400 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="text-amber-800 text-sm">
                  <p className="font-medium mb-1">🦆 Phantom Wallet Users:</p>
                  <p className="text-xs">
                    If you see "transaction reverted during simulation" - this is a Phantom UI bug, not your transaction! 
                    The transaction is actually valid and safe to approve. Consider using Backpack for better UX.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
