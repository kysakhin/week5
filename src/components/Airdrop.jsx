import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { toast } from "sonner";

export function Airdrop() {
  const [isAirdropping, setIsAirdropping] = useState(false);
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const requestAirdrop = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      setIsAirdropping(true);
      toast.info("Requesting airdrop...");
      
      console.log("Requesting airdrop for:", publicKey.toString());
      
      const signature = await connection.requestAirdrop(
        publicKey, // Remove new PublicKey() wrapper as publicKey is already a PublicKey
        LAMPORTS_PER_SOL,
      );
      
      console.log("Airdrop signature:", signature);
      toast.info("Airdrop requested, waiting for confirmation...");
      
      // Use a simpler confirmation method
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      
      console.log("Airdrop confirmed:", confirmation);
      toast.success("Airdrop successful! 1 SOL added to your wallet");
    } catch (error) {
      console.error("Airdrop failed:", error);
      
      if (error.message.includes('429')) {
        toast.error("Rate limited. Please try again later.");
      } else if (error.message.includes('insufficient funds')) {
        toast.error("Faucet is empty. Try again later.");
      } else {
        toast.error(`Airdrop failed: ${error.message}`);
      }
    } finally {
      setIsAirdropping(false);
    }
  }

  if (!publicKey) return null;

  return (
    <div className="flex flex-col items-center space-y-4 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Request Airdrop</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Get 1 SOL for testing
        </p>
      </div>
      
      <button
        className={`
          relative px-8 py-3 font-semibold text-white rounded-lg shadow-lg
          transition-all duration-200 transform hover:scale-105
          ${isAirdropping 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 hover:shadow-xl'
          }
          disabled:transform-none disabled:hover:scale-100
        `}
        onClick={requestAirdrop}
        disabled={isAirdropping}
      >
        {isAirdropping ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span>Airdropping...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span>💰</span>
            <span>Request 1 SOL</span>
          </div>
        )}
      </button>
      
      <p className="text-sm text-gray-500 text-center max-w-md">
        This will add 1 SOL to your wallet for testing purposes.
      </p>
    </div>
  )
}
