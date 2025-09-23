import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getTokenMetadata, getMint, createBurnInstruction, createMintToInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { toast } from "sonner";

export default function AllTokenBalances() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [tokenBalances, setTokenBalances] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [burnModal, setBurnModal] = useState({ isOpen: false, token: null });
  const [mintModal, setMintModal] = useState({ isOpen: false, token: null });
  const [burnAmount, setBurnAmount] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [isBurning, setIsBurning] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const openBurnModal = (token) => {
    setBurnModal({ isOpen: true, token });
    setBurnAmount('');
  };

  const openMintModal = (token) => {
    setMintModal({ isOpen: true, token });
    setMintAmount('');
  }

  const closeBurnModal = () => {
    setBurnModal({ isOpen: false, token: null });
    setBurnAmount('');
    setIsBurning(false);
  };

  const closeMintModal = () => {
    setMintModal({ isOpen: false, token: null });
    setMintAmount('');
    setIsMinting(false);
  }

  const burnToken = async () => {
    if (!publicKey || !burnModal.token || !burnAmount) {
      toast.error("Missing required information for burn operation");
      return;
    }

    const { mint, tokenAccount, decimals, programId } = burnModal.token;
    const burnAmountNum = parseFloat(burnAmount);

    if (burnAmountNum <= 0 || isNaN(burnAmountNum)) {
      toast.error("Please enter a valid burn amount");
      return;
    }

    if (burnAmountNum > burnModal.token.amount) {
      toast.error("Burn amount cannot exceed your token balance");
      return;
    }

    try {
      setIsBurning(true);
      
      const mintPubkey = new PublicKey(mint);
      const tokenAccountPubkey = new PublicKey(tokenAccount);
      const burnAmountInSmallestUnit = Math.floor(burnAmountNum * Math.pow(10, decimals));

      const transaction = new Transaction().add(
        createBurnInstruction(
          tokenAccountPubkey,
          mintPubkey,
          publicKey,
          burnAmountInSmallestUnit,
          [],
          programId
        )
      );

      const signature = await sendTransaction(transaction, connection);
      
      toast.success(`Successfully burned ${burnAmountNum} ${burnModal.token.symbol} tokens!`);
      closeBurnModal();
      
      // Refresh token balances
      window.location.reload();
      
    } catch (error) {
      console.error("Failed to burn tokens:", error);
      toast.error(`Failed to burn tokens: ${error.message}`);
    } finally {
      setIsBurning(false);
    }
  };

  const mintMoreTokens = async (mintAmount) => {
    if (!publicKey || !mintModal.token || !mintAmount) {
      toast.error("Missing required information for mint operation");
      return;
    }

    const { mint, decimals, programId } = mintModal.token;
    const mintAmountNum = parseFloat(mintAmount);

    if (mintAmountNum <= 0 || isNaN(mintAmountNum)) {
      toast.error("Please enter a valid mint amount");
      return;
    }

    if (mintAmountNum > 1000000) {
      toast.error("Mint amount cannot exceed 1,000,000 tokens at once");
      return;
    }

    try {
      setIsMinting(true);

      const mintPubkey = new PublicKey(mint);
      const mintAmountInSmallestUnit = Math.floor(mintAmountNum * Math.pow(10, decimals));

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        publicKey,
        false,
        programId
      );

      const transaction = new Transaction().add(
        createMintToInstruction(
          mintPubkey,
          ata,
          publicKey,
          mintAmountInSmallestUnit,
          [],
          programId
        )
      );

      const signature = await sendTransaction(transaction, connection);

      toast.success(`Successfully minted ${mintAmountNum} ${mintModal.token.symbol} tokens!`);
      closeMintModal();

      window.location.reload();
    } catch (error) {
      console.error("Failed to mint tokens:", error);
      toast.error(`Failed to mint tokens: ${error.message}`);
    } finally {
      setIsMinting(false);
    }
  }

  useEffect(() => {
    if (!publicKey) {
      setTokenBalances([]);
      return;
    }

    const fetchMintAuthority = async (mintAddress, programId) => {
      try {
        const mintInfo = await getMint(connection, new PublicKey(mintAddress), undefined, programId);
        return {
          mintAuthority: mintInfo.mintAuthority ? mintInfo.mintAuthority.toString() : null,
          supply: mintInfo.supply ? mintInfo.supply.toString() : '0',
          freezeAuthority: mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toString() : null,
        };
      } catch (error) {
        console.error("Failed to fetch mint info for", mintAddress, error);
        return {
          mintAuthority: null,
          supply: '0',
          freezeAuthority: null,
        };
      }
    }

    const fetchMetadataFromUri = async (uri) => {
      try {
        const response = await fetch(uri);
        if (!response.ok) return null;
        const metadata = await response.json();
        return metadata;
      } catch (error) {
        console.error("Failed to fetch metadata from URI:", uri, error);
        return null;
      }
    };

    const fetchMetadata = async (tokens) => {
      const tokenInfos = [];

      for (const token of tokens) {
        try {
          const mintPubkey = new PublicKey(token.mint);
          let metadata = null;
          let tokenInfo = {
            ...token,
            name: 'Unknown Token',
            symbol: 'N/A',
            uri: null,
            image: null,
            description: null,
            mintAuthority: null,
            supply: '0',
            freezeAuthority: null,
          };

          // Try to fetch mint info first to determine the program
          const mintInfo = await fetchMintAuthority(mintPubkey, token.programId || TOKEN_2022_PROGRAM_ID);
          tokenInfo = { ...tokenInfo, ...mintInfo };

          // Try to get metadata only for Token-2022 tokens
          if (token.programId === TOKEN_2022_PROGRAM_ID || !token.programId) {
            try {
              metadata = await getTokenMetadata(connection, mintPubkey);
              if (metadata) {
                tokenInfo.name = metadata.name || 'Unknown Token';
                tokenInfo.symbol = metadata.symbol || 'N/A';
                tokenInfo.uri = metadata.uri || null;
              }
            } catch (metadataError) {
              console.warn("No metadata found for token", token.mint, metadataError.message);
              // This is expected for tokens without metadata extension
            }
          }

          // If we have a URI, fetch the JSON metadata to get the image
          if (tokenInfo.uri) {
            try {
              const jsonMetadata = await fetchMetadataFromUri(tokenInfo.uri);
              if (jsonMetadata) {
                tokenInfo.image = jsonMetadata.image || null;
                tokenInfo.description = jsonMetadata.description || null;
                // Override name and symbol if they exist in JSON metadata
                if (jsonMetadata.name) tokenInfo.name = jsonMetadata.name;
                if (jsonMetadata.symbol) tokenInfo.symbol = jsonMetadata.symbol;
              }
            } catch (uriError) {
              console.warn("Failed to fetch metadata from URI", tokenInfo.uri, uriError);
            }
          }

          tokenInfos.push(tokenInfo);
        } catch (error) {
          console.error("Failed to fetch token metadata for", token.mint, error);
          tokenInfos.push({
            ...token,
            name: 'Unknown Token',
            symbol: 'N/A',
            uri: null,
            image: null,
            description: null,
            mintAuthority: null,
            supply: '0',
            freezeAuthority: null,
          });
        }
      }

      return tokenInfos;
    };

    const fetchTokenBalances = async () => {
      try {
        setIsLoading(true);
        
        // Fetch both Token-2022 and regular SPL tokens
        const [token2022Response, tokenResponse] = await Promise.allSettled([
          connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_2022_PROGRAM_ID }),
          connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })
        ]);

        let allBalances = [];

        // Process Token-2022 tokens
        if (token2022Response.status === 'fulfilled') {
          const token2022Balances = token2022Response.value.value.map(({ pubkey, account }) => {
            const parsedInfo = account.data.parsed.info;
            return {
              mint: parsedInfo.mint,
              tokenAccount: pubkey.toString(),
              amount: parsedInfo.tokenAmount.uiAmount,
              decimals: parsedInfo.tokenAmount.decimals,
              programId: TOKEN_2022_PROGRAM_ID,
            };
          });
          allBalances = [...allBalances, ...token2022Balances];
        }

        // Process regular SPL tokens  
        if (tokenResponse.status === 'fulfilled') {
          const splBalances = tokenResponse.value.value.map(({ pubkey, account }) => {
            const parsedInfo = account.data.parsed.info;
            return {
              mint: parsedInfo.mint,
              tokenAccount: pubkey.toString(),
              amount: parsedInfo.tokenAmount.uiAmount,
              decimals: parsedInfo.tokenAmount.decimals,
              programId: TOKEN_PROGRAM_ID,
            };
          });
          allBalances = [...allBalances, ...splBalances];
        }
        
        // Fetch metadata for all tokens
        const tokensWithMetadata = await fetchMetadata(allBalances);
        setTokenBalances(tokensWithMetadata);
      } catch (error) {
        console.error("Failed to fetch token balances:", error);
        setTokenBalances([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTokenBalances();
  }, [publicKey, connection]);

  if (!publicKey) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Token Balances</h2>
            <p className="text-gray-600 mb-4">Connect your wallet to view your token balances</p>
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
    <div className="h-full bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Network Indicator */}
        <div className="mb-4 text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div>
            Connected to Devnet
          </span>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <svg className="w-8 h-8 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Token Balances</h1>
                <p className="text-gray-600 mt-1">View all your SPL and Token-2022 assets</p>
              </div>
            </div>
            {tokenBalances.length > 0 && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Tokens</p>
                <p className="text-2xl font-bold text-blue-600">{tokenBalances.length}</p>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg className="animate-spin h-12 w-12 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 text-lg">Loading your token balances...</p>
              <p className="text-gray-500 text-sm mt-1">This may take a few moments</p>
            </div>
          ) : tokenBalances.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-24 h-24 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 mb-2">No tokens found</h3>
              <p className="text-gray-600 mb-6">
                You don't have any SPL or Token-2022 assets in this wallet yet.
              </p>
              <a 
                href="/create-token"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Your First Token
              </a>
            </div>
          ) : (
            <div className="grid gap-4">
              {tokenBalances.map(({ mint, tokenAccount, amount, decimals, name, symbol, image, description, mintAuthority, supply, freezeAuthority, programId }, index) => (
                <div key={tokenAccount} className="bg-gradient-to-r from-blue-50 to-purple-50 border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Token Image or Placeholder */}
                      <div className="w-16 h-16 flex-shrink-0">
                        {image ? (
                          <img 
                            src={image} 
                            alt={name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                            onError={(e) => {
                              // Fallback to gradient circle if image fails to load
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md ${image ? 'hidden' : 'flex'}`}
                        >
                          {symbol ? symbol.charAt(0).toUpperCase() : (index + 1)}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Token Name and Symbol */}
                        <div className="mb-4">
                          <h3 className="text-xl font-bold text-gray-900 mb-1">
                            {name}
                          </h3>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {symbol}
                            </span>
                            <span className="text-sm text-gray-500">
                              #{index + 1}
                            </span>
                          </div>
                          {description && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                              {description}
                            </p>
                          )}
                        </div>

                        <div className="mb-3">
                          <div className="flex items-center mb-2">
                            <svg className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Mint Address</span>
                          </div>
                          <code className="text-xs bg-white px-3 py-2 rounded border break-all block text-gray-800 font-mono">
                            {mint}
                          </code>
                          <a 
                            href={`https://explorer.solana.com/address/${mint}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-xs underline mt-1 inline-block"
                          >
                            View on Solana Explorer
                          </a>
                        </div>

                        <div className="mb-3">
                          <div className="flex items-center mb-2">
                            <svg className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Token Account</span>
                          </div>
                          <code className="text-xs bg-white px-3 py-2 rounded border break-all block text-gray-800 font-mono">
                            {tokenAccount}
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="text-right ml-4 flex-shrink-0">
                      <div className="bg-white rounded-lg p-4 border shadow-sm">
                        <p className="text-sm text-gray-500 mb-1">Balance</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {amount !== null ? amount.toLocaleString() : '0'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {symbol}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Decimals: {decimals}
                        </p>
                      </div>
                    <div>
                      {/* buttons for burning and minting more if mint authority is the same as current wallet */}
                      {mintAuthority === publicKey?.toString() && (
                        <div className="flex flex-col space-y-2 mt-4">
                          <div className="text-xs text-green-600 font-medium mb-2">
                            You own this token
                          </div>
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => openBurnModal({ mint, tokenAccount, amount, decimals, programId, symbol })} 
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm transition-colors"
                            >
                              Burn
                            </button>
                            <button 
                              onClick={() => openMintModal({ mint, tokenAccount, amount, decimals, programId, symbol })}
                              className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm transition-colors"
                            >
                              Mint More
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Burn Token Modal */}
      {burnModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Burn Tokens</h3>
              <button
                onClick={closeBurnModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {burnModal.token && (
              <>
                <div className="mb-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold">
                      {burnModal.token.symbol?.charAt(0) || 'T'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{burnModal.token.symbol || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">
                        Balance: {burnModal.token.amount?.toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex">
                      <svg className="w-5 h-5 text-yellow-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p className="text-yellow-800 text-sm">
                        <strong>Warning:</strong> Burning tokens permanently destroys them. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="burnAmount" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to Burn
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="burnAmount"
                      value={burnAmount}
                      onChange={(e) => setBurnAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      max={burnModal.token.amount || 0}
                      step="any"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-16"
                      disabled={isBurning}
                    />
                    <span className="absolute right-3 top-2 text-gray-500 text-sm">
                      {burnModal.token.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <button
                      onClick={() => setBurnAmount((burnModal.token.amount / 2).toString())}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      disabled={isBurning}
                    >
                      50%
                    </button>
                    <button
                      onClick={() => setBurnAmount(burnModal.token.amount?.toString() || '0')}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      disabled={isBurning}
                    >
                      Max
                    </button>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={closeBurnModal}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                    disabled={isBurning}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={burnToken}
                    disabled={isBurning || !burnAmount || parseFloat(burnAmount) <= 0}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isBurning || !burnAmount || parseFloat(burnAmount) <= 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {isBurning ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Burning...
                      </div>
                    ) : (
                      'Burn Tokens'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mint Token Modal */}
      {mintModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Mint Tokens</h3>
              <button
                onClick={closeMintModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {mintModal.token && (
              <>
                <div className="mb-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                      {mintModal.token.symbol?.charAt(0) || 'T'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{mintModal.token.symbol || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">
                        Current Balance: {mintModal.token.amount?.toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex">
                      <svg className="w-5 h-5 text-green-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-green-800 text-sm">
                        <strong>Info:</strong> You are the mint authority for this token. You can mint additional tokens to your wallet.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="mintAmount" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to Mint
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="mintAmount"
                      value={mintAmount}
                      onChange={(e) => setMintAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      max="1000000"
                      step="any"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-16"
                      disabled={isMinting}
                    />
                    <span className="absolute right-3 top-2 text-gray-500 text-sm">
                      {mintModal.token.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <button
                      onClick={() => setMintAmount('1000')}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      disabled={isMinting}
                    >
                      1K
                    </button>
                    <button
                      onClick={() => setMintAmount('10000')}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      disabled={isMinting}
                    >
                      10K
                    </button>
                    <button
                      onClick={() => setMintAmount('100000')}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      disabled={isMinting}
                    >
                      100K
                    </button>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={closeMintModal}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                    disabled={isMinting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => mintMoreTokens(mintAmount)}
                    disabled={isMinting || !mintAmount || parseFloat(mintAmount) <= 0}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isMinting || !mintAmount || parseFloat(mintAmount) <= 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isMinting ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Minting...
                      </div>
                    ) : (
                      'Mint Tokens'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
