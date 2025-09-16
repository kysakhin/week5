import { Balance } from "./Balance";
import { WalletButton } from "./WalletButton";

export function Navbar() {
  return (
    <div className="w-full flex items-center justify-between p-4">
      <h1 className="text-2xl font-bold">My Solana App</h1>
      <div className="flex items-center gap-4">
        <WalletButton />
        <Balance />
      </div>
    </div>
  );
}
