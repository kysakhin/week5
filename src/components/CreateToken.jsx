import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction
} from "@solana/spl-token";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { createInitializeInstruction } from "@solana/spl-token-metadata";

export function CreateToken() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [tokenForm, setTokenForm] = useState({
    name: "",
    symbol: "",
    description: "",
    image: "",
    decimals: 9,
    initialSupply: 1000000,
  });

  const [isCreating, setIsCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTokenForm(prev => ({
      ...prev,
      [name]: name === "decimals" || name === 'initialSupply' ? Number(value) : value
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const resetForm = () => {
    setTokenForm({
      name: "",
      symbol: "",
      description: "",
      image: "",
      decimals: 9,
      initialSupply: 1000000,
    });
    setCreatedToken(null);
    setTxHash(null);
    setError(null);
  };

  const createTokenMetadata = useCallback(() => {
    return {
      name: tokenForm.name,
      symbol: tokenForm.symbol,
      description: tokenForm.description,
      image: tokenForm.image || "https://placehold.co/600x400?text=Token",
      attributes: [],
      properties: {
        category: 'token',
      }
    };
  }, [tokenForm]);

  // Form validation
  const isFormValid = tokenForm.name.trim() && tokenForm.symbol.trim() && tokenForm.decimals >= 0 && tokenForm.decimals <= 9 && tokenForm.initialSupply > 0;

  const createToken22 = useCallback(async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first");
      setError("Wallet not connected");
      return;
    }

    if (!tokenForm.name || !tokenForm.symbol) {
      toast.error("Please provide both a name and a symbol for the token");
      setError("Name and symbol are required");
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      // Generate a new mint keypair
      const mintKeypair = Keypair.generate();

      // Create metadata JSON
      const metadata = createTokenMetadata();
      const metadataUri = "data:application/json;base64," + btoa(JSON.stringify(metadata));

      // Define extensions for the token (MetadataPointer for on-chain metadata)
      const extensions = [ExtensionType.MetadataPointer];

      // Calculate the space required for mint account with extensions
      const mintLen = getMintLen(extensions);

      // Get minimum balance for rent exemption
      const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

      // Create account instruction
      const createAccountIx = SystemProgram.createAccount({
        fromPubkey: publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      });

      // Initialize metadata pointer (points to the mint itself for on-chain metadata)
      const initMetadataPtrIx = createInitializeMetadataPointerInstruction(
        mintKeypair.publicKey, // mint
        publicKey, // authority
        mintKeypair.publicKey, // metadataAddress (points to mint for on-chain metadata)
        TOKEN_2022_PROGRAM_ID,
      );

      // Initialize mint
      const initMintIx = createInitializeMintInstruction(
        mintKeypair.publicKey, // mint
        tokenForm.decimals, // decimals
        publicKey, // mintAuthority
        publicKey, // freezeAuthority
        TOKEN_2022_PROGRAM_ID,
      );

      // Initialize on-chain metadata
      const initMetadataIx = createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        mint: mintKeypair.publicKey,
        metadata: mintKeypair.publicKey, // metadata stored on mint account
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadataUri,
        mintAuthority: publicKey,
        updateAuthority: publicKey,
      });

      // Create transaction
      const transaction = new Transaction().add(
        createAccountIx,
        initMetadataPtrIx,
        initMintIx,
        initMetadataIx,
      );

      // Get recent blockhash and set fee payer
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign with mint keypair (required for creating the mint account)
      transaction.partialSign(mintKeypair);

      // Request wallet to sign the transaction
      if (!signTransaction) {
        throw new Error("Wallet does not support transaction signing");
      }
      
      const signedTx = await signTransaction(transaction);
      
      if (!signedTx) {
        throw new Error("Failed to sign transaction - wallet may not support signing");
      }

      // Send and confirm the transaction
      const txid = await connection.sendRawTransaction(signedTx.serialize());
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction({
        signature: txid,
        blockhash: blockhash,
        lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log("Token created successfully:", {
        mintAddress: mintKeypair.publicKey.toString(),
        transaction: txid,
      });
      
      toast.success(`Token created successfully! Mint: ${mintKeypair.publicKey.toString()}`);
      setCreatedToken(mintKeypair.publicKey.toString());
      setTxHash(txid);

    } catch (error) {
      console.error("Token creation error:", error);
      const errorMessage = error.message || error.toString();
      toast.error(`Token creation failed: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [publicKey, connection, tokenForm, createTokenMetadata]);

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Token</h2>
            <p className="text-gray-600 mb-4">Connect your wallet to create a new token</p>
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Token</h1>
          <p className="text-gray-600 mb-8">Create your own SPL Token with metadata on Solana</p>

          <form onSubmit={(e) => { e.preventDefault(); createToken22(); }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Token Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={tokenForm.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g. My Token"
                  required
                />
              </div>

              <div>
                <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-2">
                  Token Symbol *
                </label>
                <input
                  type="text"
                  id="symbol"
                  name="symbol"
                  value={tokenForm.symbol}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g. MTK"
                  maxLength="10"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={tokenForm.description}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Describe your token..."
              />
            </div>

            <div>
              <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-2">
                Image URL
              </label>
              <input
                type="url"
                id="image"
                name="image"
                value={tokenForm.image}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="https://example.com/token-image.png"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="decimals" className="block text-sm font-medium text-gray-700 mb-2">
                  Decimals
                </label>
                <input
                  type="number"
                  id="decimals"
                  name="decimals"
                  value={tokenForm.decimals}
                  onChange={handleInputChange}
                  min="0"
                  max="9"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <p className="text-sm text-gray-500 mt-1">Number of decimal places (0-9)</p>
              </div>

              <div>
                <label htmlFor="initialSupply" className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Supply
                </label>
                <input
                  type="number"
                  id="initialSupply"
                  name="initialSupply"
                  value={tokenForm.initialSupply}
                  onChange={handleInputChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <div className="flex">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isCreating || !isFormValid}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                isCreating || !isFormValid
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
              }`}
            >
              {isCreating ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Token...
                </div>
              ) : (
                "Create Token"
              )}
            </button>
          </form>

          {createdToken && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-green-800 font-medium">Token Created Successfully!</h3>
                  
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="text-green-700 text-sm font-medium">Mint Address:</p>
                      <code className="text-green-800 text-sm bg-green-100 px-2 py-1 rounded break-all block">
                        {createdToken}
                      </code>
                    </div>
                    
                    {txHash && (
                      <div>
                        <p className="text-green-700 text-sm font-medium">Transaction:</p>
                        <code className="text-green-800 text-sm bg-green-100 px-2 py-1 rounded break-all block">
                          {txHash}
                        </code>
                        <a 
                          href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800 text-sm underline mt-1 inline-block"
                        >
                          View on Solana Explorer
                        </a>
                      </div>
                    )}
                    
                    <button 
                      onClick={resetForm}
                      className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      Create Another Token
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


