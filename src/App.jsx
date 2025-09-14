import "@solana/wallet-adapter-react-ui/styles.css";
import SolanaProvider from "./components/SolanaProvider";

export default function App() {
  return (
    <SolanaProvider>
      <h1>Solana + Vite!</h1>
    </SolanaProvider>
  );
}
