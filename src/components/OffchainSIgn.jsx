import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

export function OffchainSign() {
  const { signMessage, publicKey, wallet, connected } = useWallet();
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [isSigning, setIsSigning] = useState(false);

  const handleSignMessage = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    console.log("Public key:", publicKey.toString());
    console.log("signMessage function available:", !!signMessage);

    if (!signMessage) {
      toast.error("Wallet does not support message signing");
      return;
    }

    if (!message.trim()) {
      toast.error("Please enter a message to sign");
      return;
    }

    try {
      setIsSigning(true);
      console.log("Starting message signing process...");
      toast.info("Please approve the signature request in your wallet...");
      
      const encodedMessage = new TextEncoder().encode(message);
      console.log("Encoded message:", encodedMessage);
      console.log("Message to sign:", message);
      
      const signatureBytes = await signMessage(encodedMessage);
      console.log("Raw signature bytes:", signatureBytes);
      
      // Convert Uint8Array to hex string without using Buffer
      const signatureHex = Array.from(signatureBytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      console.log("Signature hex:", signatureHex);
      
      setSignature(signatureHex);
      toast.success("Message signed successfully!");
    } catch (error) {
      console.error("Full error object:", error);
      console.error("Error message:", error.message);
      console.error("Error code:", error.code);
      
      if (error.message?.includes("User rejected") || error.code === 4001) {
        toast.error("Signature request was rejected");
      } else if (error.message?.includes("not supported")) {
        toast.error("Your wallet doesn't support message signing");
      } else {
        toast.error(`Failed to sign message: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsSigning(false);
    }
  }

  const copySignature = () => {
    navigator.clipboard.writeText(signature);
    toast.success("Signature copied to clipboard!");
  }

  const clearAll = () => {
    setMessage("");
    setSignature("");
  }

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Sign Message</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to sign messages
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            Please connect your wallet to use message signing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6 p-6 max-w-2xl mx-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Sign Message</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Sign any message to prove wallet ownership (no fees)
        </p>
      </div>

      <div className="w-full space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Message to Sign
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your message here... (e.g., 'I own this wallet')"
            className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     resize-none transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            {message.length} characters
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSignMessage}
            disabled={isSigning || !message.trim()}
            className={`
              flex-1 px-6 py-3 font-semibold text-white rounded-lg shadow-lg
              transition-all duration-200 transform hover:scale-105
              ${isSigning || !message.trim()
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 hover:shadow-xl'
              }
              disabled:transform-none disabled:hover:scale-100
            `}
          >
            {isSigning ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Signing...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <span>✍️</span>
                <span>Sign Message</span>
              </div>
            )}
          </button>

          {(message || signature) && (
            <button
              onClick={clearAll}
              className="px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 
                       border border-gray-300 dark:border-gray-600 rounded-lg
                       hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {signature && (
        <div className="w-full space-y-3">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-green-600 dark:text-green-400">✅</span>
              <span className="font-medium text-green-800 dark:text-green-200">Message Signed Successfully!</span>
            </div>
            <p className="text-green-700 dark:text-green-300 text-sm">
              Your signature proves you own this wallet without any network fees.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Signature (Hex)
            </label>
            <div className="relative">
              <textarea
                value={signature}
                readOnly
                className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100
                         text-sm font-mono resize-none"
              />
              <button
                onClick={copySignature}
                className="absolute top-2 right-2 px-3 py-1 text-xs
                         bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 
                         rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}