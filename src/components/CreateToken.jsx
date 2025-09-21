import { useState, useCallback, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata";

export function CreateToken() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [tokenForm, setTokenForm] = useState({
    name: "",
    symbol: "",
    description: "",
    metadataUri: "",
    decimals: 9,
    initialSupply: 1000000,
  });

  const [isCreating, setIsCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [balance, setBalance] = useState(null);

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
      metadataUri: "",
      decimals: 9,
      initialSupply: 1000000,
    });
    setCreatedToken(null);
    setTxHash(null);
    setError(null);
  };

  // Form validation
  const isFormValid = tokenForm.name.trim() && tokenForm.symbol.trim() && tokenForm.decimals >= 0 && tokenForm.decimals <= 9 && tokenForm.initialSupply > 0;

  // Fetch balance on component mount and when wallet connects
  useEffect(() => {
    const fetchBalance = async () => {
      if (publicKey && connected) {
        try {
          const bal = await connection.getBalance(publicKey);
          setBalance(bal);
        } catch (error) {
          setBalance(null);
        }
      } else {
        setBalance(null);
      }
    };

    fetchBalance();
  }, [publicKey, connected, connection]);

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

      // Check current balance first
      const balance = await connection.getBalance(publicKey);
      const balanceInSOL = balance / 1000000000;
      
      if (balance === 0) {
        throw new Error(`Insufficient balance. Current balance: ${balanceInSOL} SOL. Please get some devnet SOL from a faucet.`);
      }

      // Generate a new mint keypair
      const mintKeypair = Keypair.generate();

      // Create metadata object
      const metadata = {
        mint: mintKeypair.publicKey,
        name: tokenForm.name,
        symbol: tokenForm.symbol,
        uri: tokenForm.metadataUri || 'https://cdn.100xdevs.com/metadata.json',
        additionalMetadata: [],
      };

      // Calculate space requirements
      const mintLen = getMintLen([ExtensionType.MetadataPointer]);
      const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

      // Get minimum balance for rent exemption
      const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

      // Create the token creation transaction
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: mintLen,
          lamports,
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeMetadataPointerInstruction(
          mintKeypair.publicKey, 
          publicKey, 
          mintKeypair.publicKey, 
          TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMintInstruction(
          mintKeypair.publicKey, 
          tokenForm.decimals, 
          publicKey, 
          null, 
          TOKEN_2022_PROGRAM_ID
        ),
        createInitializeInstruction({
          programId: TOKEN_2022_PROGRAM_ID,
          mint: mintKeypair.publicKey,
          metadata: mintKeypair.publicKey,
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadata.uri,
          mintAuthority: publicKey,
          updateAuthority: publicKey,
        }),
      );

      transaction.feePayer = publicKey;
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.partialSign(mintKeypair);

      // Send the token creation transaction
      const txid = await sendTransaction(transaction, connection);
      
      toast.success(`Token created successfully! Mint: ${mintKeypair.publicKey.toString()}`);
      setCreatedToken(mintKeypair.publicKey.toString());
      setTxHash(txid);

      // Create associated token account
      const associatedToken = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const transaction2 = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          associatedToken,
          publicKey,
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID,
        ),
      );

      await sendTransaction(transaction2, connection);

      // Mint initial supply to the creator
      if (tokenForm.initialSupply > 0) {
        const mintAmount = tokenForm.initialSupply * Math.pow(10, tokenForm.decimals);
        const transaction3 = new Transaction().add(
          createMintToInstruction(
            mintKeypair.publicKey, 
            associatedToken, 
            publicKey, 
            mintAmount, 
            [], 
            TOKEN_2022_PROGRAM_ID
          )
        );

        await sendTransaction(transaction3, connection);
        toast.success(`Minted ${tokenForm.initialSupply} tokens to your wallet!`);
      }

    } catch (error) {
      let errorMessage = error.message || error.toString();
      
      // Handle specific Solana transaction errors
      if (error.name === 'SendTransactionError') {
        try {
          const logs = await error.getLogs();
          errorMessage = `Transaction failed. Check console for detailed logs. Error: ${error.message}`;
        } catch (logError) {
          // Ignore log error
        }
      }
      
      // Handle blockhash expiration
      if (errorMessage.includes('Blockhash not found') || errorMessage.includes('blockhash')) {
        errorMessage = "Transaction failed due to expired blockhash. This is usually a network timing issue. Please try again.";
      }
      
      toast.error(`Token creation failed: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [publicKey, connection, tokenForm, sendTransaction]);

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
        {/* Network Indicator */}
        <div className="mb-4 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div>
            Connected to Devnet
          </span>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Token</h1>
              <p className="text-gray-600">Create your own SPL Token with metadata on Solana</p>
            </div>
            
            {balance !== null && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Current Balance</p>
                <p className="text-lg font-semibold text-gray-900">
                  {(balance / 1000000000).toFixed(6)} SOL
                </p>
                <p className="text-xs text-gray-400">
                  ({balance.toLocaleString()} lamports)
                </p>
              </div>
            )}
          </div>

          {balance !== null && balance < 10000000 && ( // Less than 0.01 SOL
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex">
                <svg className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-yellow-800 font-medium">Low Balance Warning</h3>
                  <p className="text-yellow-700 text-sm mt-1">
                    Your balance is very low. Creating a token requires approximately 0.002-0.003 SOL for rent exemption and fees.
                    <br />
                    <a 
                      href="https://faucet.solana.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-yellow-900"
                    >
                      Get devnet SOL from the faucet
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}

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
              <label htmlFor="metadataUri" className="block text-sm font-medium text-gray-700 mb-2">
                Metadata URI
              </label>
              <input
                type="url"
                id="metadataUri"
                name="metadataUri"
                value={tokenForm.metadataUri}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="https://example.com/metadata.json"
              />
              <p className="text-sm text-gray-500 mt-1">
                URL to a JSON file containing token metadata (name, description, image, etc.)
              </p>
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


