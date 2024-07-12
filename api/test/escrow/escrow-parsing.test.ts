import { Connection } from "@solana/web3.js";
import {
  parseEscrowTx,
  EscrowActionType,
  EscrowActionDepositLamport,
  EscrowActionWithdrawLamport,
  EscrowActionDepositSpl,
  EscrowActionWithdrawSpl,
  serializeRecordedEscrowActions,
  deserializeRecordedEscrowActions,
} from "../../src";

// TODO: Squads Withdraw SPL test
// TODO: Check amounts, mints

test("Parse and serialize regular desposit lamport escrow tiplink", async () => {
  const sig =
    "5dkMBTQjpSpfs7D6Jmhfu1acC5xK6PimC9AxMEJdEtLRsiPTZpGHDyabGH2L9ZihRz3rAUKCAHSMh3anCZeMei3o";

  const connection = new Connection(
    process.env.SOLANA_MAINNET_RPC as string,
    "confirmed"
  );

  const recordedActions = await parseEscrowTx(connection, sig);
  expect(recordedActions.length).toBe(1);
  expect(recordedActions[0].txSig).toBe(sig);
  expect(recordedActions[0].ixIndex).toBe(2);
  expect(recordedActions[0].innerIxIndex).toBeUndefined();
  expect(recordedActions[0].action.type).toBe(EscrowActionType.DepositLamport);
  const action = recordedActions[0].action as EscrowActionDepositLamport;
  expect(action.depositor.toBase58()).toBe(
    "4AE2eTqnEDNe3m9cXRU7GFd5x8LNeyJBfBRzMPbxjhcQ"
  );
  expect(action.pda.toBase58()).toBe(
    "4bb8TG2hfTUeirwikLXJnDgFWLZGM1f12Fm4aQARu43M"
  );
  expect(action.receiverTipLink.toBase58()).toBe(
    "5jx7ijp3wj84bgTB5cLcpfkzcNAjdRe9GWavtkGXSaN7"
  );

  // Serialize and deserialize
  const serialized = serializeRecordedEscrowActions(recordedActions);
  const deserialized = await deserializeRecordedEscrowActions(
    connection,
    serialized
  );
  expect(deserialized).toStrictEqual(recordedActions);
});

test("Parse and serialize regular claimback lamport escrow tiplink", async () => {
  const sig =
    "3MQefu7PKSzGGzJsVsqKdL9Ao2CWFesM2y6AyM9xyWZFkxPrspPsqZyXcxCugP268EgiTBHjQ2sX7cYAXcS6rVD2";

  const connection = new Connection(
    process.env.SOLANA_MAINNET_RPC as string,
    "confirmed"
  );

  const recordedActions = await parseEscrowTx(connection, sig);
  expect(recordedActions.length).toBe(1);
  expect(recordedActions[0].txSig).toBe(sig);
  expect(recordedActions[0].ixIndex).toBe(2);
  expect(recordedActions[0].innerIxIndex).toBeUndefined();
  expect(recordedActions[0].action.type).toBe(EscrowActionType.WithdrawLamport);
  const action = recordedActions[0].action as EscrowActionWithdrawLamport;
  expect(action.authority.toBase58()).toBe(
    "4AE2eTqnEDNe3m9cXRU7GFd5x8LNeyJBfBRzMPbxjhcQ"
  );
  expect(action.pda.toBase58()).toBe(
    "4bb8TG2hfTUeirwikLXJnDgFWLZGM1f12Fm4aQARu43M"
  );
  expect(action.destination.toBase58()).toBe(
    "4AE2eTqnEDNe3m9cXRU7GFd5x8LNeyJBfBRzMPbxjhcQ"
  );

  // Serialize and deserialize
  const serialized = serializeRecordedEscrowActions(recordedActions);
  const deserialized = await deserializeRecordedEscrowActions(
    connection,
    serialized
  );
  expect(deserialized).toStrictEqual(recordedActions);
});

test("Parse and serialize regular SPL desposit SPL escrow tiplink", async () => {
  const sig =
    "J4zfXbWWLEZ2HNqh32phYYW87bSxr7yA2J4cfK6FCKw2hr8ko8UyVHcXc9LR3Dehkk7DSxrkDcgyTyZ7EghHYcd";

  const connection = new Connection(
    process.env.SOLANA_MAINNET_RPC as string,
    "confirmed"
  );

  const recordedActions = await parseEscrowTx(connection, sig);
  expect(recordedActions.length).toBe(1);
  expect(recordedActions[0].txSig).toBe(sig);
  expect(recordedActions[0].ixIndex).toBe(2);
  expect(recordedActions[0].innerIxIndex).toBeUndefined();
  expect(recordedActions[0].action.type).toBe(EscrowActionType.DepositSpl);
  const action = recordedActions[0].action as EscrowActionDepositSpl;
  expect(action.depositor.toBase58()).toBe(
    "4AE2eTqnEDNe3m9cXRU7GFd5x8LNeyJBfBRzMPbxjhcQ"
  );
  expect(action.pda.toBase58()).toBe(
    "ES1sHU1Lk3nDTVZvi2roJAP3e9B2zqF927asyjbHFP4A"
  );
  expect(action.receiverTipLink.toBase58()).toBe(
    "EsJevVxaU53rAZGtCWELFBZFAvxKbuNjXQJaUkkh47WR"
  );

  // Serialize and deserialize
  const serialized = serializeRecordedEscrowActions(recordedActions);
  const deserialized = await deserializeRecordedEscrowActions(
    connection,
    serialized
  );
  expect(deserialized).toStrictEqual(recordedActions);
});

test("Parse and serialize regular claimback SPL escrow tiplink", async () => {
  const sig =
    "3WiCMDSVdm93YnaUPjQyXD1DYZfgj3ippqto6h22np1ZzgBzNosqjhouw2ybu4Ma71atWXwDjDNHAeDroBjXEBE8";

  const connection = new Connection(
    process.env.SOLANA_MAINNET_RPC as string,
    "confirmed"
  );

  const recordedActions = await parseEscrowTx(connection, sig);
  expect(recordedActions.length).toBe(1);
  expect(recordedActions[0].txSig).toBe(sig);
  expect(recordedActions[0].ixIndex).toBe(2);
  expect(recordedActions[0].innerIxIndex).toBeUndefined();
  expect(recordedActions[0].action.type).toBe(EscrowActionType.WithdrawSpl);
  const action = recordedActions[0].action as EscrowActionWithdrawSpl;
  expect(action.authority.toBase58()).toBe(
    "EsJevVxaU53rAZGtCWELFBZFAvxKbuNjXQJaUkkh47WR" // Receiver TipLink
  );
  expect(action.pda.toBase58()).toBe(
    "ES1sHU1Lk3nDTVZvi2roJAP3e9B2zqF927asyjbHFP4A"
  );
  expect(action.destination.toBase58()).toBe(
    "4AE2eTqnEDNe3m9cXRU7GFd5x8LNeyJBfBRzMPbxjhcQ"
  );

  // Serialize and deserialize
  const serialized = serializeRecordedEscrowActions(recordedActions);
  const deserialized = await deserializeRecordedEscrowActions(
    connection,
    serialized
  );
  expect(deserialized).toStrictEqual(recordedActions);
});

// Multi-sig test with CPIs (innerInstructions)
test("Parse and serialize Squads deposit lamport escrow tiplink", async () => {
  const sig =
    "2jj9YmCRRrhiJG2Cndd8krTXHk7t7q2sKYSmPwKoScQfVL55uPb8X7NcK3kLUvBMqksetxFjKgEBpZamxrfvwKdK";

  const connection = new Connection(
    process.env.SOLANA_MAINNET_RPC as string,
    "confirmed"
  );

  const recordedActions = await parseEscrowTx(connection, sig);
  expect(recordedActions.length).toBe(1);
  expect(recordedActions[0].txSig).toBe(sig);
  expect(recordedActions[0].ixIndex).toBe(3);
  expect(recordedActions[0].innerIxIndex).toBe(0);
  const action = recordedActions[0].action as EscrowActionDepositLamport;
  expect(action.depositor.toBase58()).toBe(
    "4iud6muHzqkmef4CBeJNpFGJ3k6QZJ2o3MtXxGC718QC"
  );
  expect(action.pda.toBase58()).toBe(
    "4n5rvJmAxmdSVzd8SnaBTJvA78bpTUHrQ7PeKTxrfRpM"
  );
  expect(action.receiverTipLink.toBase58()).toBe(
    "Gda2G1juSzFKRJtk121AB6HJmZDMTg5XXHfDUbDBT4aE"
  );

  // Serialize and deserialize
  const serialized = serializeRecordedEscrowActions(recordedActions);
  const deserialized = await deserializeRecordedEscrowActions(
    connection,
    serialized
  );
  expect(deserialized).toStrictEqual(recordedActions);
});

// Multi-sig test with CPIs (innerInstructions)
test("Parse and serialize Squads claimback lamport escrow tiplink", async () => {
  const sig =
    "3phKmsZJ35sGJF91BV8hZBQtcrwJNU2Nb5HfrmkB5oTdMqv7jSSudF2nWek4UZafsKG8xP4SASwqShz5VuGanvvV";

  const connection = new Connection(
    process.env.SOLANA_MAINNET_RPC as string,
    "confirmed"
  );

  const recordedActions = await parseEscrowTx(connection, sig);
  expect(recordedActions.length).toBe(1);
  expect(recordedActions[0].txSig).toBe(sig);
  expect(recordedActions[0].ixIndex).toBe(3);
  expect(recordedActions[0].innerIxIndex).toBe(0);
  const action = recordedActions[0].action as EscrowActionWithdrawLamport;
  expect(action.authority.toBase58()).toBe(
    "4iud6muHzqkmef4CBeJNpFGJ3k6QZJ2o3MtXxGC718QC"
  );
  expect(action.pda.toBase58()).toBe(
    "4n5rvJmAxmdSVzd8SnaBTJvA78bpTUHrQ7PeKTxrfRpM"
  );
  expect(action.destination.toBase58()).toBe(
    "4iud6muHzqkmef4CBeJNpFGJ3k6QZJ2o3MtXxGC718QC"
  );

  // Serialize and deserialize
  const serialized = serializeRecordedEscrowActions(recordedActions);
  const deserialized = await deserializeRecordedEscrowActions(
    connection,
    serialized
  );
  expect(deserialized).toStrictEqual(recordedActions);
});

// Multi-sig test with CPIs (innerInstructions)
test("Parse and serialize Squads deposit SPL escrow tiplink", async () => {
  const sig =
    "5VeTJzkJLnMkgbHHYXeK27tvC4sxs9PTbkvZziPRvQ1i297bNYBUj9bkJJgHR4qkhQqvKxhSgAvUCnNwbMwjnNfF";

  const connection = new Connection(
    process.env.SOLANA_MAINNET_RPC as string,
    "confirmed"
  );

  const recordedActions = await parseEscrowTx(connection, sig);
  expect(recordedActions.length).toBe(1);
  expect(recordedActions[0].txSig).toBe(sig);
  expect(recordedActions[0].ixIndex).toBe(3);
  expect(recordedActions[0].innerIxIndex).toBe(0);
  const action = recordedActions[0].action as EscrowActionDepositLamport;
  expect(action.depositor.toBase58()).toBe(
    "4iud6muHzqkmef4CBeJNpFGJ3k6QZJ2o3MtXxGC718QC"
  );
  expect(action.pda.toBase58()).toBe(
    "8sEEUicCyPbXr3uvf4q7orn59QiM918GfpJbCBFjpU5h"
  );
  expect(action.receiverTipLink.toBase58()).toBe(
    "DeJ1wPyjf2zF9JpD5UbXz9u4X1HzWbwcmz4MAHsA9uv6"
  );

  // Serialize and deserialize
  const serialized = serializeRecordedEscrowActions(recordedActions);
  const deserialized = await deserializeRecordedEscrowActions(
    connection,
    serialized
  );
  expect(deserialized).toStrictEqual(recordedActions);
});
