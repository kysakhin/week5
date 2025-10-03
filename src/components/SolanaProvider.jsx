import { useMemo } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import "@solana/wallet-adapter-react-ui/styles.css"

export default function SolanaProvider({ children }) {
  const network = WalletAdapterNetwork.Devnet;
  const alchemyRpcUrl = import.meta.env.VITE_ALCHEMY_RPC_URL;
  
  // For now, always use devnet for wallet compatibility
  // You can switch to localhost when testing without wallet interactions
  const endpoint = useMemo(() => alchemyRpcUrl || clusterApiUrl(network), [alchemyRpcUrl, network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
