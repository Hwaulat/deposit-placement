import { describe, expect, it } from "vitest";

import {
  DEMO_BANKS,
  runAllocationProposal,
  type DepositParameters,
} from "@/lib/deposit-model";

const singleBank = DEMO_BANKS.slice(0, 1).map((bank) => ({
  ...bank,
  maxAllocationPercent: 100,
}));

function parameters(overrides: Partial<DepositParameters> = {}): DepositParameters {
  return {
    depositTrigger: 500_000_000,
    maxEquityPercent: 30,
    minimumPlacement: 100_000_000,
    equity: 10_000_000_000,
    existingDeposits: 0,
    availableCash: 700_000_000,
    ...overrides,
  };
}

describe("deposit placement rules", () => {
  it("requires cash to exceed Rp 500 million before suggesting a placement", () => {
    const atTrigger = runAllocationProposal(parameters({ availableCash: 500_000_000 }), singleBank);
    const aboveTrigger = runAllocationProposal(
      parameters({ availableCash: 500_000_001 }),
      singleBank,
    );

    expect(atTrigger.status).toBe("Not required");
    expect(aboveTrigger.status).toBe("Ready");
  });

  it("keeps total deposits at or below 30% of equity", () => {
    const proposal = runAllocationProposal(
      parameters({ equity: 1_000_000_000, availableCash: 1_000_000_000 }),
      singleBank,
    );

    expect(proposal.totalAllocated).toBe(300_000_000);
    expect(proposal.totalAllocated).toBeLessThanOrEqual(1_000_000_000 * 0.3);
  });

  it("does not suggest placements below the Rp 100 million minimum", () => {
    const belowMinimum = runAllocationProposal(
      parameters({ existingDeposits: 2_901_000_000, availableCash: 600_000_000 }),
      singleBank,
    );
    const atMinimum = runAllocationProposal(
      parameters({ existingDeposits: 2_900_000_000, availableCash: 600_000_000 }),
      singleBank,
    );

    expect(belowMinimum.status).toBe("No solution");
    expect(atMinimum.totalAllocated).toBe(100_000_000);
  });

  it("never allocates more than available cash, so the projected balance stays non-negative", () => {
    const proposal = runAllocationProposal(
      parameters({ availableCash: 725_000_000 }),
      singleBank,
    );

    expect(proposal.totalAllocated).toBeLessThanOrEqual(725_000_000);
    expect(proposal.remainingCash).toBeGreaterThanOrEqual(0);
  });
});