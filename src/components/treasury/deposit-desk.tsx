import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  Archive,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  FileClock,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sun,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  APPROVAL_STEPS,
  DEMO_WORKSPACE,
  addBusinessDays,
  formatCompactRupiah,
  formatDate,
  formatRupiah,
  runAllocationProposal,
  validateAllocationLines,
  type AllocationLine,
  type ApprovalItem,
  type AuditRecord,
  type Bank,
  type BankInstruction,
  type CashflowItem,
  type CashflowStatus,
  type DepositParameters,
  type WorkspaceData,
} from "@/lib/deposit-model";
import { cn } from "@/lib/utils";

type WorkspaceView =
  | "dashboard"
  | "cashflow"
  | "allocation"
  | "ranking"
  | "approvals"
  | "instructions"
  | "reports"
  | "archive"
  | "settings";

type Theme = "light" | "dark";

const STORAGE_KEY = "deposit-desk-workspace-v1";
const THEME_KEY = "deposit-desk-theme";

const NAV_GROUPS: { label: string; items: { id: WorkspaceView; label: string; icon: LucideIcon }[] }[] = [
  {
    label: "WORKSPACE",
    items: [
      { id: "dashboard", label: "Overview", icon: LayoutDashboard },
      { id: "cashflow", label: "Cash flow", icon: ArrowLeftRight },
      { id: "allocation", label: "Deposit allocation", icon: Wallet },
    ],
  },
  {
    label: "TRANSACTIONS",
    items: [
      { id: "ranking", label: "Bank ranking", icon: Landmark },
      { id: "approvals", label: "Approvals", icon: BadgeCheck },
      { id: "instructions", label: "Bank instructions", icon: Send },
    ],
  },
  {
    label: "RECORDS",
    items: [
      { id: "reports", label: "Reports", icon: FileText },
      { id: "archive", label: "Data archive", icon: Archive },
      { id: "settings", label: "Master data", icon: Settings2 },
    ],
  },
];

const PAGE_META: Record<WorkspaceView, { title: string; description: string }> = {
  dashboard: {
    title: "Treasury overview",
    description: "Cash position, deposits and decisions in one place.",
  },
  cashflow: {
    title: "Cash flow",
    description: "Review department submissions and incoming ERP activity.",
  },
  allocation: {
    title: "Deposit allocation",
    description: "Review an explainable placement proposal before approval.",
  },
  ranking: {
    title: "Bank ranking",
    description: "Manage deposit rates, service ratings and allocation limits.",
  },
  approvals: {
    title: "Approval queue",
    description: "Move each report through the required approval sequence.",
  },
  instructions: {
    title: "Bank instructions",
    description: "Prepare, approve and record printed placement instructions.",
  },
  reports: {
    title: "Reports",
    description: "Compare projected cash movement and deposit positions.",
  },
  archive: {
    title: "Data archive",
    description: "Find submitted forms, reports and bank instruction records.",
  },
  settings: {
    title: "Master data",
    description: "Review the parameters, calendars and reference lists in use.",
  },
};

const FORECAST_DATA = [
  { week: "24 Nov", actual: 8.42, forecast: 8.42 },
  { week: "30 Nov", actual: 8.55, forecast: 8.57 },
  { week: "07 Dec", actual: null, forecast: 8.88 },
  { week: "14 Dec", actual: null, forecast: 9.18 },
  { week: "21 Dec", actual: null, forecast: 9.04 },
  { week: "28 Dec", actual: null, forecast: 9.42 },
];

const UPCOMING_MATURITIES = [
  { bank: "Bank Central Asia", amount: 520_000_000, maturity: "2026-11-27", rate: 5.35 },
  { bank: "Bank Mandiri", amount: 680_000_000, maturity: "2026-12-02", rate: 5.2 },
  { bank: "CIMB Niaga", amount: 340_000_000, maturity: "2026-12-09", rate: 5.1 },
];

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (typeof value !== "object" || value === null) return false;
  return (
    "cashBalance" in value &&
    "parameters" in value &&
    "banks" in value &&
    "cashflows" in value &&
    "proposal" in value &&
    "approvals" in value &&
    "instructions" in value &&
    Array.isArray(value.banks) &&
    Array.isArray(value.cashflows) &&
    Array.isArray(value.approvals) &&
    Array.isArray(value.instructions)
  );
}

function withAudit(
  workspace: WorkspaceData,
  event: string,
  detail: string,
  actor = "Cash Bank",
): WorkspaceData {
  const record: AuditRecord = {
    id: `AUD-${Date.now()}`,
    event,
    detail,
    actor,
    occurredAt: new Date().toISOString(),
  };
  return { ...workspace, auditTrail: [record, ...workspace.auditTrail].slice(0, 60) };
}

function exportCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) {
    toast.error("There are no records to export.");
    return;
  }
  const columns = Object.keys(rows[0] ?? {});
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const content = [columns.map(quote).join(","), ...rows.map((row) => columns.map((column) => quote(row[column] ?? "")).join(","))].join("\r\n");
  const blob = new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function shortTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Validated" || status === "Approved" || status === "Sent to bank" || status === "Ready"
      ? "status-positive"
      : status === "Need revision" || status === "Returned" || status === "No solution"
        ? "status-warning"
        : status === "Draft" || status === "Not required"
          ? "status-neutral"
          : "status-info";
  return (
    <Badge variant="outline" className={cn("status-badge", tone)}>
      <span className="status-dot" />
      {status}
    </Badge>
  );
}

function PageHeading({
  activeView,
  children,
}: {
  activeView: WorkspaceView;
  children?: React.ReactNode;
}) {
  const meta = PAGE_META[activeView];
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Deposit Desk</span>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <span className="text-foreground">{meta.title}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">{meta.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{meta.description}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("panel", className)}>{children}</section>;
}

function PanelHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

function KpiCard({
  label,
  value,
  footnote,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  footnote: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "warning";
}) {
  return (
    <Panel className="kpi-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("kpi-icon", `kpi-icon-${tone}`)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 font-mono text-[1.35rem] font-medium tabular-nums text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>
    </Panel>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <FileClock className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function Sidebar({
  activeView,
  onNavigate,
  open,
  onClose,
}: {
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {open ? (
        <Button
          variant="ghost"
          size="icon"
          className="fixed inset-0 z-30 h-full w-full cursor-default rounded-none bg-background/75 backdrop-blur-sm lg:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-sidebar-border px-5">
          <div className="brand-mark" aria-hidden="true">
            <Landmark className="size-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">Deposit Desk</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase text-muted-foreground">Treasury workspace</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 lg:hidden"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>

        <div className="px-4 pt-5">
          <div className="workspace-chip">
            <span className="workspace-indicator" />
            <span>Sample workspace</span>
            <ChevronDown className="ml-auto size-3.5" aria-hidden="true" />
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ id, label, icon: Icon }) => {
                  const selected = activeView === id;
                  return (
                    <Button
                      key={id}
                      variant="ghost"
                      aria-current={selected ? "page" : undefined}
                      className={cn("nav-item w-full justify-start", selected && "nav-item-active")}
                      onClick={() => {
                        onNavigate(id);
                        onClose();
                      }}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      <span>{label}</span>
                      {id === "approvals" ? (
                        <span className="nav-count">2</span>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="avatar-monogram">CB</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-sidebar-foreground">Cash Bank</p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">Working session · demo</p>
            </div>
            <MoreHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-2 px-2 text-[10px] text-muted-foreground">No sign-in required</p>
        </div>
      </aside>
    </>
  );
}

function TopBar({
  onOpenSearch,
  theme,
  onToggleTheme,
  onOpenMenu,
}: {
  onOpenSearch: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-9">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 lg:hidden"
          aria-label="Open navigation"
          onClick={onOpenMenu}
        >
          <Menu />
        </Button>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span>Operations</span>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <span className="text-foreground">Treasury</span>
        </div>
        <span className="text-xs text-muted-foreground sm:hidden">Treasury</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="topbar-search" onClick={onOpenSearch}>
          <Search className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden md:inline-flex">⌘ K</kbd>
        </Button>
        <span className="topbar-divider hidden sm:block" />
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} appearance`}
          onClick={onToggleTheme}
        >
          {theme === "light" ? <Moon /> : <Sun />}
        </Button>
      </div>
    </header>
  );
}

function SearchDialog({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const [query, setQuery] = useState("");
  const matchingItems = NAV_GROUPS.flatMap((group) => group.items).filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-3">
        <DialogHeader className="sr-only">
          <DialogTitle>Search Deposit Desk</DialogTitle>
          <DialogDescription>Find a workspace page.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            autoFocus
            placeholder="Search pages..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 border-0 pl-10 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-72 overflow-y-auto border-t border-border pt-2">
          <p className="px-2 py-2 text-[10px] font-semibold uppercase text-muted-foreground">Pages</p>
          {matchingItems.length ? (
            matchingItems.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  onNavigate(id);
                  onOpenChange(false);
                  setQuery("");
                }}
              >
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                {label}
                <ArrowRight className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
              </Button>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matching pages.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DashboardView({
  workspace,
  onNavigate,
  onRunProposal,
  onApprove,
}: {
  workspace: WorkspaceData;
  onNavigate: (view: WorkspaceView) => void;
  onRunProposal: () => void;
  onApprove: (id: string) => void;
}) {
  const pendingApprovals = workspace.approvals.filter((item) => item.status === "Pending");
  const totalDeposits = workspace.banks.reduce((sum, bank) => sum + bank.depositBalance, 0);
  const depositLimit = (workspace.parameters.equity * workspace.parameters.maxEquityPercent) / 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          <span>Tuesday, 24 November 2026</span>
          <span className="text-border">·</span>
          <span>Cycle 48</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="workspace-indicator" />
            Demo data
          </span>
          <Button variant="outline" size="sm" onClick={() => onNavigate("cashflow")}>
            View cash flow <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total cash balance"
          value={formatCompactRupiah(workspace.cashBalance)}
          footnote="Across operating bank accounts"
          icon={Wallet}
        />
        <KpiCard
          label="Time deposits"
          value={formatCompactRupiah(totalDeposits)}
          footnote={`${((totalDeposits / workspace.parameters.equity) * 100).toFixed(1)}% of equity`}
          icon={Landmark}
          tone="positive"
        />
        <KpiCard
          label="Available to place"
          value={formatCompactRupiah(workspace.parameters.availableCash)}
          footnote="After forecast operating needs"
          icon={Banknote}
          tone="positive"
        />
        <KpiCard
          label="Equity deposit limit"
          value={formatCompactRupiah(depositLimit)}
          footnote={`${formatCompactRupiah(Math.max(0, depositLimit - totalDeposits))} headroom remaining`}
          icon={ShieldCheck}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeading
            title="Cash position forecast"
            detail="Actual and forecast balance · IDR billions"
            action={
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onNavigate("reports")}>
                View report <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            }
          />
          <div className="mb-3 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-2"><span className="chart-legend-dot chart-legend-actual" />Actual</span>
            <span className="inline-flex items-center gap-2"><span className="chart-legend-dot chart-legend-forecast" />Forecast</span>
          </div>
          <div className="h-[250px] w-full" aria-label="Cash position forecast chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={FORECAST_DATA} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(value) => `${value}b`} domain={[7.8, 10]} />
                <Tooltip
                  formatter={(value) => [`Rp ${Number(value ?? 0).toFixed(2)}bn`, "Balance"]}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "6px" }}
                  labelStyle={{ color: "var(--foreground)" }}
                  itemStyle={{ color: "var(--foreground)" }}
                  cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
                />
                <Area type="monotone" dataKey="actual" stroke="var(--chart-1)" strokeWidth={2} fill="url(#actualFill)" connectNulls />
                <Area type="monotone" dataKey="forecast" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="5 4" fill="url(#forecastFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
            <span className="text-muted-foreground">Forecast ending balance</span>
            <span className="font-mono font-medium tabular-nums text-foreground">Rp 9.42bn <span className="ml-1 text-positive">+11.9%</span></span>
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeading
            title="Deposit position"
            detail="By bank · current placement"
            action={<Button variant="ghost" size="icon" className="size-7" aria-label="Open bank ranking" onClick={() => onNavigate("ranking")}><MoreHorizontal /></Button>}
          />
          <div className="space-y-4">
            {workspace.banks.slice(0, 4).map((bank, index) => {
              const percent = totalDeposits ? (bank.depositBalance / totalDeposits) * 100 : 0;
              return (
                <div key={bank.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-foreground"><span className="rank-mark">{bank.rank}</span><span className="truncate">{bank.name}</span></span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{formatCompactRupiah(bank.depositBalance)}</span>
                  </div>
                  <div className="position-track"><span className={cn("position-bar", `position-bar-${index + 1}`)} style={{ width: `${percent}%` }} /></div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <div><p className="text-[11px] text-muted-foreground">Total placement</p><p className="mt-1 font-mono text-sm font-medium tabular-nums">{formatCompactRupiah(totalDeposits)}</p></div>
            <Button variant="outline" size="sm" onClick={() => onNavigate("allocation")}>Open allocation</Button>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-7">
          <PanelHeading
            title="Awaiting approval"
            detail={`${pendingApprovals.length} documents in the approval sequence`}
            action={<Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onNavigate("approvals")}>View queue <ArrowRight className="size-3.5" aria-hidden="true" /></Button>}
          />
          {pendingApprovals.length ? (
            <div className="divide-y divide-border">
              {pendingApprovals.slice(0, 3).map((item) => {
                const approver = APPROVAL_STEPS[item.step] ?? APPROVAL_STEPS[0];
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">{item.document}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{approver} · step {item.step + 1} of 3</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs tabular-nums text-foreground">{formatCompactRupiah(item.amount)}</span>
                      <Button variant="outline" size="sm" onClick={() => onApprove(item.id)}>Approve</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Nothing waiting for approval" description="New submissions will appear here." />
          )}
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeading
            title="Upcoming maturities"
            detail="Next 30 days"
            action={<Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onNavigate("reports")}>Calendar <CalendarDays className="size-3.5" aria-hidden="true" /></Button>}
          />
          <div className="divide-y divide-border">
            {UPCOMING_MATURITIES.map((item) => (
              <div key={`${item.bank}-${item.maturity}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="maturity-date"><span>{new Date(`${item.maturity}T12:00:00Z`).getUTCDate()}</span><small>{new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(new Date(`${item.maturity}T12:00:00Z`))}</small></div>
                  <div className="min-w-0"><p className="truncate text-xs font-medium text-foreground">{item.bank}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.rate.toFixed(2)}% annual rate</p></div>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">{formatCompactRupiah(item.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="action-callout-icon"><Activity className="size-4" aria-hidden="true" /></div>
            <div><h2 className="text-sm font-semibold text-foreground">November placement proposal</h2><p className="mt-1 text-xs text-muted-foreground">{workspace.proposal.status === "Ready" ? workspace.proposal.explanation : "Recalculate from current cash flow and bank ranking."}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={workspace.allocationState === "In review" ? "In approval" : workspace.proposal.status} />
            <Button onClick={() => workspace.proposal.status === "Ready" ? onNavigate("allocation") : onRunProposal()}>
              {workspace.proposal.status === "Ready" ? "Review proposal" : "Calculate allocation"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function CashflowView({
  workspace,
  onValidate,
  onReturn,
  onCalculate,
  onExport,
}: {
  workspace: WorkspaceData;
  onValidate: (id: string) => void;
  onReturn: (id: string) => void;
  onCalculate: () => void;
  onExport: () => void;
}) {
  const [filter, setFilter] = useState<"All items" | "Department forms" | "ERP feed">("All items");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const items = workspace.cashflows.filter((item) => {
    const sourceMatches = filter === "All items" || (filter === "Department forms" ? item.source === "Department form" : item.source === "ERP feed");
    return sourceMatches && (statusFilter === "All statuses" || item.status === statusFilter);
  });
  const incoming = workspace.cashflows.filter((item) => item.direction === "Incoming").reduce((sum, item) => sum + item.amount, 0);
  const outgoing = workspace.cashflows.filter((item) => item.direction === "Outgoing").reduce((sum, item) => sum + item.amount, 0);
  const net = incoming - outgoing;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniMetric label="Total incoming" value={formatCompactRupiah(incoming)} detail="ERP and department forms" tone="positive" />
        <MiniMetric label="Total expenditure" value={formatCompactRupiah(outgoing)} detail="Submitted and validated" tone="warning" />
        <MiniMetric label="Net cash flow" value={formatCompactRupiah(net)} detail="Current reporting period" tone={net >= 0 ? "positive" : "warning"} />
      </div>
      <Panel>
        <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1">
            {(["All items", "Department forms", "ERP feed"] as const).map((option) => (
              <Button key={option} variant={filter === option ? "secondary" : "ghost"} size="sm" className="h-8 text-xs" onClick={() => setFilter(option)}>{option}</Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="cashflow-status">Filter by status</label>
            <select id="cashflow-status" className="select-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>All statuses</option>
              <option>Draft</option>
              <option>Submitted</option>
              <option>Need revision</option>
              <option>Validated</option>
            </select>
            <Button variant="outline" size="sm" onClick={onExport}><Download className="size-3.5" aria-hidden="true" />Export</Button>
            <Button variant="outline" size="sm" onClick={onCalculate}><Activity className="size-3.5" aria-hidden="true" />Calculate balance</Button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table min-w-[860px]">
            <thead><tr><th>Reference</th><th>Department</th><th>Category</th><th>Due date</th><th>Source</th><th>Amount</th><th>Status</th><th className="text-right">Review</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><div className="font-medium text-foreground">{item.reference}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.id}</div></td>
                  <td>{item.department}</td>
                  <td>{item.category}</td>
                  <td className="whitespace-nowrap">{formatDate(item.dueDate)}</td>
                  <td><span className={cn("source-label", item.source === "ERP feed" ? "source-erp" : "source-form")}>{item.source}</span></td>
                  <td className={cn("whitespace-nowrap font-mono tabular-nums", item.direction === "Incoming" ? "text-positive" : "text-foreground")}>{item.direction === "Incoming" ? "+" : "−"}{formatCompactRupiah(item.amount)}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td className="text-right">
                    {item.source === "Department form" && item.status !== "Validated" ? (
                      <div className="inline-flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onValidate(item.id)}>Validate</Button>
                        <Button variant="ghost" size="icon" className="size-7 text-warning" aria-label={`Return ${item.reference} for revision`} title="Return for revision" onClick={() => onReturn(item.id)}><ArrowDownRight /></Button>
                      </div>
                    ) : <span className="text-[11px] text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length ? <EmptyState title="No matching cash flow records" description="Try another filter to see submitted items." /> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>Showing {items.length} of {workspace.cashflows.length} records</span>
          <span>Last ERP sync · {shortTime(workspace.lastErpSync)} UTC · Sample connection</span>
        </div>
      </Panel>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "warning";
}) {
  return (
    <Panel className="mini-metric">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-mono text-lg font-medium tabular-nums", tone === "positive" ? "text-positive" : "text-warning")}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </Panel>
  );
}

function AllocationView({
  workspace,
  onRecalculate,
  onSubmit,
  onEdit,
  onCreateVoucher,
}: {
  workspace: WorkspaceData;
  onRecalculate: () => void;
  onSubmit: () => void;
  onEdit: (line: AllocationLine) => void;
  onCreateVoucher: () => void;
}) {
  const proposal = workspace.proposal;
  const total = proposal.lines.reduce((sum, line) => sum + line.amount, 0);
  const depositLimit = (workspace.parameters.equity * workspace.parameters.maxEquityPercent) / 100;
  const afterPlacement = workspace.parameters.existingDeposits + total;
  const limitUse = depositLimit ? (afterPlacement / depositLimit) * 100 : 0;
  const canSubmit = proposal.status === "Ready" && workspace.allocationState === "Draft";
  const canCreateVoucher = workspace.allocationState === "Approved" && proposal.lines.length > 0;

  return (
    <div className="space-y-5">
      <Panel className="allocation-summary">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2"><StatusBadge status={workspace.allocationState === "In review" ? "In approval" : workspace.allocationState === "Voucher created" ? "Voucher created" : proposal.status} /><span className="text-[11px] text-muted-foreground">Run · {formatDate(proposal.computedAt)}</span></div>
            <h2 className="text-base font-semibold text-foreground">November deposit proposal</h2>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{proposal.explanation}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onRecalculate}><RefreshCw className="size-3.5" aria-hidden="true" />Recalculate</Button>
            {canSubmit ? <Button size="sm" onClick={onSubmit}><Send className="size-3.5" aria-hidden="true" />Submit for approval</Button> : null}
            {canCreateVoucher ? <Button size="sm" onClick={onCreateVoucher}><FileCheck2 className="size-3.5" aria-hidden="true" />Create ERP vouchers</Button> : null}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 lg:grid-cols-4">
          <SummaryValue label="Available cash" value={formatCompactRupiah(workspace.parameters.availableCash)} />
          <SummaryValue label="Suggested placement" value={formatCompactRupiah(total)} />
          <SummaryValue label="Deposit limit" value={`${workspace.parameters.maxEquityPercent}% · ${formatCompactRupiah(depositLimit)}`} />
          <SummaryValue label="Limit used after placement" value={`${limitUse.toFixed(1)}%`} />
        </div>
      </Panel>

      {proposal.status !== "Ready" ? (
        <Panel><EmptyState title={proposal.status === "Not required" ? "No placement required" : "No compliant proposal"} description={proposal.explanation} /></Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel className="xl:col-span-8">
            <PanelHeading title="Suggested placements" detail="Rank, rate and allocation limits are shown for every bank." action={<Button variant="outline" size="sm" onClick={() => exportCsv("deposit-proposal.csv", proposal.lines.map((line) => ({ Bank: line.bankName, Rank: line.rank, Amount: line.amount, Rate: `${line.annualRate}%`, Tenor: `${line.tenorDays} days`, Maturity: line.maturityDate, Reason: line.reason })))}><Download className="size-3.5" aria-hidden="true" />Export</Button>} />
            <div className="table-wrap">
              <table className="data-table min-w-[720px]">
                <thead><tr><th>Bank</th><th>Placement</th><th>Rate</th><th>Tenor</th><th>Maturity</th><th>Status</th><th className="text-right">Edit</th></tr></thead>
                <tbody>
                  {proposal.lines.map((line) => (
                    <tr key={line.id}>
                      <td><div className="flex items-center gap-2"><span className="rank-mark">{line.rank}</span><div><p className="font-medium text-foreground">{line.bankName}</p><p className="mt-1 text-[10px] text-muted-foreground">{line.reason}</p></div></div></td>
                      <td className="whitespace-nowrap font-mono font-medium tabular-nums text-foreground">{formatCompactRupiah(line.amount)}</td>
                      <td className="font-mono tabular-nums">{line.annualRate.toFixed(2)}%</td>
                      <td>{line.tenorDays} days</td>
                      <td className="whitespace-nowrap">{formatDate(line.maturityDate)}</td>
                      <td><StatusBadge status={line.status} /></td>
                      <td className="text-right"><Button variant="ghost" size="icon" className="size-8" aria-label={`Adjust allocation for ${line.bankName}`} title="Adjust allocation" onClick={() => onEdit(line)} disabled={workspace.allocationState !== "Draft"}><Pencil /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-xs text-positive"><CheckCircle2 className="size-4" aria-hidden="true" />No configured limit violations</div>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">Total · {formatRupiah(total)}</span>
            </div>
          </Panel>

          <div className="space-y-4 xl:col-span-4">
            <Panel>
              <PanelHeading title="Constraint check" detail="Validated against current parameters" />
              <div className="space-y-3">
                <ConstraintRow label="Cash after placement" value={formatCompactRupiah(Math.max(0, workspace.parameters.availableCash - total))} status="Within cash" />
                <ConstraintRow label="Deposits vs. equity" value={`${((afterPlacement / workspace.parameters.equity) * 100).toFixed(1)}% / ${workspace.parameters.maxEquityPercent}%`} status="Within limit" />
                <ConstraintRow label="Minimum placement" value={formatCompactRupiah(workspace.parameters.minimumPlacement)} status="Satisfied" />
                <ConstraintRow label="Bank ranking" value={`${proposal.lines.length} ranked banks`} status="Applied" />
              </div>
            </Panel>
            <Panel>
              <PanelHeading title="Why this proposal" detail="Deterministic calculation · no AI" />
              <div className="space-y-3 text-xs leading-5 text-muted-foreground">
                <p className="flex gap-2"><span className="reason-index">1</span><span>Only active, ranked banks are considered, in rank order.</span></p>
                <p className="flex gap-2"><span className="reason-index">2</span><span>Placement shares follow the bank allocation parameters and deposit rate.</span></p>
                <p className="flex gap-2"><span className="reason-index">3</span><span>Total deposits remain below the equity limit and available cash.</span></p>
              </div>
              <div className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground">Parameters last changed · 24 Nov 2026 · Sample workspace</div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1.5 font-mono text-sm font-medium tabular-nums text-foreground">{value}</p></div>;
}

function ConstraintRow({ label, value, status }: { label: string; value: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <div><p className="text-xs font-medium text-foreground">{label}</p><p className="mt-1 text-[11px] text-muted-foreground">{value}</p></div>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-positive"><Check className="size-3" aria-hidden="true" />{status}</span>
    </div>
  );
}

function BankRankingView({
  banks,
  onEdit,
  onExport,
}: {
  banks: Bank[];
  onEdit: (bank: Bank) => void;
  onExport: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniMetric label="Ranked active banks" value={String(banks.filter((bank) => bank.active).length).padStart(2, "0")} detail="Eligible for placement" tone="positive" />
        <MiniMetric label="Top annual rate" value={`${Math.max(...banks.map((bank) => bank.depositRate)).toFixed(2)}%`} detail={[...banks].sort((a, b) => b.depositRate - a.depositRate)[0]?.name ?? "No bank"} tone="positive" />
        <MiniMetric label="Current deposits" value={formatCompactRupiah(banks.reduce((sum, bank) => sum + bank.depositBalance, 0))} detail="Across ranked institutions" tone="warning" />
      </div>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-foreground">Bank ranking register</h2><p className="mt-1 text-xs text-muted-foreground">Changes here affect the next proposal run.</p></div>
          <Button variant="outline" size="sm" onClick={onExport}><Download className="size-3.5" aria-hidden="true" />Export ranking</Button>
        </div>
        <div className="table-wrap">
          <table className="data-table min-w-[940px]">
            <thead><tr><th>Rank</th><th>Bank</th><th>Deposit rate</th><th>Service</th><th>Credit rating</th><th>NPL</th><th>NIM</th><th>CAR</th><th>Max share</th><th>Status</th><th className="text-right">Edit</th></tr></thead>
            <tbody>
              {[...banks].sort((a, b) => a.rank - b.rank).map((bank) => (
                <tr key={bank.id}>
                  <td><span className="rank-mark rank-mark-large">{String(bank.rank).padStart(2, "0")}</span></td>
                  <td><div className="font-medium text-foreground">{bank.name}</div><div className="mt-1 text-[10px] text-muted-foreground">Deposit balance · {formatCompactRupiah(bank.depositBalance)}</div></td>
                  <td className="font-mono font-medium tabular-nums text-foreground">{bank.depositRate.toFixed(2)}% p.a.</td>
                  <td>{bank.serviceRating}</td><td>{bank.creditRating}</td><td>{bank.npl.toFixed(1)}%</td><td>{bank.nim.toFixed(1)}%</td><td>{bank.car.toFixed(1)}%</td><td>{bank.maxAllocationPercent}%</td>
                  <td><StatusBadge status={bank.active ? "Active" : "Inactive"} /></td>
                  <td className="text-right"><Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${bank.name}`} onClick={() => onEdit(bank)}><Pencil /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden="true" /><span>Only active, ranked banks are used for recommendations. The sample allocation-share limits total 100%.</span></div>
      </Panel>
    </div>
  );
}

function ApprovalsView({
  approvals,
  onApprove,
  onReject,
}: {
  approvals: ApprovalItem[];
  onApprove: (id: string) => void;
  onReject: (item: ApprovalItem) => void;
}) {
  const pending = approvals.filter((item) => item.status === "Pending");
  const history = approvals.filter((item) => item.status !== "Pending");
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniMetric label="Waiting for decision" value={String(pending.length).padStart(2, "0")} detail="Current approval stage" tone="warning" />
        <MiniMetric label="Approval stages" value="03" detail="Sequential, no steps skipped" tone="positive" />
        <MiniMetric label="Completed this cycle" value={String(history.filter((item) => item.status === "Approved").length).padStart(2, "0")} detail="Approval history shown below" tone="positive" />
      </div>
      <Panel>
        <PanelHeading title="Pending decisions" detail="Treasury Dept. Head → Finance Accounting Div. Head → Finance Accounting Director" />
        {pending.length ? (
          <div className="table-wrap"><table className="data-table min-w-[840px]"><thead><tr><th>Document</th><th>Type</th><th>Current approver</th><th>Stage</th><th>Amount</th><th>Submitted</th><th className="text-right">Decision</th></tr></thead><tbody>
            {pending.map((item) => {
              const currentApprover = APPROVAL_STEPS[item.step] ?? APPROVAL_STEPS[0];
              return <tr key={item.id}><td><div className="font-medium text-foreground">{item.document}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.id} · by {item.submittedBy}</div></td><td>{item.type}</td><td>{currentApprover}</td><td><span className="step-pill">{item.step + 1} / 3</span></td><td className="whitespace-nowrap font-mono tabular-nums">{formatCompactRupiah(item.amount)}</td><td className="whitespace-nowrap">{formatDate(item.submittedAt)}</td><td className="text-right"><div className="inline-flex gap-1"><Button variant="outline" size="sm" onClick={() => onApprove(item.id)}>Approve</Button><Button variant="ghost" size="sm" className="text-warning" onClick={() => onReject(item)}>Return</Button></div></td></tr>;
            })}
          </tbody></table></div>
        ) : <EmptyState title="Approval queue is clear" description="New submissions will be routed to the first approver." />}
      </Panel>
      <Panel>
        <PanelHeading title="Decision history" detail="Approved and returned documents" />
        {history.length ? <div className="divide-y divide-border">{history.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-xs font-medium text-foreground">{item.document}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.id} · submitted {formatDate(item.submittedAt)}</p>{item.comment ? <p className="mt-1 text-[11px] text-warning">Return note: {item.comment}</p> : null}</div><div className="flex items-center gap-3"><span className="font-mono text-xs tabular-nums">{formatCompactRupiah(item.amount)}</span><StatusBadge status={item.status} /></div></div>)}</div> : <EmptyState title="No completed decisions yet" description="A document will appear here after a final decision." />}
      </Panel>
    </div>
  );
}

function InstructionsView({
  instructions,
  canCreate,
  onCreate,
  onSubmit,
  onMarkSent,
  onPrint,
}: {
  instructions: BankInstruction[];
  canCreate: boolean;
  onCreate: () => void;
  onSubmit: (id: string) => void;
  onMarkSent: (id: string) => void;
  onPrint: (item: BankInstruction) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><div className="action-callout-icon"><FileSpreadsheet className="size-4" aria-hidden="true" /></div><div><p className="text-sm font-medium text-foreground">Instruction source</p><p className="mt-1 text-xs text-muted-foreground">Create a draft from an approved allocation and ERP voucher.</p></div></div>
        <Button onClick={onCreate} disabled={!canCreate}><Plus className="size-4" aria-hidden="true" />Create instruction</Button>
      </div>
      {!canCreate && instructions.length === 0 ? <p className="text-xs text-muted-foreground">A proposal must pass approval and voucher creation before it can generate a bank instruction.</p> : null}
      <Panel>
        <PanelHeading title="Instruction register" detail="The final bank transfer remains a manual, signed action." />
        {instructions.length ? <div className="table-wrap"><table className="data-table min-w-[920px]"><thead><tr><th>Instruction</th><th>Bank</th><th>Voucher</th><th>Amount</th><th>Maturity</th><th>Template</th><th>Status</th><th className="text-right">Actions</th></tr></thead><tbody>
          {instructions.map((item) => <tr key={item.id}><td><div className="font-medium text-foreground">{item.id}</div><div className="mt-1 text-[10px] text-muted-foreground">Created {formatDate(item.createdAt)}</div></td><td>{item.bankName}</td><td className="font-mono text-xs">{item.voucherNumber}</td><td className="font-mono tabular-nums">{formatCompactRupiah(item.amount)}</td><td>{formatDate(item.maturityDate)}</td><td>{item.template}</td><td><StatusBadge status={item.status} /></td><td className="text-right"><div className="inline-flex gap-1">{item.status === "Draft" ? <Button variant="outline" size="sm" onClick={() => onSubmit(item.id)}>Submit</Button> : null}{item.status === "Approved" ? <Button variant="outline" size="sm" onClick={() => onMarkSent(item.id)}>Mark sent</Button> : null}<Button variant="ghost" size="icon" className="size-8" aria-label={`Print ${item.id}`} title="Print instruction" onClick={() => onPrint(item)}><FileText /></Button></div></td></tr>)}
        </tbody></table></div> : <EmptyState title="No bank instructions yet" description="Approved placements with vouchers can be turned into bank instructions." />}
      </Panel>
      <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Once approved, print the instruction and record when the signed document is sent to the bank. Bank execution is not automated.</span></div>
    </div>
  );
}

function ReportsView({ workspace, onExport, onPrint }: { workspace: WorkspaceData; onExport: (kind: "cashflow" | "allocation" | "position") => void; onPrint: () => void }) {
  const totalDeposits = workspace.banks.reduce((sum, bank) => sum + bank.depositBalance, 0);
  const incoming = workspace.cashflows.filter((item) => item.direction === "Incoming").reduce((sum, item) => sum + item.amount, 0);
  const outgoing = workspace.cashflows.filter((item) => item.direction === "Outgoing").reduce((sum, item) => sum + item.amount, 0);
  const reports = [
    { name: "Balance & Deposit Allocation", period: "November 2026", generated: "24 Nov 2026", status: "Ready", kind: "allocation" as const, icon: FileCheck2, detail: "Current proposal, rate and equity-limit comparison" },
    { name: "Deposit Position as of", period: "24 November 2026", generated: "24 Nov 2026", status: "Ready", kind: "position" as const, icon: Landmark, detail: "Bank-by-bank balance, share and maturity date" },
    { name: "Cash Flow Forecast", period: "Week 48 · 2026", generated: "24 Nov 2026", status: "Ready", kind: "cashflow" as const, icon: Activity, detail: "Actual and forecast inflows and outflows" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><MiniMetric label="Total equity" value={formatCompactRupiah(workspace.parameters.equity)} detail="Current parameter set" tone="positive" /><MiniMetric label="Total time deposits" value={formatCompactRupiah(totalDeposits)} detail={`${((totalDeposits / workspace.parameters.equity) * 100).toFixed(1)}% of equity`} tone="positive" /><MiniMetric label="Net forecast cash flow" value={formatCompactRupiah(incoming - outgoing)} detail="Week 48 · IDR" tone={incoming >= outgoing ? "positive" : "warning"} /></div>
      <Panel>
        <PanelHeading title="Available reports" detail="Export a spreadsheet or print to PDF." action={<Button variant="outline" size="sm" onClick={onPrint}><Download className="size-3.5" aria-hidden="true" />Print report</Button>} />
        <div className="divide-y divide-border">
          {reports.map((report) => {
            const Icon = report.icon;
            return <div key={report.name} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="report-icon"><Icon className="size-4" aria-hidden="true" /></div><div><p className="text-sm font-medium text-foreground">{report.name}</p><p className="mt-1 text-xs text-muted-foreground">{report.detail}</p><p className="mt-1.5 text-[10px] text-muted-foreground">{report.period} · Generated {report.generated}</p></div></div><div className="flex items-center gap-2"><StatusBadge status={report.status} /><Button variant="outline" size="sm" onClick={() => onExport(report.kind)}><FileSpreadsheet className="size-3.5" aria-hidden="true" />Export CSV</Button></div></div>;
          })}
        </div>
      </Panel>
      <Panel>
        <PanelHeading title="Current position snapshot" detail="As of 24 November 2026 · sample values" />
        <div className="table-wrap"><table className="data-table min-w-[760px]"><thead><tr><th>Bank</th><th>Deposit balance</th><th>Share of total</th><th>Rate</th><th>Rank</th><th>Forecast interest · 90d</th></tr></thead><tbody>{workspace.banks.map((bank) => <tr key={bank.id}><td className="font-medium text-foreground">{bank.name}</td><td className="font-mono tabular-nums">{formatRupiah(bank.depositBalance)}</td><td>{totalDeposits ? `${((bank.depositBalance / totalDeposits) * 100).toFixed(1)}%` : "0%"}</td><td>{bank.depositRate.toFixed(2)}%</td><td><span className="rank-mark">{bank.rank}</span></td><td className="font-mono tabular-nums">{formatRupiah((bank.depositBalance * bank.depositRate * 90) / 36_500 / 100)}</td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  );
}

function ArchiveView({ workspace, onExport }: { workspace: WorkspaceData; onExport: () => void }) {
  const [query, setQuery] = useState("");
  const records = useMemo(() => {
    const entries = [
      ...workspace.cashflows.map((item) => ({ id: item.id, name: item.reference, type: "Cash flow form", date: item.dueDate, status: item.status, detail: item.department })),
      ...workspace.approvals.map((item) => ({ id: item.id, name: item.document, type: item.type, date: item.submittedAt, status: item.status, detail: `Submitted by ${item.submittedBy}` })),
      ...workspace.instructions.map((item) => ({ id: item.id, name: `${item.bankName} bank instruction`, type: "Bank instruction", date: item.createdAt, status: item.status, detail: item.voucherNumber })),
    ];
    return entries.filter((record) => `${record.name} ${record.id} ${record.type} ${record.detail}`.toLowerCase().includes(query.toLowerCase()));
  }, [workspace, query]);
  return (
    <Panel>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-sm font-semibold text-foreground">Document archive</h2><p className="mt-1 text-xs text-muted-foreground">Search by document, reference or department.</p></div>
        <div className="flex gap-2"><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input aria-label="Search archive" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents..." className="h-9 pl-9 text-xs" /></div><Button variant="outline" size="sm" onClick={onExport}><Download className="size-3.5" aria-hidden="true" />Export</Button></div>
      </div>
      {records.length ? <div className="table-wrap"><table className="data-table min-w-[760px]"><thead><tr><th>Document</th><th>Type</th><th>Detail</th><th>Date</th><th>Status</th></tr></thead><tbody>{records.map((record) => <tr key={`${record.type}-${record.id}`}><td><div className="font-medium text-foreground">{record.name}</div><div className="mt-1 text-[10px] text-muted-foreground">{record.id}</div></td><td>{record.type}</td><td>{record.detail}</td><td className="whitespace-nowrap">{formatDate(record.date)}</td><td><StatusBadge status={record.status} /></td></tr>)}</tbody></table></div> : <EmptyState title="No matching archive records" description="Try searching for a different document or reference." />}
      <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">{records.length} records · Local sample workspace</div>
    </Panel>
  );
}

function MasterDataView({
  parameters,
  onSaveParameters,
}: {
  parameters: DepositParameters;
  onSaveParameters: (next: DepositParameters) => void;
}) {
  const [tab, setTab] = useState<"Parameters" | "Calendars" | "Categories" | "Templates">("Parameters");
  const [draft, setDraft] = useState(parameters);
  useEffect(() => setDraft(parameters), [parameters]);
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveParameters(draft);
  };
  const tabs = ["Parameters", "Calendars", "Categories", "Templates"] as const;
  return (
    <Panel>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-border pb-3">
        {tabs.map((item) => <Button key={item} variant={tab === item ? "secondary" : "ghost"} size="sm" className="h-8 text-xs" onClick={() => setTab(item)}>{item}</Button>)}
      </div>
      {tab === "Parameters" ? (
        <form onSubmit={save} className="max-w-3xl">
          <div className="mb-5"><h2 className="text-sm font-semibold text-foreground">Placement constraints</h2><p className="mt-1 text-xs text-muted-foreground">Values shown here are editable sample parameters.</p></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ParameterInput label="Deposit trigger (IDR)" value={draft.depositTrigger} onChange={(value) => setDraft({ ...draft, depositTrigger: value })} />
            <ParameterInput label="Maximum deposits (% of equity)" value={draft.maxEquityPercent} onChange={(value) => setDraft({ ...draft, maxEquityPercent: value })} />
            <ParameterInput label="Minimum placement (IDR)" value={draft.minimumPlacement} onChange={(value) => setDraft({ ...draft, minimumPlacement: value })} />
            <ParameterInput label="Equity (IDR)" value={draft.equity} onChange={(value) => setDraft({ ...draft, equity: value })} />
            <ParameterInput label="Existing deposits (IDR)" value={draft.existingDeposits} onChange={(value) => setDraft({ ...draft, existingDeposits: value })} />
            <ParameterInput label="Available cash (IDR)" value={draft.availableCash} onChange={(value) => setDraft({ ...draft, availableCash: value })} />
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span className="text-[11px] text-muted-foreground">Values are saved to this browser only.</span><Button type="submit"><Check className="size-4" aria-hidden="true" />Save parameters</Button></div>
        </form>
      ) : null}
      {tab === "Calendars" ? <MasterList title="Settlement calendars" description="Sample calendars and non-working days used to calculate maturity dates." columns={["Calendar", "Source", "Last updated", "Status"]} rows={[["National holidays", "Master data", "02 Jan 2026", "Current"], ["IDBM calendar", "Master data", "02 Jan 2026", "Current"], ["Bank Indonesia", "Master data", "02 Jan 2026", "Current"], ["Bank-specific maturity", "Bank ranking", "24 Nov 2026", "Current"]]} /> : null}
      {tab === "Categories" ? <MasterList title="Cash flow categories" description="Categories used by department forms and the forecast." columns={["Category", "Direction", "Source", "Status"]} rows={[["Supplier payment", "Outgoing", "ERP / AP", "Active"], ["Customer collection", "Incoming", "ERP / AR", "Active"], ["Payroll", "Outgoing", "Department form", "Active"], ["Utilities", "Outgoing", "Department form", "Active"], ["Scrap sales", "Incoming", "ERP / forecast", "Active"], ["Sales business plan", "Incoming", "Department form", "Active"]]} /> : null}
      {tab === "Templates" ? <MasterList title="Bank instruction templates" description="Templates applied to the bank instruction draft." columns={["Template", "Bank", "Format", "Status"]} rows={[["BCA — Fixed deposit", "Bank Central Asia", "PDF layout", "Active"], ["Mandiri — Universal", "Bank Mandiri", "Universal", "Active"], ["BNI — Time deposit", "Bank Negara Indonesia", "PDF layout", "Active"], ["CIMB — Placement", "CIMB Niaga", "PDF layout", "Active"]]} /> : null}
    </Panel>
  );
}

function ParameterInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span><Input type="number" min="0" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function MasterList({ title, description, columns, rows }: { title: string; description: string; columns: string[]; rows: string[][] }) {
  return <div><div className="mb-4"><h2 className="text-sm font-semibold text-foreground">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><div className="table-wrap"><table className="data-table min-w-[620px]"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((value, index) => <td key={`${row[0]}-${index}`}>{index === row.length - 1 ? <StatusBadge status={value} /> : value}</td>)}</tr>)}</tbody></table></div><div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">Reference data · Sample workspace</div></div>;
}

function CashflowFormDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: { reference: string; department: string; category: string; direction: "Incoming" | "Outgoing"; amount: number; dueDate: string }) => void;
}) {
  const [form, setForm] = useState({ reference: "", department: "", category: "", direction: "Outgoing" as "Incoming" | "Outgoing", amount: "", dueDate: "2026-11-30" });
  useEffect(() => {
    if (open) setForm({ reference: "", department: "", category: "", direction: "Outgoing", amount: "", dueDate: "2026-11-30" });
  }, [open]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.reference.trim() || !form.department.trim() || !form.category.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Complete each field with a valid amount.");
      return;
    }
    onSave({ ...form, amount });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New expenditure form</DialogTitle><DialogDescription>Enter a department cash flow item for the current period.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="field-label">Reference</span><Input autoFocus value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="e.g. November payroll" /></label>
            <label className="block"><span className="field-label">Department</span><Input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} placeholder="Department name" /></label>
            <label className="block"><span className="field-label">Category</span><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="e.g. Payroll" /></label>
            <label className="block"><span className="field-label">Amount · IDR</span><Input type="number" min="1" step="1000" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0" /></label>
            <label className="block"><span className="field-label">Due date</span><Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
          </div>
          <div><span className="field-label">Cash flow direction</span><div className="mt-1 grid grid-cols-2 gap-2"><Button type="button" variant={form.direction === "Incoming" ? "secondary" : "outline"} onClick={() => setForm({ ...form, direction: "Incoming" })}><ArrowUpRight className="size-4" aria-hidden="true" />Incoming</Button><Button type="button" variant={form.direction === "Outgoing" ? "secondary" : "outline"} onClick={() => setForm({ ...form, direction: "Outgoing" })}><ArrowDownRight className="size-4" aria-hidden="true" />Outgoing</Button></div></div>
          <DialogFooter><Button type="submit"><Plus className="size-4" aria-hidden="true" />Save as draft</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AllocationEditDialog({
  line,
  open,
  onOpenChange,
  onSave,
}: {
  line: AllocationLine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, amount: number, tenorDays: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [tenor, setTenor] = useState("90");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (line) {
      setAmount(String(line.amount));
      setTenor(String(line.tenorDays));
      setReason("");
    }
  }, [line]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextAmount = Number(amount);
    const nextTenor = Number(tenor);
    if (!line || !Number.isFinite(nextAmount) || nextAmount <= 0 || !Number.isInteger(nextTenor) || nextTenor < 1 || !reason.trim()) {
      toast.error("Enter a valid amount, tenor and adjustment reason.");
      return;
    }
    onSave(line.id, nextAmount, nextTenor, reason.trim());
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust placement</DialogTitle><DialogDescription>{line ? `Update the suggested amount or tenor for ${line.bankName}.` : "Update the suggested placement."}</DialogDescription></DialogHeader>
        {line ? <form onSubmit={submit} className="space-y-4"><label className="block"><span className="field-label">Placement amount · IDR</span><Input type="number" min="1" step="1000000" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label className="block"><span className="field-label">Tenor · business days</span><Input type="number" min="1" step="1" value={tenor} onChange={(event) => setTenor(event.target.value)} /></label><label className="block"><span className="field-label">Reason for adjustment</span><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for audit trail" /></label><DialogFooter><Button type="submit"><Check className="size-4" aria-hidden="true" />Save adjustment</Button></DialogFooter></form> : null}
      </DialogContent>
    </Dialog>
  );
}

function BankEditDialog({
  bank,
  open,
  onOpenChange,
  onSave,
}: {
  bank: Bank | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (bank: Bank) => void;
}) {
  const [draft, setDraft] = useState<Bank | null>(bank);
  useEffect(() => setDraft(bank), [bank]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || draft.rank < 1 || draft.depositRate <= 0 || draft.maxAllocationPercent < 0) {
      toast.error("Use a positive ranking and rate, and a non-negative bank limit.");
      return;
    }
    onSave(draft);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit bank ranking</DialogTitle><DialogDescription>{bank?.name ?? "Update bank details"} · applies to the next calculation.</DialogDescription></DialogHeader>
        {draft ? <form onSubmit={submit} className="space-y-4"><div className="grid grid-cols-2 gap-3"><ParameterInput label="Rank" value={draft.rank} onChange={(value) => setDraft({ ...draft, rank: value })} /><ParameterInput label="Deposit rate (%)" value={draft.depositRate} onChange={(value) => setDraft({ ...draft, depositRate: value })} /><ParameterInput label="Maximum allocation share (%)" value={draft.maxAllocationPercent} onChange={(value) => setDraft({ ...draft, maxAllocationPercent: value })} /><label className="flex items-center gap-2 self-end pb-2 text-xs text-foreground"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Active for placement</label></div><DialogFooter><Button type="submit"><Check className="size-4" aria-hidden="true" />Save bank</Button></DialogFooter></form> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({
  item,
  open,
  onOpenChange,
  onReturn,
}: {
  item: ApprovalItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReturn: (id: string, note: string) => void;
}) {
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [item]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item || !note.trim()) {
      toast.error("Add a return note before sending this document back.");
      return;
    }
    onReturn(item.id, note.trim());
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Return for revision</DialogTitle><DialogDescription>{item?.document ?? "Add a note for Cash Bank."}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4"><label className="block"><span className="field-label">Reason</span><Input autoFocus value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe the required change" /></label><DialogFooter><Button type="submit" variant="outline">Return document</Button></DialogFooter></form>
      </DialogContent>
    </Dialog>
  );
}

export default function DepositDesk() {
  const [workspace, setWorkspace] = useState<WorkspaceData>(DEMO_WORKSPACE);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [theme, setTheme] = useState<Theme>("light");
  const [themeReady, setThemeReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<AllocationLine | null>(null);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [returningApproval, setReturningApproval] = useState<ApprovalItem | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isWorkspaceData(parsed)) setWorkspace(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setWorkspaceReady(true);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    const initialTheme: Theme = saved === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
    setTheme(initialTheme);
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!workspaceReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace, workspaceReady]);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme, themeReady]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const pendingCount = workspace.approvals.filter((item) => item.status === "Pending").length;

  const toggleTheme = () => setTheme((current) => current === "light" ? "dark" : "light");

  const recalculateProposal = () => {
    const date = new Date().toISOString().slice(0, 10);
    setWorkspace((current) => {
      const proposal = runAllocationProposal(current.parameters, current.banks, date);
      return withAudit({ ...current, proposal, allocationState: "Draft" }, "Allocation recalculated", `${formatCompactRupiah(proposal.totalAllocated)} · ${proposal.status}`);
    });
    toast.success("Allocation proposal recalculated.");
  };

  const submitProposal = () => {
    if (workspace.proposal.status !== "Ready" || workspace.allocationState !== "Draft") {
      toast.error("Calculate a compliant proposal before requesting approval.");
      return;
    }
    const approval: ApprovalItem = {
      id: `APR-${Date.now()}`,
      document: "November placement proposal",
      type: "Monthly report",
      amount: workspace.proposal.totalAllocated,
      step: 0,
      status: "Pending",
      submittedAt: new Date().toISOString().slice(0, 10),
      submittedBy: "Cash Bank",
    };
    setWorkspace((current) => withAudit({ ...current, approvals: [approval, ...current.approvals], allocationState: "In review" }, "Proposal submitted", approval.document));
    toast.success("Proposal sent to the first approver.");
  };

  const approveDocument = (id: string) => {
    const item = workspace.approvals.find((approval) => approval.id === id);
    if (!item || item.status !== "Pending") return;
    const finalStep = item.step >= APPROVAL_STEPS.length - 1;
    const nextStep = Math.min(item.step + 1, APPROVAL_STEPS.length - 1);
    setWorkspace((current) => {
      let next: WorkspaceData = {
        ...current,
        approvals: current.approvals.map((approval) => approval.id === id ? { ...approval, step: nextStep, status: finalStep ? "Approved" : "Pending" } : approval),
      };
      if (finalStep && item.document === "November placement proposal") {
        next = { ...next, allocationState: "Approved", proposal: { ...next.proposal, lines: next.proposal.lines.map((line) => ({ ...line, status: "Approved" })) } };
      }
      if (finalStep && item.type === "Bank instruction") {
        next = { ...next, instructions: next.instructions.map((instruction) => item.document.startsWith(instruction.id) ? { ...instruction, status: "Approved" } : instruction) };
      }
      const event = finalStep ? "Approval completed" : "Approval advanced";
      const detail = finalStep ? item.document : `${item.document} · ${APPROVAL_STEPS[nextStep] ?? "Next approver"}`;
      return withAudit(next, event, detail, APPROVAL_STEPS[item.step] ?? "Approver");
    });
    toast.success(finalStep ? "Final approval recorded." : `Sent to ${APPROVAL_STEPS[nextStep] ?? "next approver"}.`);
  };

  const returnDocument = (id: string, note: string) => {
    const item = workspace.approvals.find((approval) => approval.id === id);
    if (!item) return;
    setWorkspace((current) => {
      let next: WorkspaceData = { ...current, approvals: current.approvals.map((approval) => approval.id === id ? { ...approval, status: "Returned", comment: note } : approval) };
      if (item.document === "November placement proposal") next = { ...next, allocationState: "Draft", proposal: { ...next.proposal, lines: next.proposal.lines.map((line) => ({ ...line, status: "Suggested" })) } };
      if (item.type === "Bank instruction") next = { ...next, instructions: next.instructions.map((instruction) => item.document.startsWith(instruction.id) ? { ...instruction, status: "Draft" } : instruction) };
      return withAudit(next, "Document returned", `${item.document} · ${note}`, APPROVAL_STEPS[item.step] ?? "Approver");
    });
    toast.success("Document returned to Cash Bank with a note.");
  };

  const validateCashflow = (id: string) => {
    const item = workspace.cashflows.find((cashflow) => cashflow.id === id);
    if (!item) return;
    setWorkspace((current) => withAudit({ ...current, cashflows: current.cashflows.map((cashflow) => cashflow.id === id ? { ...cashflow, status: "Validated" } : cashflow) }, "Cash flow validated", item.reference));
    toast.success("Cash flow validated.");
  };

  const requestRevision = (id: string) => {
    const item = workspace.cashflows.find((cashflow) => cashflow.id === id);
    if (!item) return;
    setWorkspace((current) => withAudit({ ...current, cashflows: current.cashflows.map((cashflow) => cashflow.id === id ? { ...cashflow, status: "Need revision" } : cashflow) }, "Cash flow returned", `${item.reference} · Please review the amount and due date.`));
    toast.success("Form returned for revision.");
  };

  const calculateBalance = () => {
    const net = workspace.cashflows.filter((item) => item.status === "Validated").reduce((sum, item) => sum + (item.direction === "Incoming" ? item.amount : -item.amount), 0);
    setWorkspace((current) => withAudit({ ...current, cashBalance: Math.max(0, current.cashBalance + net) }, "Cash balance calculated", `Validated net movement · ${formatCompactRupiah(net)}`));
    toast.success("Cash balance recalculated from validated items.");
  };

  const addCashflow = (item: { reference: string; department: string; category: string; direction: "Incoming" | "Outgoing"; amount: number; dueDate: string }) => {
    const cashflow: CashflowItem = { ...item, id: `CF-${Date.now()}`, source: "Department form", status: "Draft" };
    setWorkspace((current) => withAudit({ ...current, cashflows: [cashflow, ...current.cashflows] }, "Cash flow form created", cashflow.reference));
    toast.success("Draft form saved.");
  };

  const editAllocation = (id: string, amount: number, tenorDays: number, reason: string) => {
    const original = workspace.proposal.lines.find((line) => line.id === id);
    if (!original) return;
    const maturityDate = addBusinessDays(new Date().toISOString().slice(0, 10), tenorDays);
    const lines = workspace.proposal.lines.map((line) => line.id === id ? { ...line, amount, tenorDays, maturityDate, status: "Adjusted" as const, reason: `Manual override · ${reason}` } : line);
    const validation = validateAllocationLines(lines, workspace.parameters);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }
    const totalAllocated = lines.reduce((sum, line) => sum + line.amount, 0);
    setWorkspace((current) => withAudit({ ...current, proposal: { ...current.proposal, lines, totalAllocated, remainingCash: current.parameters.availableCash - totalAllocated }, allocationState: "Draft" }, "Allocation adjusted", `${original.bankName} · ${formatCompactRupiah(original.amount)} → ${formatCompactRupiah(amount)} · ${reason}`));
    setEditingAllocation(null);
    toast.success(validation.message);
  };

  const saveBank = (bank: Bank) => {
    setWorkspace((current) => withAudit({ ...current, banks: current.banks.map((entry) => entry.id === bank.id ? bank : entry) }, "Bank ranking updated", `${bank.name} · rank ${bank.rank} · ${bank.depositRate.toFixed(2)}%`));
    setEditingBank(null);
    toast.success("Bank ranking saved.");
  };

  const saveParameters = (parameters: DepositParameters) => {
    if (parameters.maxEquityPercent > 100 || parameters.depositTrigger < 0 || parameters.minimumPlacement < 0 || parameters.equity <= 0) {
      toast.error("Review the parameter values and try again.");
      return;
    }
    setWorkspace((current) => {
      const proposal = runAllocationProposal(parameters, current.banks, new Date().toISOString().slice(0, 10));
      return withAudit({ ...current, parameters, proposal, allocationState: "Draft" }, "Placement parameters updated", `Equity cap ${parameters.maxEquityPercent}% · minimum ${formatCompactRupiah(parameters.minimumPlacement)}`);
    });
    toast.success("Parameters saved and the proposal recalculated.");
  };

  const createVouchers = () => {
    if (workspace.allocationState !== "Approved" || workspace.proposal.lines.length === 0) {
      toast.error("Complete all approval stages before creating vouchers.");
      return;
    }
    setWorkspace((current) => {
      const run = Date.now().toString().slice(-4);
      const lines = current.proposal.lines.map((line, index) => ({ ...line, status: "Voucher created" as const, voucherNumber: `VCH-26-${run}-${index + 1}` }));
      return withAudit({ ...current, proposal: { ...current.proposal, lines }, allocationState: "Voucher created" }, "ERP vouchers created", `${lines.length} simulated vouchers · ${lines.map((line) => line.voucherNumber).join(", ")}`, "System (demo)");
    });
    toast.success("Sample ERP vouchers created without duplicates.");
  };

  const createInstructions = () => {
    if (workspace.allocationState !== "Voucher created") {
      toast.error("Create vouchers from an approved allocation first.");
      return;
    }
    const newInstructions = workspace.proposal.lines.filter((line) => line.voucherNumber && !workspace.instructions.some((item) => item.voucherNumber === line.voucherNumber)).map((line) => ({
      id: `BI-${Date.now().toString().slice(-6)}-${line.rank}`,
      bankName: line.bankName,
      amount: line.amount,
      voucherNumber: line.voucherNumber ?? "",
      maturityDate: line.maturityDate,
      status: "Draft" as const,
      template: `${line.bankName} · Universal template`,
      createdAt: new Date().toISOString().slice(0, 10),
    }));
    if (!newInstructions.length) {
      toast.info("Instructions have already been created for these vouchers.");
      return;
    }
    setWorkspace((current) => withAudit({ ...current, instructions: [...newInstructions, ...current.instructions] }, "Bank instructions drafted", `${newInstructions.length} instruction(s) created from approved vouchers`));
    toast.success(`${newInstructions.length} bank instruction draft(s) created.`);
  };

  const submitInstruction = (id: string) => {
    const instruction = workspace.instructions.find((item) => item.id === id);
    if (!instruction || instruction.status !== "Draft") return;
    const approval: ApprovalItem = {
      id: `APR-${Date.now()}`,
      document: `${instruction.id} · ${instruction.bankName} placement`,
      type: "Bank instruction",
      amount: instruction.amount,
      step: 0,
      status: "Pending",
      submittedAt: new Date().toISOString().slice(0, 10),
      submittedBy: "Cash Bank",
    };
    setWorkspace((current) => withAudit({ ...current, approvals: [approval, ...current.approvals], instructions: current.instructions.map((item) => item.id === id ? { ...item, status: "In approval" } : item) }, "Bank instruction submitted", approval.document));
    toast.success("Instruction sent to the first approver.");
  };

  const markInstructionSent = (id: string) => {
    const item = workspace.instructions.find((instruction) => instruction.id === id);
    if (!item || item.status !== "Approved") return;
    setWorkspace((current) => withAudit({ ...current, instructions: current.instructions.map((instruction) => instruction.id === id ? { ...instruction, status: "Sent to bank" } : instruction) }, "Instruction sent to bank", `${item.id} · manual delivery recorded`));
    toast.success("Manual delivery recorded.");
  };

  const syncErp = () => {
    const syncedAt = new Date().toISOString();
    setWorkspace((current) => withAudit({ ...current, lastErpSync: syncedAt }, "Sample ERP sync completed", "24 simulated supplier, customer and scrap-sales records", "System (demo)"));
    toast.success("Sample ERP feed refreshed · 24 records.");
  };

  const exportCashflows = () => exportCsv("cash-flow-register.csv", workspace.cashflows.map((item) => ({ Reference: item.reference, ID: item.id, Department: item.department, Category: item.category, Direction: item.direction, Source: item.source, AmountIDR: item.amount, DueDate: item.dueDate, Status: item.status })));
  const exportAllocation = () => exportCsv("deposit-proposal.csv", workspace.proposal.lines.map((line) => ({ Bank: line.bankName, Rank: line.rank, AmountIDR: line.amount, Rate: `${line.annualRate}%`, TenorDays: line.tenorDays, MaturityDate: line.maturityDate, Reason: line.reason })));
  const printPage = () => window.print();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <Sidebar activeView={activeView} onNavigate={setActiveView} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="min-h-svh lg:pl-[248px]">
        <TopBar onOpenSearch={() => setSearchOpen(true)} theme={theme} onToggleTheme={toggleTheme} onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="mx-auto max-w-[1600px] px-4 pb-12 pt-6 sm:px-6 lg:px-9">
          <PageHeading activeView={activeView}>
            {activeView === "dashboard" ? <Button variant="outline" size="sm" onClick={() => setNewFormOpen(true)}><Plus className="size-3.5" aria-hidden="true" />New form</Button> : null}
            {activeView === "cashflow" ? <><Button variant="outline" size="sm" onClick={syncErp}><RefreshCw className="size-3.5" aria-hidden="true" />Sync ERP</Button><Button size="sm" onClick={() => setNewFormOpen(true)}><Plus className="size-3.5" aria-hidden="true" />New form</Button></> : null}
            {activeView === "allocation" ? <Button variant="outline" size="sm" onClick={recalculateProposal}><RefreshCw className="size-3.5" aria-hidden="true" />Recalculate</Button> : null}
            {activeView === "ranking" ? <Button variant="outline" size="sm" onClick={() => exportCsv("bank-ranking.csv", workspace.banks.map((bank) => ({ Rank: bank.rank, Bank: bank.name, Rate: bank.depositRate, ServiceRating: bank.serviceRating, CreditRating: bank.creditRating, NPL: bank.npl, NIM: bank.nim, CAR: bank.car, LDR: bank.ldr, MaxAllocationPercent: bank.maxAllocationPercent, Active: String(bank.active) })))}><Download className="size-3.5" aria-hidden="true" />Export</Button> : null}
            {activeView === "instructions" ? <Button size="sm" onClick={createInstructions} disabled={workspace.allocationState !== "Voucher created"}><Plus className="size-3.5" aria-hidden="true" />Create instruction</Button> : null}
            {activeView === "reports" ? <Button variant="outline" size="sm" onClick={printPage}><Download className="size-3.5" aria-hidden="true" />Print / PDF</Button> : null}
          </PageHeading>

          {activeView === "dashboard" ? <DashboardView workspace={workspace} onNavigate={setActiveView} onRunProposal={recalculateProposal} onApprove={approveDocument} /> : null}
          {activeView === "cashflow" ? <CashflowView workspace={workspace} onValidate={validateCashflow} onReturn={requestRevision} onCalculate={calculateBalance} onExport={exportCashflows} /> : null}
          {activeView === "allocation" ? <AllocationView workspace={workspace} onRecalculate={recalculateProposal} onSubmit={submitProposal} onEdit={setEditingAllocation} onCreateVoucher={createVouchers} /> : null}
          {activeView === "ranking" ? <BankRankingView banks={workspace.banks} onEdit={setEditingBank} onExport={() => exportCsv("bank-ranking.csv", workspace.banks.map((bank) => ({ Rank: bank.rank, Bank: bank.name, Rate: bank.depositRate, ServiceRating: bank.serviceRating, CreditRating: bank.creditRating, NPL: bank.npl, NIM: bank.nim, CAR: bank.car, LDR: bank.ldr, MaxAllocationPercent: bank.maxAllocationPercent, Active: String(bank.active) })))} /> : null}
          {activeView === "approvals" ? <ApprovalsView approvals={workspace.approvals} onApprove={approveDocument} onReject={setReturningApproval} /> : null}
          {activeView === "instructions" ? <InstructionsView instructions={workspace.instructions} canCreate={workspace.allocationState === "Voucher created"} onCreate={createInstructions} onSubmit={submitInstruction} onMarkSent={markInstructionSent} onPrint={() => printPage()} /> : null}
          {activeView === "reports" ? <ReportsView workspace={workspace} onPrint={printPage} onExport={(kind) => kind === "cashflow" ? exportCashflows() : kind === "allocation" ? exportAllocation() : exportCsv("deposit-position.csv", workspace.banks.map((bank) => ({ Bank: bank.name, DepositBalanceIDR: bank.depositBalance, SharePercent: ((bank.depositBalance / Math.max(1, workspace.parameters.existingDeposits)) * 100).toFixed(1), Rate: bank.depositRate, Rank: bank.rank })))} /> : null}
          {activeView === "archive" ? <ArchiveView workspace={workspace} onExport={() => exportCsv("data-archive.csv", [...workspace.cashflows.map((item) => ({ ID: item.id, Document: item.reference, Type: "Cash flow form", Date: item.dueDate, Status: item.status })), ...workspace.approvals.map((item) => ({ ID: item.id, Document: item.document, Type: item.type, Date: item.submittedAt, Status: item.status })), ...workspace.instructions.map((item) => ({ ID: item.id, Document: `${item.bankName} bank instruction`, Type: "Bank instruction", Date: item.createdAt, Status: item.status }))])} /> : null}
          {activeView === "settings" ? <MasterDataView parameters={workspace.parameters} onSaveParameters={saveParameters} /> : null}

          <footer className="mt-8 flex flex-col gap-2 border-t border-border pt-4 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>DEPOSIT DESK · SAMPLE WORKSPACE</span>
            <span>ERP and approval actions are simulated · no bank instruction is executed automatically</span>
          </footer>
        </main>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} onNavigate={setActiveView} />
      <CashflowFormDialog open={newFormOpen} onOpenChange={setNewFormOpen} onSave={addCashflow} />
      <AllocationEditDialog line={editingAllocation} open={editingAllocation !== null} onOpenChange={(open) => { if (!open) setEditingAllocation(null); }} onSave={editAllocation} />
      <BankEditDialog bank={editingBank} open={editingBank !== null} onOpenChange={(open) => { if (!open) setEditingBank(null); }} onSave={saveBank} />
      <ReturnDialog item={returningApproval} open={returningApproval !== null} onOpenChange={(open) => { if (!open) setReturningApproval(null); }} onReturn={returnDocument} />
    </div>
  );
}