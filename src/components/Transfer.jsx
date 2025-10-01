import { Transaction, SystemProgram, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// Component to transfer SOL to another address
export function Transfer() {
  const { publicKey, sendTransaction, wallet, connected } = useWallet();
  const { connection } = useConnection();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState(0);
  const [insufficientFunds, setInsufficientFunds] = useState(false);

  useEffect(() => {
    const transferAmount = Number(amount) || 0;
    const totalCost = transferAmount * 1e9 + estimatedFee;

    if (transferAmount > 0 && totalCost > balance) {
      setInsufficientFunds(true);
    } else {
      setInsufficientFunds(false);
    }
  }, [amount, estimatedFee, balance]);

  useEffect(() => {
    if (!publicKey) {
      setBalance(0);
      return;
    }

    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        setBalance(lamports);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      }
    };

    fetchBalance();
  }, [publicKey, connection, isTransferring]);

  // Estimate transaction fee
  useEffect(() => {
    // Only estimate if we have a valid recipient address
    if (!recipient.trim() || !publicKey) {
      setEstimatedFee(5000); // Use standard SOL transfer fee as default
      return;
    }

    const estimateFee = async () => {
      try {
        // Validate recipient address first
        const recipientPubKey = new PublicKey(recipient);

        // Create a dummy transaction with a minimal amount to get accurate fee
        const dummyAmount = 1000; // 0.000001 SOL for fee estimation
        const txn = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubKey,
            lamports: dummyAmount,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        txn.recentBlockhash = blockhash;
        txn.feePayer = publicKey;

        const feeResponse = await connection.getFeeForMessage(
          txn.compileMessage()
        );
        const estimatedFee = feeResponse.value || 5000;

        console.log("Fee estimation:", {
          recipient: recipient,
          estimatedFee,
          estimatedFeeSOL: (estimatedFee / 1e9).toFixed(6),
        });

        setEstimatedFee(estimatedFee);
      } catch (error) {
        console.error("Fee estimation error:", error);
        // If recipient address is invalid, use standard fee
        setEstimatedFee(5000);
      }
    };

    estimateFee();
  }, [recipient, publicKey, connection]); // Removed amount from dependencies

  const handleTransfer = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (
      !recipient.trim() ||
      !amount.trim() ||
      isNaN(amount) ||
      Number(amount) <= 0
    ) {
      toast.error("Please enter a valid recipient address and amount");
      return;
    }

    const transferAmount = Number(amount);

    try {
      setIsTransferring(true);
      toast.info("Preparing transaction...");

      const recipientPubKey = new PublicKey(recipient);
      const lamportsToSend = Math.floor(transferAmount * 1e9);

      const txn = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubKey,
          lamports: lamportsToSend,
        })
      );

      // Use the newer getLatestBlockhash method
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      txn.recentBlockhash = blockhash;
      txn.feePayer = publicKey;

      // Get actual fee for this specific transaction
      const feeResponse = await connection.getFeeForMessage(
        txn.compileMessage()
      );
      console.log("Fee response:", feeResponse);
      const actualFee = feeResponse.value || 5000;

      const totalCost = lamportsToSend + actualFee;
      const currentBalance = await connection.getBalance(publicKey);

      console.log("Transfer details:", {
        recipient: recipientPubKey.toBase58(),
        amountSOL: transferAmount,
        amountLamports: lamportsToSend,
        actualFee,
        actualFeeSOL: (actualFee / 1e9).toFixed(6),
        totalCost,
        totalCostSOL: (totalCost / 1e9).toFixed(6),
        currentBalance,
        currentBalanceSOL: (currentBalance / 1e9).toFixed(6),
      });

      if (totalCost > currentBalance) {
        const neededSOL = (totalCost / 1e9).toFixed(6);
        const availableSOL = (currentBalance / 1e9).toFixed(6);
        toast.error(
          `Insufficient funds. Need ${neededSOL} SOL but only have ${availableSOL} SOL`
        );
        setIsTransferring(false);
        return;
      }

      // Simulate the transaction
      try {

        const _simulateTxnConfig = {
          commitment: "finalized",
          replaceRecentBlockhash: true,
          sigVerify: false,
          minContextSlot: undefined,
          innerInstructions: undefined,
          accounts: undefined,
        }

        const simulation = await connection.simulateTransaction(txn);
        if (simulation.value.err) {
          console.error("Transaction simulation failed:", simulation.value.err);
          toast.error(
            `Transaction simulation failed: ${JSON.stringify(
              simulation.value.err
            )}`
          );
          setIsTransferring(false);
          return;
        }
      } catch (error) {
        console.error("Transaction simulation error:", error);
        toast.error(`Transaction simulation error: ${error.message}`);
        setIsTransferring(false);
        return;
      }

      toast.info("Please approve the transaction in your wallet...");

      // sendTransaction handles signing and sending
      const signature = await sendTransaction(txn, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });

      toast.info("Transaction sent, awaiting confirmation...");
      console.log("Transaction signature:", signature);

      // Confirm the transaction
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        console.error(
          "Transaction confirmation failed:",
          confirmation.value.err
        );
        toast.error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
        );
        setIsTransferring(false);
        return;
      }

      toast.success(`Transfer successful! 🎉`);
      console.log("Transfer completed, signature:", signature);

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
        toast.error(`Transfer failed: ${error.message || "Unknown error"}`);
      }
    } finally {
      setIsTransferring(false);
    }
  };

  const setMaxAmount = async () => {
    if (!publicKey || !recipient.trim()) {
      toast.error("Please enter a recipient address first");
      return;
    }

    try {
      // Get the most accurate fee by creating the actual transaction structure
      const recipientPubKey = new PublicKey(recipient);
      const maxPossible = balance - estimatedFee;

      if (maxPossible <= 0) {
        toast.error("Insufficient balance to cover transaction fees");
        return;
      }

      // Create transaction with max possible amount to get exact fee
      const txn = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubKey,
          lamports: maxPossible,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      txn.recentBlockhash = blockhash;
      txn.feePayer = publicKey;

      const feeResponse = await connection.getFeeForMessage(
        txn.compileMessage()
      );
      const actualFee = feeResponse.value || 5000;

      const maxTransferable = Math.max(0, balance - actualFee);
      const maxTransferableSOL = maxTransferable / 1e9;

      console.log("Max calculation:", {
        balance: balance / 1e9,
        estimatedFee: estimatedFee / 1e9,
        actualFee: actualFee / 1e9,
        maxTransferable: maxTransferableSOL,
      });

      if (maxTransferableSOL <= 0) {
        toast.error("Insufficient balance to cover transaction fees");
        return;
      }

      setAmount(maxTransferableSOL.toFixed(6).replace(/\.?0+$/, ""));

      // Update the estimated fee with the more accurate one
      setEstimatedFee(actualFee);
    } catch (error) {
      console.error("Max amount calculation failed:", error);
      toast.error("Invalid recipient address");
    }
  };

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Transfer SOL</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to transfer SOL
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            Please connect your wallet to make transfers
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6 p-6 max-w-2xl mx-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Transfer SOL</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Send SOL to any Solana address
        </p>
      </div>

      {/* Wallet info */}
      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your Balance
            </p>
            <p className="text-2xl font-bold">
              {(balance / 1e9).toFixed(6)} SOL
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 dark:text-gray-400">Wallet</p>
            <p className="text-sm font-mono">{wallet?.adapter?.name}</p>
          </div>
        </div>
      </div>

      <div className="w-full space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Enter recipient's Solana address..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     font-mono text-sm transition-colors"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Amount (SOL)
            </label>
            <button
              onClick={setMaxAmount}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              Max
            </button>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.000000"
            step="0.000001"
            min="0"
            className={`w-full px-3 py-2 rounded-lg transition-colors focus:outline-none
                     ${
                       insufficientFunds
                         ? "border-2 border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                         : "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     }`}
          />
          {insufficientFunds && (
            <p className="text-red-600 dark:text-red-400 text-sm mt-1 flex items-center">
              Insufficient balance (need{" "}
              {((Number(amount || 0) * 1e9 + estimatedFee) / 1e9).toFixed(6)}{" "}
              SOL total)
            </p>
          )}
        </div>

        {/* Fee estimation */}
        {estimatedFee > 0 && (
          <div
            className={`rounded-lg p-3 ${
              insufficientFunds
                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
            }`}
          >
            <div className="flex justify-between text-sm">
              <span
                className={
                  insufficientFunds
                    ? "text-red-700 dark:text-red-300"
                    : "text-blue-700 dark:text-blue-300"
                }
              >
                Transfer Amount:
              </span>
              <span className="font-mono">{amount || "0"} SOL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span
                className={
                  insufficientFunds
                    ? "text-red-700 dark:text-red-300"
                    : "text-blue-700 dark:text-blue-300"
                }
              >
                Estimated Fee:
              </span>
              <span className="font-mono">
                {(estimatedFee / 1e9).toFixed(6)} SOL
              </span>
            </div>
            <hr
              className={`my-2 ${
                insufficientFunds
                  ? "border-red-200 dark:border-red-700"
                  : "border-blue-200 dark:border-blue-700"
              }`}
            />
            <div className="flex justify-between text-sm font-medium">
              <span
                className={
                  insufficientFunds
                    ? "text-red-800 dark:text-red-200"
                    : "text-blue-800 dark:text-blue-200"
                }
              >
                Total Cost:
              </span>
              <span className="font-mono">
                {((Number(amount || 0) * 1e9 + estimatedFee) / 1e9).toFixed(6)}{" "}
                SOL
              </span>
            </div>
            {insufficientFunds && (
              <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-700">
                <p className="text-red-800 dark:text-red-200 text-xs">
                  Available: {(balance / 1e9).toFixed(6)} SOL
                </p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleTransfer}
          disabled={
            isTransferring ||
            !recipient.trim() ||
            !amount.trim() ||
            Number(amount) <= 0 ||
            insufficientFunds
          }
          className={`
            w-full px-6 py-3 font-semibold text-white rounded-lg shadow-lg
            transition-all duration-200 transform hover:scale-105
            ${
              isTransferring ||
              !recipient.trim() ||
              !amount.trim() ||
              Number(amount) <= 0 ||
              insufficientFunds
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 hover:shadow-xl"
            }
            disabled:transform-none disabled:hover:scale-100
          `}
        >
          {isTransferring ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              <span>Sending...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <span>Send SOL</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
