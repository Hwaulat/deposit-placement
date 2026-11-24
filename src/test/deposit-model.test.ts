import { describe, expect, it } from "vitest";

import {
  DEMO_BANKS,
  addBusinessDays,
  runAllocationProposal,
  validateAllocationLines,
  type AllocationLine,
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

  it("returns No solution when no active banks are available", () => {
    const noBanks = runAllocationProposal(parameters({ availableCash: 1_000_000_000 }), []);
    expect(noBanks.status).toBe("No solution");
  });
});

describe("validateAllocationLines", () => {
  const baseLine: AllocationLine = {
    id: "AL-1",
    bankId: "bca",
    bankName: "BCA",
    rank: 1,
    amount: 200_000_000,
    annualRate: 5.5,
    tenorDays: 90,
    maturityDate: "2027-02-24",
    reason: "Rank 1",
    status: "Suggested",
  };

  it("validates compliant allocation line", () => {
    const res = validateAllocationLines([baseLine], parameters({ availableCash: 500_000_000 }));
    expect(res.valid).toBe(true);
  });

  it("rejects line below minimum placement", () => {
    const invalidLine = { ...baseLine, amount: 50_000_000 };
    const res = validateAllocationLines([invalidLine], parameters());
    expect(res.valid).toBe(false);
    expect(res.message).toContain("at least");
  });

  it("rejects total placement exceeding available cash", () => {
    const excessiveLine = { ...baseLine, amount: 800_000_000 };
    const res = validateAllocationLines([excessiveLine], parameters({ availableCash: 700_000_000 }));
    expect(res.valid).toBe(false);
    expect(res.message).toContain("cannot exceed available cash");
  });

  it("rejects total placement exceeding equity ceiling", () => {
    const highLine = { ...baseLine, amount: 4_000_000_000 };
    const res = validateAllocationLines(
      [highLine],
      parameters({ equity: 10_000_000_000, maxEquityPercent: 30, availableCash: 5_000_000_000 }),
    );
    expect(res.valid).toBe(false);
    expect(res.message).toContain("cannot exceed 30% of equity");
  });
});

describe("addBusinessDays calculation", () => {
  it("skips weekend days (Saturday and Sunday)", () => {
    // 2026-11-20 is Friday. Adding 1 business day should be Monday 2026-11-23.
    const result = addBusinessDays("2026-11-20", 1);
    expect(result).toBe("2026-11-23");
  });

  it("skips holidays", () => {
    // 2026-11-20 is Friday. If Monday 2026-11-23 is a holiday, it should land on Tuesday 2026-11-24.
    const result = addBusinessDays("2026-11-20", 1, ["2026-11-23"]);
    expect(result).toBe("2026-11-24");
  });
});
