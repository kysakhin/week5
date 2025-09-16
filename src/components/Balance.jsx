import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";

export function Balance() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!publicKey) return;

    (async () => {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / 1e9);
    })();
  }, [publicKey, connection]);

  if (publicKey)
    return (
      <div>
        <h2>Balance</h2>
        {balance === null ? (
          <p>Loading...</p>
        ) : (
          <p>{balance} SOL</p>
        )}
      </div>
    );
}
