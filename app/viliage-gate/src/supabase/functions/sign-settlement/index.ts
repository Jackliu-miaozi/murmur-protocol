import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { privateKeyToAccount } from "npm:viem/accounts";

const settlementTypes = {
  Settlement: [
    { name: "users", type: "address[]" },
    { name: "deltas", type: "int256[]" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

const withdrawTypes = {
  Withdraw: [
    { name: "user", type: "address" },
    { name: "vpBurnAmount", type: "uint256" },
    { name: "vdotReturn", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

const mintTypes = {
  MintNFT: [
    { name: "minter", type: "address" },
    { name: "topicId", type: "uint256" },
    { name: "ipfsHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

const requireEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};

const buildDomain = (
  name: "MurmurVPToken" | "MurmurNFT",
  chainId: number,
  contractAddress: string,
) => ({
  name,
  version: "3",
  chainId,
  verifyingContract: contractAddress,
});

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const privateKey = requireEnv("OPERATOR_PRIVATE_KEY");
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const body = await req.json();

    const type = body?.type as string | undefined;
    if (!type) {
      return new Response("Missing type", { status: 400 });
    }

    if (type === "SETTLEMENT") {
      const { users, deltas, nonce, chainId, contractAddress } = body;
      const domain = buildDomain("MurmurVPToken", Number(chainId), contractAddress);
      const signature = await account.signTypedData({
        domain,
        types: settlementTypes,
        primaryType: "Settlement",
        message: {
          users,
          deltas: (deltas ?? []).map((value: string) => BigInt(value)),
          nonce: BigInt(nonce),
        },
      });

      return Response.json({ signature });
    }

    if (type === "WITHDRAW") {
      const { user, vpBurnAmount, vdotReturn, nonce, chainId, contractAddress } = body;
      const domain = buildDomain("MurmurVPToken", Number(chainId), contractAddress);
      const signature = await account.signTypedData({
        domain,
        types: withdrawTypes,
        primaryType: "Withdraw",
        message: {
          user,
          vpBurnAmount: BigInt(vpBurnAmount),
          vdotReturn: BigInt(vdotReturn),
          nonce: BigInt(nonce),
        },
      });

      return Response.json({ signature });
    }

    if (type === "MINT_NFT") {
      const { minter, topicId, ipfsHash, nonce, chainId, contractAddress } = body;
      const domain = buildDomain("MurmurNFT", Number(chainId), contractAddress);
      const signature = await account.signTypedData({
        domain,
        types: mintTypes,
        primaryType: "MintNFT",
        message: {
          minter,
          topicId: BigInt(topicId),
          ipfsHash,
          nonce: BigInt(nonce),
        },
      });

      return Response.json({ signature });
    }

    return new Response("Unsupported type", { status: 400 });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
