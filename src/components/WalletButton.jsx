import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <WalletMultiButton className="btn btn-ghost" />
        </TooltipTrigger>
        <TooltipContent>
          <p>Devnet only</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
