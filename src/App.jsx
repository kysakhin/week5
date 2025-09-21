import "@solana/wallet-adapter-react-ui/styles.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SolanaProvider from "./components/SolanaProvider";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "./components/Navbar";
import { Airdrop } from "./components/Airdrop";
import { OffchainSign } from "./components/OffchainSIgn";
import { VerifySign } from "./components/VerifySign";
import { Transfer } from "./components/Transfer";
import { CreateToken } from "./components/CreateToken";
import { Home } from "./components/Home";

export default function App() {
  return (
    <SolanaProvider>
      <Router>
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
          <Navbar />
          <main className="flex-1 container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/airdrop" element={<Airdrop />} />
              <Route path="/sign" element={<OffchainSign />} />
              <Route path="/verify" element={<VerifySign />} />
              <Route path="/transfer" element={<Transfer />} />
              <Route path="/create-token" element={<CreateToken />} />
            </Routes>
          </main>
        </div>
        <Toaster />
      </Router>
    </SolanaProvider>
  );
}
