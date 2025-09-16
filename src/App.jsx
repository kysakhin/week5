import "@solana/wallet-adapter-react-ui/styles.css";
import SolanaProvider from "./components/SolanaProvider";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "./components/Navbar";
import { Airdrop } from "./components/Airdrop";
import { OffchainSign } from "./components/OffchainSIgn";

export default function App() {
  return (
    <SolanaProvider>
      <div className="flex-col min-h-screen w-screen items-center justify-between">
        <Navbar />
        <Airdrop />
        <OffchainSign />
      </div>
      <Toaster />
    </SolanaProvider>
  );
}


