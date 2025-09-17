import { ed25519 } from "@noble/curves/ed25519";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { toast } from "sonner";

// Checks if a signature is valid for a given message and public key
export function VerifySign() {
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [verificationResult, setVerificationResult] = useState(null);
  const { publicKey, wallet, connected } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifySignature = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!message.trim() || !signature.trim()) {
      toast.error("Please enter both a message and a signature to verify");
      return;
    }

    try {
      setIsVerifying(true);
      setVerificationResult(null);
      
      console.log("Verifying signature...");
      console.log("Message:", message);
      console.log("Signature (hex):", signature);
      console.log("Public key:", publicKey.toString());
      
      // Encode the message
      const encodedMessage = new TextEncoder().encode(message);
      
      // Convert hex signature to bytes
      const signatureBytes = new Uint8Array(
        signature.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
      );
      
      // Get public key bytes
      const publicKeyBytes = publicKey.toBytes();
      
      console.log("Encoded message:", encodedMessage);
      console.log("Signature bytes:", signatureBytes);
      console.log("Public key bytes:", publicKeyBytes);
      
      // Verify the signature - correct parameter order: signature, message, publicKey
      const isValid = ed25519.verify(signatureBytes, encodedMessage, publicKeyBytes);
      
      console.log("Verification result:", isValid);
      
      setVerificationResult(isValid);
      
      if (isValid) {
        toast.success("✅ Signature verified successfully!");
      } else {
        toast.error("❌ Signature verification failed");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setVerificationResult(false);
      toast.error(`Verification error: ${error.message}`);
    } finally {
      setIsVerifying(false);
    }
  }

  const clearAll = () => {
    setMessage("");
    setSignature("");
    setVerificationResult(null);
  }

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Verify Signature</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to verify message signatures
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            Please connect your wallet to verify signatures
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6 p-6 max-w-2xl mx-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Verify Signature</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Verify if a signature was created by this wallet
        </p>
      </div>

      <div className="w-full space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Original Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter the original message that was signed..."
            className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     resize-none transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            {message.length} characters
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Signature (Hex)
          </label>
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
            placeholder="Paste the signature in hexadecimal format..."
            className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     resize-none font-mono text-sm transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            {signature.length} hex characters ({signature.length / 2} bytes)
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleVerifySignature}
            disabled={isVerifying || !message.trim() || !signature.trim()}
            className={`
              flex-1 px-6 py-3 font-semibold text-white rounded-lg shadow-lg
              transition-all duration-200 transform hover:scale-105
              ${isVerifying || !message.trim() || !signature.trim()
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hover:shadow-xl'
              }
              disabled:transform-none disabled:hover:scale-100
            `}
          >
            {isVerifying ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Verifying...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <span>Verify Signature</span>
              </div>
            )}
          </button>

          {(message || signature || verificationResult !== null) && (
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

      {verificationResult !== null && (
        <div className="w-full space-y-3">
          <div className={`rounded-lg p-4 ${
            verificationResult 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <span className={verificationResult ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {verificationResult ? '✅' : '❌'}
              </span>
              <span className={`font-medium ${
                verificationResult 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {verificationResult ? 'Signature Valid!' : 'Signature Invalid!'}
              </span>
            </div>
            <p className={`text-sm ${
              verificationResult 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-red-700 dark:text-red-300'
            }`}>
              {verificationResult 
                ? 'This signature was created by the connected wallet for this exact message.'
                : 'This signature was NOT created by the connected wallet, or the message is different.'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
