import "@solana/wallet-adapter-react-ui/styles.css";
import SolanaProvider from "./components/SolanaProvider";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "./components/Navbar";
import { Airdrop } from "./components/Airdrop";
import { OffchainSign } from "./components/OffchainSIgn";
import { VerifySign } from "./components/VerifySign";
import { Transfer } from "./components/Transfer";

export default function App() {
  return (
    <SolanaProvider>
      <div className="flex-col space-y-6 min-h-screen w-screen items-center justify-between">
        <Navbar />
        <Airdrop />
        <OffchainSign />
        <VerifySign />
        <Transfer />
      </div>
      <Toaster />
    </SolanaProvider>
  );
}


