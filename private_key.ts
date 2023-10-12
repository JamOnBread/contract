import { Lucid } from "https://deno.land/x/lucid@0.8.3/mod.ts";
 const lucid = await Lucid.new(undefined, "Preview");
 const ownerPrivateKey = lucid.utils.generatePrivateKey();
 const ownerAddress = await lucid
  .selectWalletFromPrivateKey(ownerPrivateKey)
  .wallet.address();


  console.log(ownerPrivateKey)