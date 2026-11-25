export type CashflowDirection = "Incoming" | "Outgoing";
export type CashflowStatus = "Draft" | "Submitted" | "Need revision" | "Validated";
export type CashflowSource = "Department form" | "ERP feed" | "System forecast";

export interface CashflowItem {
  id: string;
  reference: string;
  department: string;
  category: string;
  direction: CashflowDirection;
  source: CashflowSource;
  amount: number;
  dueDate: string;
  status: CashflowStatus;
  bankName?: string;
}

export interface Bank {
  id: string;
  name: string;
  rank: number;
  depositRate: number;
  serviceRating: string;
  creditRating: string;
  npl: number;
  nim: number;
  car: number;
  ldr: number;
  maxAllocationPercent: number;
  depositBalance: number;
  active: boolean;
  template?: string;
}

export interface DepositParameters {
  depositTrigger: number;
  maxEquityPercent: number;
  minimumPlacement: number;
  equity: number;
  existingDeposits: number;
  availableCash: number;
}

export type AllocationStatus = "Suggested" | "Adjusted" | "Approved" | "Voucher created";

export interface AllocationLine {
  id: string;
  bankId: string;
  bankName: string;
  rank: number;
  amount: number;
  annualRate: number;
  tenorDays: number;
  maturityDate: string;
  reason: string;
  status: AllocationStatus;
  voucherNumber?: string;
}

export interface AllocationProposal {
  status: "Ready" | "No solution" | "Not required";
  computedAt: string;
  targetAmount: number;
  totalAllocated: number;
  remainingCash: number;
  remainingDepositRoom: number;
  explanation: string;
  lines: AllocationLine[];
}

export interface ApprovalItem {
  id: string;
  document: string;
  type: "Monthly report" | "Weekly report" | "Bank instruction";
  amount: number;
  step: number;
  status: "Pending" | "Approved" | "Returned";
  submittedAt: string;
  submittedBy: string;
  comment?: string;
}

export interface BankInstruction {
  id: string;
  bankName: string;
  amount: number;
  voucherNumber: string;
  maturityDate: string;
  status: "Draft" | "In approval" | "Approved" | "Sent to bank";
  template: string;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  event: string;
  detail: string;
  actor: string;
  occurredAt: string;
}

export interface WorkspaceData {
  cashBalance: number;
  parameters: DepositParameters;
  banks: Bank[];
  cashflows: CashflowItem[];
  proposal: AllocationProposal;
  allocationState: "Draft" | "In review" | "Approved" | "Voucher created";
  approvals: ApprovalItem[];
  instructions: BankInstruction[];
  auditTrail: AuditRecord[];
  lastErpSync: string;
}

export const APPROVAL_STEPS = [
  "Treasury Dept. Head",
  "Finance Accounting Div. Head",
  "Finance Accounting Director",
] as const;

export const DEMO_PARAMETERS: DepositParameters = {
  depositTrigger: 500_000_000,
  maxEquityPercent: 30,
  minimumPlacement: 100_000_000,
  equity: 16_400_000_000,
  existingDeposits: 2_150_000_000,
  availableCash: 3_250_000_000,
};

export const DEMO_BANKS: Bank[] = [
  {
    id: "bca",
    name: "Bank Central Asia",
    rank: 1,
    depositRate: 5.4,
    serviceRating: "A",
    creditRating: "AAA",
    npl: 1.9,
    nim: 5.8,
    car: 29.4,
    ldr: 79.7,
    maxAllocationPercent: 30,
    depositBalance: 600_000_000,
    active: true,
    template: "BCA — Fixed Deposit PDF Layout",
  },
  {
    id: "mandiri",
    name: "Bank Mandiri",
    rank: 2,
    depositRate: 5.3,
    serviceRating: "A",
    creditRating: "AAA",
    npl: 1.1,
    nim: 5.1,
    car: 20.8,
    ldr: 91.2,
    maxAllocationPercent: 25,
    depositBalance: 480_000_000,
    active: true,
    template: "Mandiri — Universal Corporate Voucher",
  },
  {
    id: "bni",
    name: "Bank Negara Indonesia",
    rank: 3,
    depositRate: 5.2,
    serviceRating: "A-",
    creditRating: "AAA",
    npl: 2.1,
    nim: 4.2,
    car: 21.5,
    ldr: 94.4,
    maxAllocationPercent: 20,
    depositBalance: 410_000_000,
    active: true,
    template: "BNI — Time Deposit Placement Letter",
  },
  {
    id: "cimb",
    name: "CIMB Niaga",
    rank: 4,
    depositRate: 5.1,
    serviceRating: "A-",
    creditRating: "AAA",
    npl: 2.3,
    nim: 4.6,
    car: 23.1,
    ldr: 89.6,
    maxAllocationPercent: 15,
    depositBalance: 340_000_000,
    active: true,
    template: "CIMB Niaga — Placement Template",
  },
  {
    id: "danamon",
    name: "Bank Danamon",
    rank: 5,
    depositRate: 4.95,
    serviceRating: "B+",
    creditRating: "AA+",
    npl: 2.5,
    nim: 7.1,
    car: 26.8,
    ldr: 94.1,
    maxAllocationPercent: 10,
    depositBalance: 320_000_000,
    active: true,
    template: "Danamon — Standard Term Deposit Letter",
  },
];

export const DEMO_CASHFLOWS: CashflowItem[] = [
  {
    id: "CF-24018",
    reference: "Supplier payments — local",
    department: "Accounts Payable",
    category: "Supplier payment",
    direction: "Outgoing",
    source: "ERP feed",
    amount: 1_240_000_000,
    dueDate: "2026-11-26",
    status: "Validated",
    bankName: "Bank Mandiri",
  },
  {
    id: "CF-24017",
    reference: "Customer collections — week 48",
    department: "Accounts Receivable",
    category: "Customer collection",
    direction: "Incoming",
    source: "ERP feed",
    amount: 1_960_000_000,
    dueDate: "2026-11-25",
    status: "Validated",
    bankName: "Bank Central Asia",
  },
  {
    id: "CF-24016",
    reference: "November payroll",
    department: "People & Culture",
    category: "Payroll",
    direction: "Outgoing",
    source: "Department form",
    amount: 842_500_000,
    dueDate: "2026-11-27",
    status: "Submitted",
    bankName: "Bank Central Asia",
  },
  {
    id: "CF-24015",
    reference: "Scrap sales forecast",
    department: "Logistics",
    category: "Scrap sales",
    direction: "Incoming",
    source: "ERP feed",
    amount: 184_000_000,
    dueDate: "2026-11-30",
    status: "Validated",
    bankName: "Bank Negara Indonesia",
  },
  {
    id: "CF-24014",
    reference: "GA utilities — monthly estimate",
    department: "General Affairs",
    category: "Utilities",
    direction: "Outgoing",
    source: "Department form",
    amount: 286_000_000,
    dueDate: "2026-11-30",
    status: "Need revision",
    bankName: "Bank Danamon",
  },
  {
    id: "CF-24013",
    reference: "Marketing business plan",
    department: "Marketing",
    category: "Sales business plan",
    direction: "Incoming",
    source: "Department form",
    amount: 1_420_000_000,
    dueDate: "2026-12-03",
    status: "Draft",
    bankName: "Bank Mandiri",
  },
  {
    id: "CF-24012",
    reference: "Import supplier payments",
    department: "Accounts Payable",
    category: "Supplier payment",
    direction: "Outgoing",
    source: "ERP feed",
    amount: 698_000_000,
    dueDate: "2026-12-04",
    status: "Validated",
    bankName: "CIMB Niaga",
  },
  {
    id: "CF-24011",
    reference: "Tax and statutory payments",
    department: "Accounting",
    category: "Taxation",
    direction: "Outgoing",
    source: "Department form",
    amount: 412_000_000,
    dueDate: "2026-12-05",
    status: "Validated",
    bankName: "Bank Negara Indonesia",
  },
  {
    id: "CF-24010",
    reference: "Corporate customer billing",
    department: "Accounts Receivable",
    category: "Customer collection",
    direction: "Incoming",
    source: "ERP feed",
    amount: 720_000_000,
    dueDate: "2026-11-26",
    status: "Validated",
    bankName: "CIMB Niaga",
  },
  {
    id: "CF-24009",
    reference: "Export trade proceeds",
    department: "Treasury",
    category: "Trade finance",
    direction: "Incoming",
    source: "ERP feed",
    amount: 540_000_000,
    dueDate: "2026-11-27",
    status: "Validated",
    bankName: "Bank Danamon",
  },
  {
    id: "CF-24008",
    reference: "Dividend & affiliate fee",
    department: "Finance",
    category: "Investment return",
    direction: "Incoming",
    source: "ERP feed",
    amount: 450_000_000,
    dueDate: "2026-11-25",
    status: "Validated",
    bankName: "Bank Central Asia",
  },
  {
    id: "CF-24007",
    reference: "IT enterprise software licensing",
    department: "IT & Infrastructure",
    category: "Operational expense",
    direction: "Outgoing",
    source: "Department form",
    amount: 185_000_000,
    dueDate: "2026-11-26",
    status: "Validated",
    bankName: "Bank Mandiri",
  },
];

// ── 1. Calendar & Timing Constraints ──

export interface HolidayEntry {
  date: string;
  name: string;
  source: "National Holiday" | "Bank Indonesia" | "IDBM Calendar";
}

export const INDONESIAN_NATIONAL_HOLIDAYS_2026: HolidayEntry[] = [
  { date: "2026-01-01", name: "Tahun Baru 2026 Masehi", source: "National Holiday" },
  { date: "2026-01-16", name: "Isra Mi'raj Nabi Muhammad SAW", source: "National Holiday" },
  { date: "2026-02-17", name: "Tahun Baru Imlek 2577 Kongzili", source: "National Holiday" },
  { date: "2026-03-19", name: "Hari Suci Nyepi Saka 1948", source: "National Holiday" },
  { date: "2026-03-20", name: "Hari Raya Idul Fitri 1447 H (Hari 1)", source: "National Holiday" },
  { date: "2026-03-21", name: "Hari Raya Idul Fitri 1447 H (Hari 2)", source: "National Holiday" },
  { date: "2026-04-03", name: "Wafat Yesus Kristus", source: "National Holiday" },
  { date: "2026-05-01", name: "Hari Buruh Internasional", source: "National Holiday" },
  { date: "2026-05-14", name: "Kenaikan Yesus Kristus", source: "National Holiday" },
  { date: "2026-05-27", name: "Hari Raya Idul Adha 1447 H", source: "National Holiday" },
  { date: "2026-05-31", name: "Hari Raya Waisak 2570 BE", source: "National Holiday" },
  { date: "2026-06-01", name: "Hari Lahir Pancasila", source: "National Holiday" },
  { date: "2026-06-16", name: "Tahun Baru Islam 1448 H", source: "National Holiday" },
  { date: "2026-08-17", name: "Hari Kemerdekaan RI Ke-81", source: "National Holiday" },
  { date: "2026-08-25", name: "Maulid Nabi Muhammad SAW", source: "National Holiday" },
  { date: "2026-12-25", name: "Hari Raya Natal", source: "National Holiday" },
];

export const BI_SETTLEMENT_CLOSURES_2026: HolidayEntry[] = [
  ...INDONESIAN_NATIONAL_HOLIDAYS_2026.map((h) => ({ ...h, source: "Bank Indonesia" as const })),
  { date: "2026-12-31", name: "Tutup Buku Tahunan Bank Indonesia (Year-end BI Clearing Close)", source: "Bank Indonesia" },
];

export const IDBM_CALENDAR_INFO = {
  name: "Indonesia Interbank Money Market (PUAB / IDBM)",
  tradingHours: "08:30 - 15:00 WIB",
  settlementConvention: "T+0 / Same Day Settlement",
  nonTradingDays: "Sabtu, Minggu & Hari Libur Operasional BI / Nasional",
  description: "Pasar Uang Antar Bank untuk penempatan instrumen pasar uang dan time deposit rupiah.",
};

export interface BankDueDatePattern {
  bankId: string;
  bankName: string;
  convention: string;
  cutOffTime: string;
  settlementCycle: string;
  rolloverRule: string;
}

export const BANK_DUE_DATE_PATTERNS: BankDueDatePattern[] = [
  { bankId: "bca", bankName: "Bank Central Asia", convention: "Following Business Day", cutOffTime: "14:30 WIB", settlementCycle: "T+0 Same Day", rolloverRule: "Automatic transfer on next business day" },
  { bankId: "mandiri", bankName: "Bank Mandiri", convention: "Following Business Day", cutOffTime: "15:00 WIB", settlementCycle: "T+0 Same Day", rolloverRule: "Automatic transfer on next business day" },
  { bankId: "bni", bankName: "Bank Negara Indonesia", convention: "Following Business Day", cutOffTime: "14:30 WIB", settlementCycle: "T+0 Same Day", rolloverRule: "Automatic transfer on next business day" },
  { bankId: "cimb", bankName: "CIMB Niaga", convention: "Following Business Day", cutOffTime: "14:00 WIB", settlementCycle: "T+0 Same Day", rolloverRule: "Automatic transfer on next business day" },
  { bankId: "danamon", bankName: "Bank Danamon", convention: "Following Business Day", cutOffTime: "14:00 WIB", settlementCycle: "T+0 Same Day", rolloverRule: "Automatic transfer on next business day" },
];

export const ALL_FINANCIAL_HOLIDAY_DATES = Array.from(
  new Set([
    ...INDONESIAN_NATIONAL_HOLIDAYS_2026.map((h) => h.date),
    ...BI_SETTLEMENT_CLOSURES_2026.map((h) => h.date),
  ])
);

export function addBusinessDays(startDate: string, businessDays: number, holidays: string[] = ALL_FINANCIAL_HOLIDAY_DATES) {
  const date = new Date(`${startDate}T12:00:00Z`);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    const isoDate = date.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidays.includes(isoDate)) {
      daysAdded += 1;
    }
  }

  // Following Business Day convention: roll forward to next business day if landing on weekend or holiday
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6 || holidays.includes(date.toISOString().slice(0, 10))) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date.toISOString().slice(0, 10);
}

function emptyProposal(
  status: AllocationProposal["status"],
  computedAt: string,
  availableCash: number,
  remainingDepositRoom: number,
  explanation: string,
): AllocationProposal {
  return {
    status,
    computedAt,
    targetAmount: 0,
    totalAllocated: 0,
    remainingCash: availableCash,
    remainingDepositRoom,
    explanation,
    lines: [],
  };
}

export function runAllocationProposal(
  parameters: DepositParameters,
  banks: Bank[],
  asOfDate = "2026-11-24",
  holidays: string[] = ALL_FINANCIAL_HOLIDAY_DATES,
): AllocationProposal {
  const maximumDeposit = (parameters.equity * parameters.maxEquityPercent) / 100;
  const remainingDepositRoom = Math.max(0, maximumDeposit - parameters.existingDeposits);

  if (parameters.availableCash <= parameters.depositTrigger) {
    return emptyProposal(
      "Not required",
      asOfDate,
      parameters.availableCash,
      remainingDepositRoom,
      "Cash is at or below the deposit trigger, so no placement is required.",
    );
  }

  const targetAmount = Math.min(parameters.availableCash, remainingDepositRoom);
  if (targetAmount < parameters.minimumPlacement) {
    return emptyProposal(
      "No solution",
      asOfDate,
      parameters.availableCash,
      remainingDepositRoom,
      `Available cash and equity headroom do not support the minimum ${formatRupiah(parameters.minimumPlacement)} placement.`,
    );
  }

  const eligibleBanks = banks
    .filter((bank) => bank.active && bank.depositRate > 0 && bank.maxAllocationPercent > 0)
    .sort((left, right) => left.rank - right.rank);

  if (eligibleBanks.length === 0) {
    return emptyProposal(
      "No solution",
      asOfDate,
      parameters.availableCash,
      remainingDepositRoom,
      "No active, ranked bank is available for this placement.",
    );
  }

  let remainingAmount = targetAmount;
  const lines: AllocationLine[] = [];

  for (const bank of eligibleBanks) {
    const bankLimit = Math.floor(
      (targetAmount * bank.maxAllocationPercent) / 100 / 1_000_000,
    ) * 1_000_000;
    const amount = Math.min(remainingAmount, bankLimit);
    if (amount < parameters.minimumPlacement) continue;

    lines.push({
      id: `AL-${asOfDate.replaceAll("-", "")}-${bank.id}`,
      bankId: bank.id,
      bankName: bank.name,
      rank: bank.rank,
      amount,
      annualRate: bank.depositRate,
      tenorDays: 90,
      maturityDate: addBusinessDays(asOfDate, 90, holidays),
      reason: `Rank #${bank.rank} · ${bank.depositRate.toFixed(2)}% p.a. · within ${bank.maxAllocationPercent}% bank limit`,
      status: "Suggested",
    });
    remainingAmount -= amount;
  }

  const totalAllocated = lines.reduce((total, line) => total + line.amount, 0);
  if (totalAllocated < parameters.minimumPlacement) {
    return emptyProposal(
      "No solution",
      asOfDate,
      parameters.availableCash,
      remainingDepositRoom,
      "Bank limits leave no placement that meets the minimum amount. Review the active bank limits.",
    );
  }

  return {
    status: "Ready",
    computedAt: asOfDate,
    targetAmount,
    totalAllocated,
    remainingCash: parameters.availableCash - totalAllocated,
    remainingDepositRoom: Math.max(0, remainingDepositRoom - totalAllocated),
    explanation: `Suggested by bank ranking and current limits. ${formatRupiah(totalAllocated)} stays within available cash and the ${parameters.maxEquityPercent}% equity ceiling.`,
    lines,
  };
}

export function validateAllocationLines(
  lines: AllocationLine[],
  parameters: DepositParameters,
): { valid: boolean; message: string } {
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const maximumDeposit = (parameters.equity * parameters.maxEquityPercent) / 100;

  if (lines.some((line) => line.amount < parameters.minimumPlacement)) {
    return {
      valid: false,
      message: `Each placement must be at least ${formatRupiah(parameters.minimumPlacement)}.`,
    };
  }
  if (total > parameters.availableCash) {
    return { valid: false, message: "The total placement cannot exceed available cash." };
  }
  if (total + parameters.existingDeposits > maximumDeposit) {
    return {
      valid: false,
      message: `Total deposits cannot exceed ${parameters.maxEquityPercent}% of equity.`,
    };
  }

  return { valid: true, message: "The adjustment stays within the current placement limits." };
}

export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return "Rp.0";
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat("id-ID").format(Math.abs(rounded));
  return rounded < 0 ? `-Rp.${formatted}` : `Rp.${formatted}`;
}

export function formatCompactRupiah(amount: number): string {
  return formatRupiah(amount);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

const DEMO_PROPOSAL = runAllocationProposal(DEMO_PARAMETERS, DEMO_BANKS);

export const DEMO_WORKSPACE: WorkspaceData = {
  cashBalance: 8_420_000_000,
  parameters: DEMO_PARAMETERS,
  banks: DEMO_BANKS,
  cashflows: DEMO_CASHFLOWS,
  proposal: DEMO_PROPOSAL,
  allocationState: "Draft",
  approvals: [
    {
      id: "APR-2026-032",
      document: "October deposit proposal",
      type: "Monthly report",
      amount: 1_840_000_000,
      step: 2,
      status: "Pending",
      submittedAt: "2026-11-20",
      submittedBy: "Cash Bank",
    },
    {
      id: "APR-2026-031",
      document: "Week 47 placement report",
      type: "Weekly report",
      amount: 760_000_000,
      step: 0,
      status: "Pending",
      submittedAt: "2026-11-23",
      submittedBy: "Cash Bank",
    },
  ],
  instructions: [
    {
      id: "BI-2026-0289",
      bankName: "Bank Mandiri",
      amount: 460_000_000,
      voucherNumber: "VCH-26-1122",
      maturityDate: "2027-02-18",
      status: "Approved",
      template: "Mandiri — Universal Corporate Layout",
      createdAt: "2026-11-19",
    },
    {
      id: "BI-2026-0288",
      bankName: "Bank Central Asia",
      amount: 320_000_000,
      voucherNumber: "VCH-26-1117",
      maturityDate: "2027-02-12",
      status: "Sent to bank",
      template: "BCA — Fixed Deposit PDF Layout",
      createdAt: "2026-11-17",
    },
    {
      id: "BI-2026-0287",
      bankName: "Bank Negara Indonesia",
      amount: 250_000_000,
      voucherNumber: "VCH-26-1115",
      maturityDate: "2027-02-10",
      status: "Sent to bank",
      template: "BNI — Treasury Time Deposit Layout",
      createdAt: "2026-11-15",
    },
    {
      id: "BI-2026-0286",
      bankName: "CIMB Niaga",
      amount: 180_000_000,
      voucherNumber: "VCH-26-1112",
      maturityDate: "2027-02-05",
      status: "Approved",
      template: "CIMB Niaga — Corporate Term Deposit Layout",
      createdAt: "2026-11-12",
    },
    {
      id: "BI-2026-0285",
      bankName: "Bank Danamon",
      amount: 150_000_000,
      voucherNumber: "VCH-26-1110",
      maturityDate: "2027-02-03",
      status: "Draft",
      template: "Danamon — Universal Placement Layout",
      createdAt: "2026-11-10",
    },
    {
      id: "BI-2026-0284",
      bankName: "Bank Syariah Indonesia",
      amount: 200_000_000,
      voucherNumber: "VCH-26-1108",
      maturityDate: "2027-01-29",
      status: "Sent to bank",
      template: "BSI — Mudharabah Deposit Placement",
      createdAt: "2026-11-08",
    },
    {
      id: "BI-2026-0283",
      bankName: "Bank Permata",
      amount: 120_000_000,
      voucherNumber: "VCH-26-1105",
      maturityDate: "2027-01-26",
      status: "Draft",
      template: "Permata — Corporate Time Deposit",
      createdAt: "2026-11-05",
    },
    {
      id: "BI-2026-0282",
      bankName: "Bank OCBC NISP",
      amount: 300_000_000,
      voucherNumber: "VCH-26-1102",
      maturityDate: "2027-01-22",
      status: "Approved",
      template: "OCBC NISP — Corporate Treasury Placement",
      createdAt: "2026-11-02",
    },
    {
      id: "BI-2026-0281",
      bankName: "Bank Tabungan Negara",
      amount: 175_000_000,
      voucherNumber: "VCH-26-1028",
      maturityDate: "2027-01-18",
      status: "Sent to bank",
      template: "BTN — Treasury Placement Layout",
      createdAt: "2026-10-28",
    },
    {
      id: "BI-2026-0280",
      bankName: "Bank Panin",
      amount: 140_000_000,
      voucherNumber: "VCH-26-1024",
      maturityDate: "2027-01-14",
      status: "Draft",
      template: "Panin — Universal Placement Template",
      createdAt: "2026-10-24",
    },
  ],
  auditTrail: [
    {
      id: "AUD-03",
      event: "ERP sync completed",
      detail: "24 supplier, collection and scrap-sales records",
      actor: "System",
      occurredAt: "2026-11-24T08:15:00Z",
    },
    {
      id: "AUD-02",
      event: "Report submitted for approval",
      detail: "October deposit proposal · Finance Accounting Director",
      actor: "Cash Bank",
      occurredAt: "2026-11-23T10:20:00Z",
    },
    {
      id: "AUD-01",
      event: "Cash flow form validated",
      detail: "Customer collections — week 48",
      actor: "Cash Bank",
      occurredAt: "2026-11-23T09:40:00Z",
    },
  ],
  lastErpSync: "2026-11-24T08:15:00Z",
};