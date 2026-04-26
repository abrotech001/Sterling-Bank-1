// @ts-nocheck
import * as bip39 from "bip39";
import { ethers } from "ethers";
import * as bitcoin from "bitcoinjs-lib";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";
import { Keypair as SolKeypair } from "@solana/web3.js";
import { derivePath as solDerivePath } from "ed25519-hd-key";
import * as rippleKeypairs from "ripple-keypairs";
import crypto from "node:crypto";

const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

export interface GeneratedWallet {
  mnemonic: string;
  btcAddress: string;
  ethAddress: string;
  usdtAddress: string;
  solAddress: string;
  xrpAddress: string;
}

function deriveBtcAddress(seed: Buffer): string {
  const root = bip32.fromSeed(seed);
  const child = root.derivePath("m/84'/0'/0'/0/0");
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: bitcoin.networks.bitcoin,
  });
  if (!address) throw new Error("Failed to derive BTC address");
  return address;
}

function deriveEthAddress(seed: Buffer): string {
  const hdNode = ethers.HDNodeWallet.fromSeed(seed);
  const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
  return wallet.address;
}

function deriveSolAddress(seed: Buffer): string {
  const { key } = solDerivePath("m/44'/501'/0'/0'", seed.toString("hex"));
  const keypair = SolKeypair.fromSeed(key);
  return keypair.publicKey.toBase58();
}

function deriveXrpAddress(seed: Buffer): string {
  const root = bip32.fromSeed(seed);
  const child = root.derivePath("m/44'/144'/0'/0/0");
  const entropy = child.privateKey!.slice(0, 16) as unknown as Uint8Array;
  const xrpSeed = rippleKeypairs.generateSeed({ entropy, algorithm: "ecdsa-secp256k1" });
  const keypair = rippleKeypairs.deriveKeypair(xrpSeed);
  return rippleKeypairs.deriveAddress(keypair.publicKey);
}

export async function generateWallet(): Promise<GeneratedWallet> {
  const mnemonic = bip39.generateMnemonic(128);
  const seed = await bip39.mnemonicToSeed(mnemonic);

  const ethAddress = deriveEthAddress(seed);
  const btcAddress = deriveBtcAddress(seed);
  const solAddress = deriveSolAddress(seed);
  const xrpAddress = deriveXrpAddress(seed);

  return {
    mnemonic,
    btcAddress,
    ethAddress,
    usdtAddress: ethAddress,
    solAddress,
    xrpAddress,
  };
}

const SECRET = process.env.SESSION_SECRET || "fallback-secret-do-not-use-in-prod";
const KEY = crypto.createHash("sha256").update(SECRET).digest();

export function encryptMnemonic(mnemonic: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(mnemonic, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptMnemonic(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export const CRYPTO_RATES_USD: Record<string, number> = {
  btc: 67000,
  eth: 3500,
  usdt: 1,
  sol: 165,
  xrp: 0.55,
};

export const CRYPTO_NAMES: Record<string, string> = {
  btc: "Bitcoin",
  eth: "Ethereum",
  usdt: "Tether USD",
  sol: "Solana",
  xrp: "XRP",
};
