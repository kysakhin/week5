import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";

export function Home() {
  const { connected, publicKey } = useWallet();

  const features = [
    {
      path: "/airdrop",
      title: "Request SOL Airdrop",
      description: "Get free SOL tokens for testing on Devnet",
      icon: "💰",
      color: "from-green-500 to-emerald-600"
    },
    {
      path: "/sign",
      title: "Sign Messages",
      description: "Sign off-chain messages to prove wallet ownership",
      icon: "✍️",
      color: "from-blue-500 to-indigo-600"
    },
    {
      path: "/verify",
      title: "Verify Signatures",
      description: "Verify message signatures using Ed25519 cryptography",
      icon: "✅",
      color: "from-purple-500 to-violet-600"
    },
    {
      path: "/transfer",
      title: "Transfer SOL",
      description: "Send SOL tokens to any Solana address",
      icon: "💸",
      color: "from-orange-500 to-red-600"
    },
    {
      path: "/create-token",
      title: "Create Token",
      description: "Create your own SPL token with metadata on Solana",
      icon: "🪙",
      color: "from-pink-500 to-rose-600"
    }
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
          <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Solana Wallet
          </span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto">
          A comprehensive Solana wallet interface for airdrops, message signing, signature verification, and SOL transfers
        </p>
        
        {/* Connection Status */}
        <div className="inline-flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {connected ? 'Wallet Connected' : 'Wallet Disconnected'}
            </span>
          </div>
          {connected && publicKey && (
            <>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
              <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-12">
        {features.map((feature) => (
          <Link
            key={feature.path}
            to={feature.path}
            className="group block"
          >
            <div className="h-full p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 group-hover:shadow-lg group-hover:scale-105">
              <div className="flex items-start space-x-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
                <div className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                  →
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* CTA Section */}
      {!connected && (
        <div className="mt-12 text-center p-8 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Get Started?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Connect your Solana wallet to begin using all features
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-500">
            Click "Select Wallet" in the top right corner to begin
          </div>
        </div>
      )}
    </div>
  );
}