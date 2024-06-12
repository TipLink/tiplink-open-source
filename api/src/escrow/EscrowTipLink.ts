import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import { Mint, getMint, getAssociatedTokenAddress } from "@solana/spl-token";
import { Program, BN } from "@coral-xyz/anchor";

import { IDL, TiplinkEscrow } from "./anchor-generated/types/tiplink_escrow";
import {
  ESCROW_PROGRAM_ID,
  TREASURY_PUBLIC_KEY,
  PDA_SEED,
  DEPOSIT_URL_BASE,
} from "./constants";
import { createReceiverTipLink, getReceiverEmail } from "../enclave";

interface CreateWithReceiverArgs {
  connection: Connection;
  amount: number;
  toEmail: string;
  depositor: PublicKey;
  receiverTipLink: PublicKey;
  mint?: Mint;
  depositorTa?: PublicKey;
  allowDepositorOffCurve?: boolean;
}

interface CreateWithApiArgs {
  connection: Connection;
  amount: number;
  toEmail: string;
  depositor: PublicKey;
  apiKey: string;
  mint?: Mint;
  depositorTa?: PublicKey;
  allowDepositorOffCurve?: boolean;
}

interface GetaWithReceiverArgs {
  connection: Connection;
  pda: PublicKey;
  receiverEmail: string;
}

interface GetWithApiArgs {
  connection: Connection;
  pda: PublicKey;
  apiKey: string;
}

export async function getEscrowReceiverTipLink(
  connection: Connection,
  pda: PublicKey,
): Promise<PublicKey | undefined> {
  const escrowProgram = new Program(
    IDL,
    ESCROW_PROGRAM_ID,
    { connection }, // Provider interface only requires a connection, not a wallet
  );

  let pdaAccount;
  // TODO: Implement better method of deciphering between lamport and SPL PDAs
  try {
    // First see if it's a lamport escrow
    pdaAccount = await escrowProgram.account.escrowLamports.fetch(pda);
  } catch {
    try {
      // If not, see if it's a SPL escrow
      pdaAccount = await escrowProgram.account.escrowSpl.fetch(pda);
    } catch {
      // No escrow exists for this PDA
      // TODO: Provide info on whether it was withdrawn or never existed
      return undefined;
    }
  }

  return pdaAccount.tiplink;
}

/**
 * Represents an on-chain escrow that can be withdrawn by the original depositor or a TipLink, e-mailed to a recipient.
 * The depositor does not see the TipLink, enabling multi-sig. (Otherwise, one signer could unilaterally withdraw the funds to themselves.)
 *
 * @remarks EscrowTipLinks currently only support SOL and SPL assets.
 */
export class EscrowTipLink {
  // Required
  toEmail: string;
  receiverTipLink: PublicKey;
  amount: number;
  depositor: PublicKey;
  escrowId: PublicKey;
  pda: PublicKey;

  // Optional
  mint?: Mint;
  depositorTa?: PublicKey;

  get depositorUrl(): URL {
    // Sanity check; error checking occurs in the enclave and on-chain program
    if (!this.pda) {
      throw new Error(
        "Attempted to get depositorUrl from a non-deposited escrow.",
      );
    }

    const urlStr =
      typeof process === "undefined"
        ? DEPOSIT_URL_BASE
        : process?.env?.NEXT_PUBLIC_ESCROW_DEPOSITOR_URL_OVERRIDE ??
          DEPOSIT_URL_BASE;
    const url = new URL(urlStr);
    url.searchParams.append("pda", this.pda.toString());

    return url;
  }

  private constructor(
    toEmail: string,
    receiverTipLink: PublicKey,
    amount: number,
    depositor: PublicKey,
    escrowId: PublicKey,
    pda: PublicKey,
    mint?: Mint,
    depositorTa?: PublicKey,
  ) {
    this.toEmail = toEmail;
    this.receiverTipLink = receiverTipLink;
    this.amount = amount;
    this.depositor = depositor;
    this.escrowId = escrowId;
    this.pda = pda;
    this.mint = mint;
    this.depositorTa = depositorTa;
  }

  /**
   * Creates an EscrowTipLink instance to be deposited.
   *
   * @param {PublicKey} depositorTa - Overrides for non-ATA cases
   */
  static async create(
    args: CreateWithReceiverArgs | CreateWithApiArgs,
  ): Promise<EscrowTipLink> {
    const {
      connection,
      amount,
      toEmail,
      depositor,
      mint,
      depositorTa,
      allowDepositorOffCurve,
    } = args;

    let { receiverTipLink } = args as CreateWithReceiverArgs;
    const { apiKey } = args as CreateWithApiArgs;

    if (!receiverTipLink) {
      receiverTipLink = await createReceiverTipLink(apiKey, toEmail);
    }

    const tiplinkEscrowProgram = new Program(
      IDL,
      ESCROW_PROGRAM_ID,
      { connection }, // Provider interface only requires a connection, not a wallet
    );
    const escrowKeypair = Keypair.generate();
    const escrowId = escrowKeypair.publicKey;
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(PDA_SEED), escrowId.toBuffer(), depositor.toBuffer()],
      tiplinkEscrowProgram.programId,
    );

    let dTa = depositorTa;
    if (!dTa && mint) {
      dTa = await getAssociatedTokenAddress(
        mint.address,
        depositor,
        !!allowDepositorOffCurve,
      );
    }

    return new EscrowTipLink(
      toEmail,
      receiverTipLink,
      amount,
      depositor,
      escrowId,
      pda,
      mint,
      dTa,
    );
  }

  /**
   * Creates an EscrowTipLink instance from a deposited, on-chain escrow.
   */
  static async get(
    args: GetaWithReceiverArgs | GetWithApiArgs,
  ): Promise<EscrowTipLink | undefined> {
    const { connection, pda } = args;
    let { receiverEmail } = args as GetaWithReceiverArgs;
    const { apiKey } = args as GetWithApiArgs;

    const escrowProgram = new Program(
      IDL,
      ESCROW_PROGRAM_ID,
      { connection }, // Provider interface only requires a connection, not a wallet
    );

    let pdaAccount;
    let mint: Mint | undefined;
    // TODO: Implement better method of deciphering between lamport and SPL PDAs
    try {
      // First see if it's a lamport escrow
      pdaAccount = await escrowProgram.account.escrowLamports.fetch(pda);
    } catch {
      try {
        // If not, see if it's a SPL escrow
        pdaAccount = await escrowProgram.account.escrowSpl.fetch(pda);
        const mintPublicKey = pdaAccount.mint as PublicKey;
        mint = await getMint(connection, mintPublicKey);
      } catch {
        // No escrow exists for this PDA
        // TODO: Provide info on whether it was withdrawn or never existed
        return undefined;
      }
    }

    const receiverTipLink = pdaAccount.tiplink;
    if (!receiverEmail) {
      receiverEmail = await getReceiverEmail(apiKey, receiverTipLink);
    }

    // NOTE: We aren't able to deterministically get depositor TA from here
    // because it might have been overriden and not ATA. The chain history
    // has it if needed.

    return new EscrowTipLink(
      receiverEmail,
      receiverTipLink,
      pdaAccount.amount.toNumber(),
      pdaAccount.depositor,
      pdaAccount.escrowId,
      pda,
      mint,
    );
  }

  private async depositLamportTx(
    tiplinkEscrowProgram: Program<TiplinkEscrow>,
    escrowId: PublicKey,
    pda: PublicKey,
  ): Promise<Transaction> {
    const tx = await tiplinkEscrowProgram.methods
      .initializeLamport(new BN(this.amount.toString()), escrowId)
      .accounts({
        depositor: this.depositor,
        pda,
        treasury: TREASURY_PUBLIC_KEY,
        tiplink: this.receiverTipLink,
      })
      .transaction();

    return tx;
  }

  private async depositSplTx(
    tiplinkEscrowProgram: Program<TiplinkEscrow>,
    escrowId: PublicKey,
    pda: PublicKey,
  ): Promise<Transaction> {
    // Sanity check; error checking occurs in the enclave and on-chain program
    if (!this.mint) {
      throw new Error("Attempted to deposit SPL without mint set");
    }
    if (!this.depositorTa) {
      throw new Error("Attempted to deposit SPL without depositorTa set");
    }

    const pdaAta = await getAssociatedTokenAddress(
      this.mint.address,
      pda,
      true,
    );

    const tx = await tiplinkEscrowProgram.methods
      .initializeSpl(new BN(this.amount.toString()), escrowId)
      .accounts({
        depositor: this.depositor,
        depositorTa: this.depositorTa,
        pda,
        pdaAta,
        tiplink: this.receiverTipLink,
        treasury: TREASURY_PUBLIC_KEY, // TODO: Switch to mainnet address
        mint: this.mint.address,
      })
      .transaction();

    return tx;
  }

  async depositTx(connection: Connection): Promise<Transaction> {
    const tiplinkEscrowProgram = new Program(
      IDL,
      ESCROW_PROGRAM_ID,
      { connection }, // Provider interface only requires a connection, not a wallet
    );

    const tx: Transaction = this.mint
      ? await this.depositSplTx(tiplinkEscrowProgram, this.escrowId, this.pda)
      : await this.depositLamportTx(
          tiplinkEscrowProgram,
          this.escrowId,
          this.pda,
        );
    return tx;
  }

  private async withdrawLamportTx(
    tiplinkEscrowProgram: Program<TiplinkEscrow>,
    authority: PublicKey,
    dest: PublicKey,
  ): Promise<Transaction> {
    const tx = await tiplinkEscrowProgram.methods
      .withdrawLamport()
      .accounts({
        authority,
        destination: dest,
        pda: this.pda,
      })
      .transaction();

    return tx;
  }

  private async withdrawSplTx(
    tiplinkEscrowProgram: Program<TiplinkEscrow>,
    authority: PublicKey,
    dest: PublicKey,
    allowDestOffCurve = false,
  ): Promise<Transaction> {
    // Sanity check; error checking occurs in the enclave and on-chain program
    if (!this.mint) {
      throw new Error("Attempted to withdraw SPL without mint set");
    }

    // Recalculating to keep class state smaller
    const pdaAta = await getAssociatedTokenAddress(
      this.mint.address,
      this.pda,
      true,
    );

    // TODO: Support non-ATA
    const destAta = await getAssociatedTokenAddress(
      this.mint.address,
      dest,
      allowDestOffCurve,
    );

    const tx = await tiplinkEscrowProgram.methods
      .withdrawSpl()
      .accounts({
        authority,
        destination: dest,
        destinationAta: destAta,
        pda: this.pda,
        pdaAta,
        mint: this.mint.address,
      })
      .transaction();

    return tx;
  }

  /**
   * @param {PublicKey} dest - The owner account, *not* the token account (if an SPL escrow)
   * @param {boolean} allowDestOffCurve - Allow calculated ATA to be off-curve (if an SPL escrow)
   */
  async withdrawTx(
    connection: Connection,
    authority: PublicKey,
    dest: PublicKey,
    allowDestOffCurve = false,
  ): Promise<Transaction> {
    const tiplinkEscrowProgram = new Program(
      IDL,
      ESCROW_PROGRAM_ID,
      { connection }, // Provider interface only requires a connection, not a wallet
    );

    if (this.mint) {
      return this.withdrawSplTx(
        tiplinkEscrowProgram,
        authority,
        dest,
        allowDestOffCurve,
      );
    }
    return this.withdrawLamportTx(tiplinkEscrowProgram, authority, dest);
  }
}
