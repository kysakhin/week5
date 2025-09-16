import { Transaction, SystemProgram, PublicKey } from "@solana/web3.js";
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
    if (!recipient.trim() || !amount.trim() || isNaN(amount) || Number(amount) <= 0) {
      setEstimatedFee(0);
      return;
    }

    const estimateFee = async () => {
      try {
        const recipientPubKey = new PublicKey(recipient);
        const txn = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubKey,
            lamports: Math.round(Number(amount) * 1e9),
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        txn.recentBlockhash = blockhash;
        txn.feePayer = publicKey;

        const feeResponse = await connection.getFeeForMessage(txn.compileMessage());
        setEstimatedFee(feeResponse.value || 5000); // Default to 5000 lamports if unable to estimate
      } catch (error) {
        setEstimatedFee(5000); // Default fee estimate
      }
    };

    if (publicKey && recipient.trim()) {
      estimateFee();
    }
  }, [recipient, amount, publicKey, connection]);

  const handleTransfer = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!recipient.trim() || !amount.trim() || isNaN(amount) || Number(amount) <= 0) {
      toast.error("Please enter a valid recipient address and amount");
      return;
    }

    const transferAmount = Number(amount);
    const totalCost = (transferAmount * 1e9) + estimatedFee;

    if (totalCost > balance) {
      toast.error(`Insufficient balance. Need ${(totalCost / 1e9).toFixed(6)} SOL (including fees)`);
      return;
    }

    try {
      setIsTransferring(true);
      toast.info("Preparing transaction...");

      const recipientPubKey = new PublicKey(recipient);

      const txn = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubKey,
          lamports: Math.round(transferAmount * 1e9),
        })
      );

      // Use the newer getLatestBlockhash method
      const { blockhash } = await connection.getLatestBlockhash();
      txn.recentBlockhash = blockhash;
      txn.feePayer = publicKey;

      toast.info("Please approve the transaction in your wallet...");

      // sendTransaction handles signing and sending
      const signature = await sendTransaction(txn, connection);

      toast.info("Transaction sent, awaiting confirmation...");
      console.log("Transaction signature:", signature);

      // Confirm the transaction
      await connection.confirmTransaction(signature, 'confirmed');

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
        toast.error(`Transfer failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsTransferring(false);
    }
  }

  const setMaxAmount = () => {
    const maxTransferable = Math.max(0, (balance - estimatedFee) / 1e9);
    setAmount(maxTransferable.toFixed(6).replace(/\.?0+$/, ''));
  }

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6">
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
    <div className="flex flex-col items-center space-y-6 p-6 max-w-2xl mx-auto">
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Your Balance</p>
            <p className="text-2xl font-bold">{(balance / 1e9).toFixed(6)} SOL</p>
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
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-colors"
          />
        </div>

        {/* Fee estimation */}
        {estimatedFee > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-blue-700 dark:text-blue-300">Transfer Amount:</span>
              <span className="font-mono">{amount || '0'} SOL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-700 dark:text-blue-300">Estimated Fee:</span>
              <span className="font-mono">{(estimatedFee / 1e9).toFixed(6)} SOL</span>
            </div>
            <hr className="my-2 border-blue-200 dark:border-blue-700" />
            <div className="flex justify-between text-sm font-medium">
              <span className="text-blue-800 dark:text-blue-200">Total Cost:</span>
              <span className="font-mono">{((Number(amount || 0) * 1e9 + estimatedFee) / 1e9).toFixed(6)} SOL</span>
            </div>
          </div>
        )}

        <button
          onClick={handleTransfer}
          disabled={isTransferring || !recipient.trim() || !amount.trim() || Number(amount) <= 0}
          className={`
            w-full px-6 py-3 font-semibold text-white rounded-lg shadow-lg
            transition-all duration-200 transform hover:scale-105
            ${isTransferring || !recipient.trim() || !amount.trim() || Number(amount) <= 0
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 hover:shadow-xl'
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
              <span>💸</span>
              <span>Send SOL</span>
            </div>
          )}
        </button>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 w-full">
        <h3 className="font-medium text-amber-800 dark:text-amber-200 mb-2">⚠️ Transaction Safety</h3>
        <ul className="text-amber-700 dark:text-amber-300 text-sm space-y-1">
          <li>• Double-check the recipient address</li>
          <li>• Transactions on Solana are irreversible</li>
          <li>• Keep some SOL for future transaction fees</li>
          <li>• Network fees are automatically included</li>
        </ul>
      </div>
    </div>
  );
}
