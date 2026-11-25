import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BadgeCheck,
  Bell,
  Building2,
  Calculator,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileClock,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
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
import { Tabs, type TabItem } from "@/components/ui/custom-tabs";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import {
  APPROVAL_STEPS,
  BANK_DUE_DATE_PATTERNS,
  DEMO_WORKSPACE,
  IDBM_CALENDAR_INFO,
  INDONESIAN_NATIONAL_HOLIDAYS_2026,
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
  | "instructions"
  | "reports"
  | "settings";

type Theme = "light" | "dark";

const STORAGE_KEY = "deposit-desk-workspace-v3";
const THEME_KEY = "deposit-desk-theme";

const NAV_GROUPS: { label: string; items: { id: WorkspaceView; label: string; icon: LucideIcon }[] }[] = [
  {
    label: "CORE FUNCTIONS",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "cashflow", label: "Cash Flow", icon: ArrowLeftRight },
      { id: "allocation", label: "Deposit Allocation", icon: Wallet },
      { id: "ranking", label: "Bank Ranking", icon: Landmark },
    ],
  },
  {
    label: "REPORTS & DOCUMENTATION",
    items: [
      { id: "reports", label: "Reports", icon: FileText },
      { id: "instructions", label: "Bank Instructions", icon: Send },
    ],
  },
  {
    label: "SETUP SYSTEM",
    items: [
      { id: "settings", label: "Master Data", icon: Layers },
    ],
  },
];

const PAGE_META: Record<WorkspaceView, { title: string; description: string; icon: LucideIcon }> = {
  dashboard: {
    title: "Dashboard",
    description: "Cash position, deposits and decisions in one place.",
    icon: LayoutDashboard,
  },
  cashflow: {
    title: "Cash Flow",
    description: "Review department submissions and incoming ERP activity.",
    icon: ArrowLeftRight,
  },
  allocation: {
    title: "Deposit Allocation",
    description: "Review an explainable placement proposal before approval.",
    icon: Wallet,
  },
  ranking: {
    title: "Bank Ranking",
    description: "Manage deposit rates, service ratings and allocation limits.",
    icon: Landmark,
  },
  instructions: {
    title: "Bank Instructions",
    description: "Prepare, approve and record printed placement instructions.",
    icon: Send,
  },
  reports: {
    title: "Reports",
    description: "Compare projected cash movement and deposit positions.",
    icon: FileText,
  },
  settings: {
    title: "Master Data",
    description: "Review the parameters, calendars and reference lists in use.",
    icon: Layers,
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
  let badgeClass = "badge-neutral";
  if (status === "Waiting" || status === "Pending") {
    badgeClass = "badge-waiting";
  } else if (
    status === "Validated" ||
    status === "Approved" ||
    status === "Sent to bank" ||
    status === "Active" ||
    status === "Voucher created"
  ) {
    badgeClass = "badge-approved";
  } else if (
    status === "Need revision" ||
    status === "Returned" ||
    status === "No solution" ||
    status === "Inactive"
  ) {
    badgeClass = "badge-returned";
  } else if (
    status === "In review" ||
    status === "In approval" ||
    status === "Ready" ||
    status === "Submitted"
  ) {
    badgeClass = "badge-info";
  }
  return <span className={badgeClass}>{status}</span>;
}

function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: ((size: number) => void) | undefined;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  const pages: number[] = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  for (let p = startPage; p <= endPage; p++) {
    pages.push(p);
  }

  return (
    <div className="pagination-container">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="h-7 rounded border border-border bg-background px-2 text-xs font-medium text-foreground outline-none"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <span>
          {startItem}-{endItem} of {totalItems}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="page-number-btn disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="First page"
        >
          <ChevronsLeft className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="page-number-btn disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn("page-number-btn", p === currentPage && "page-number-active")}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="page-number-btn disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="page-number-btn disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Last page"
        >
          <ChevronsRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function PageHeading({
  activeView,
  onDownloadExcel,
  onUploadExcel,
  onCreateNew,
  downloadLabel = "Download Excel",
  uploadLabel = "Upload Excel",
  createLabel = "+ Create New",
  children,
}: {
  activeView: WorkspaceView;
  onDownloadExcel?: (() => void) | undefined;
  onUploadExcel?: (() => void) | undefined;
  onCreateNew?: (() => void) | undefined;
  downloadLabel?: string | undefined;
  uploadLabel?: string | undefined;
  createLabel?: string | undefined;
  children?: React.ReactNode | undefined;
}) {
  const meta = PAGE_META[activeView];
  const Icon = meta.icon;
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <Icon className="size-5 shrink-0 text-slate-800 dark:text-slate-200" aria-hidden="true" />
        <h1 className="text-lg font-bold tracking-tight text-[#0a386c] dark:text-blue-400 sm:text-xl">
          {meta.title}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {onUploadExcel ? (
          <button type="button" onClick={onUploadExcel} className="btn-orange">
            <Upload className="size-3.5" />
            <span>{uploadLabel}</span>
          </button>
        ) : null}
        {onDownloadExcel ? (
          <button type="button" onClick={onDownloadExcel} className="btn-orange">
            <Download className="size-3.5" />
            <span>{downloadLabel}</span>
          </button>
        ) : null}
        {onCreateNew ? (
          <button type="button" onClick={onCreateNew} className="btn-blue">
            <Plus className="size-3.5" />
            <span>{createLabel}</span>
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return <section className={cn("panel", className)}>{children}</section>;
}

function PanelHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string | undefined;
  action?: React.ReactNode | undefined;
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
  tone?: "default" | "positive" | "warning" | undefined;
}) {
  const iconBg =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
      : tone === "warning"
        ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-blue-50 text-[#1F5AA6] dark:bg-blue-900/30 dark:text-blue-400";

  return (
    <StatCard
      title={label}
      value={value}
      subtitle={footnote}
      icon={<Icon className="size-5" />}
      iconBg={iconBg}
    />
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
  collapsed,
  onClose,
}: {
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
}) {
  const isMini = collapsed && !open;

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
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[#132238] bg-[#071327] text-white transition-all duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isMini ? "w-[248px] lg:w-[70px]" : "w-[248px]",
        )}
        aria-label="Main navigation"
      >
        {/* Brand Header */}
        {isMini ? (
          <div className="flex h-[72px] items-center justify-center border-b border-[#132238] px-2">
            <button
              type="button"
              onClick={() => {
                onNavigate("dashboard");
                onClose();
              }}
              className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-700 via-sky-500 to-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.5)] transition-transform hover:scale-105"
              title="DEPOSIT DESK · Dashboard"
              aria-label="Deposit Desk Dashboard"
            >
              <div className="size-3.5 rounded-full bg-white/90 shadow-inner" />
            </button>
          </div>
        ) : (
          <div className="flex h-[72px] items-center gap-3 border-b border-[#132238] px-5">
            <button
              type="button"
              onClick={() => {
                onNavigate("dashboard");
                onClose();
              }}
              className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-700 via-sky-500 to-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.5)] transition-transform hover:scale-105"
              title="DEPOSIT DESK · Dashboard"
              aria-label="Deposit Desk Dashboard"
            >
              <div className="size-3.5 rounded-full bg-white/90 shadow-inner" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold tracking-wider text-white">DEPOSIT DESK</p>
              <p className="truncate text-[10px] font-medium text-slate-400">Treasury Management System</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-slate-400 hover:text-white lg:hidden"
              aria-label="Close navigation"
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
        )}

        {/* Navigation Groups */}
        <nav className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto py-4 transition-all", isMini ? "px-2" : "px-3")}>
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={group.label} className="space-y-1">
              {isMini ? (
                groupIdx > 0 ? <div className="my-2.5 mx-auto h-px w-8 bg-[#1a2d46]" /> : null
              ) : (
                <div className="mb-2 flex items-center gap-2.5 px-3 pt-2">
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#385d8a]">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-[#1a2d46]" />
                </div>
              )}
              <div className="space-y-1">
                {group.items.map(({ id, label, icon: Icon }) => {
                  const selected = activeView === id;
                  if (isMini) {
                    return (
                      <button
                        key={id}
                        type="button"
                        title={label}
                        aria-label={label}
                        aria-current={selected ? "page" : undefined}
                        className={cn(
                          "group relative flex size-10 items-center justify-center rounded-lg transition-all mx-auto",
                          selected
                            ? "bg-[#13325e] text-blue-400 font-semibold shadow-xs"
                            : "text-slate-400 hover:bg-[#0f2442] hover:text-slate-100",
                        )}
                        onClick={() => {
                          onNavigate(id);
                          onClose();
                        }}
                      >
                        <Icon className={cn("size-4.5 shrink-0 transition-transform group-hover:scale-110", selected ? "text-blue-400" : "text-slate-400")} aria-hidden="true" />
                        {selected && (
                          <span className="absolute -left-2 top-2 bottom-2 w-1 rounded-r-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" />
                        )}
                      </button>
                    );
                  }
                  return (
                    <Button
                      key={id}
                      variant="ghost"
                      aria-current={selected ? "page" : undefined}
                      className={cn(
                        "h-9 w-full justify-start gap-2.5 rounded-lg px-3 text-xs font-medium transition-all",
                        selected
                          ? "bg-[#13325e] text-white font-semibold shadow-xs hover:bg-[#13325e] hover:text-white"
                          : "text-slate-400 hover:bg-[#0f2442] hover:text-slate-100",
                      )}
                      onClick={() => {
                        onNavigate(id);
                        onClose();
                      }}
                    >
                      <Icon className={cn("size-4 shrink-0", selected ? "text-blue-400" : "text-slate-400")} aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* System Online Status Footer */}
        {isMini ? (
          <div className="flex items-center justify-center border-t border-[#132238] py-4" title="System Online · v2.5.0">
            <span className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-[#132238] px-5 py-3.5 text-[11px]">
            <div className="flex items-center gap-2 font-medium text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
              <span>System Online</span>
            </div>
            <span className="font-mono text-slate-400">v2.5.0</span>
          </div>
        )}
      </aside>
    </>
  );
}

function TopBar({
  onOpenSearch,
  theme,
  onToggleTheme,
  onToggleSidebar,
  isSidebarCollapsed,
}: {
  onOpenSearch: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  isSidebarCollapsed?: boolean | undefined;
}) {
  const [timeStr, setTimeStr] = useState("08:11:23");
  const [dateStr, setDateStr] = useState("Tuesday, November 24, 2026");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
      setDateStr(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-[64px] items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur dark:bg-card/95 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleSidebar}
        >
          <PanelLeft className={cn("size-4 transition-transform duration-200", isSidebarCollapsed && "rotate-180 text-primary")} />
        </Button>
      </div>
      <div className="flex items-center gap-4 sm:gap-6">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`}
          onClick={onToggleTheme}
        >
          {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </Button>

        {/* Digital Clock */}
        <div className="hidden flex-col items-end text-right sm:flex">
          <span className="font-mono text-xs font-bold tabular-nums text-foreground">{timeStr}</span>
          <span className="text-[11px] text-muted-foreground">{dateStr}</span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
            onClick={onOpenSearch}
          >
            <Bell className="size-4" />
          </Button>
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-xs">
            9+
          </span>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold text-amber-950 text-xs shadow-xs">
            H
          </div>
          <div className="hidden text-left leading-tight md:block">
            <p className="text-xs font-semibold text-foreground">hasan</p>
            <p className="text-[10px] text-muted-foreground">Super Admin</p>
          </div>
        </div>
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
}: {
  workspace: WorkspaceData;
  onNavigate: (view: WorkspaceView) => void;
  onRunProposal?: () => void;
}) {
  const totalDeposits = workspace.banks.reduce((sum, bank) => sum + bank.depositBalance, 0);
  const depositLimit = (workspace.parameters.equity * workspace.parameters.maxEquityPercent) / 100;

  return (
    <div className="space-y-6">
      <StatCardGrid
        columns={4}
        items={[
          {
            title: "Total Cash Balance",
            value: formatCompactRupiah(workspace.cashBalance),
            subtitle: "Across operating bank accounts",
            icon: <Wallet className="size-5 text-[#1F5AA6]" />,
            iconBg: "bg-blue-50 text-[#1F5AA6] dark:bg-blue-900/30 dark:text-blue-400",
          },
          {
            title: "Time Deposits",
            value: formatCompactRupiah(totalDeposits),
            subtitle: `${((totalDeposits / workspace.parameters.equity) * 100).toFixed(1)}% of equity`,
            icon: <Landmark className="size-5 text-emerald-600" />,
            iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
          },
          {
            title: "Available to Place",
            value: formatCompactRupiah(workspace.parameters.availableCash),
            subtitle: "After forecast operating needs",
            icon: <Banknote className="size-5 text-emerald-600" />,
            iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
          },
          {
            title: "Equity Deposit Limit",
            value: formatCompactRupiah(depositLimit),
            subtitle: `${formatCompactRupiah(Math.max(0, depositLimit - totalDeposits))} headroom remaining`,
            icon: <ShieldCheck className="size-5 text-amber-600" />,
            iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeading
            title="Cash position forecast"
            detail="Actual and forecast balance"
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
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(value) => formatRupiah(value * 1_000_000_000)} domain={[7.8, 10]} />
                <Tooltip
                  formatter={(value) => [formatRupiah(Number(value ?? 0) * 1_000_000_000), "Balance"]}
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
            <span className="font-mono font-medium tabular-nums text-foreground">{formatRupiah(9_420_000_000)} <span className="ml-1 text-positive">+11.9%</span></span>
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
            title="Active bank instructions"
            detail={`${workspace.instructions.length} placement instructions generated`}
            action={<Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onNavigate("instructions")}>View all <ArrowRight className="size-3.5" aria-hidden="true" /></Button>}
          />
          {workspace.instructions.length ? (
            <div className="divide-y divide-border">
              {workspace.instructions.slice(0, 3).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{item.bankName} — {item.id}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{item.voucherNumber} · Maturity {formatDate(item.maturityDate)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-medium tabular-nums text-foreground">{formatCompactRupiah(item.amount)}</span>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No active bank instructions" description="Placement instructions will appear here." />
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
    </div>
  );
}

const CASHFLOW_WEEKS = [
  { id: "W48-2026", label: "Week 48 (23 Nov - 29 Nov 2026)", startDate: "2026-11-23", endDate: "2026-11-29" },
  { id: "W49-2026", label: "Week 49 (30 Nov - 06 Dec 2026)", startDate: "2026-11-30", endDate: "2026-12-06" },
  { id: "W50-2026", label: "Week 50 (07 Dec - 13 Dec 2026)", startDate: "2026-12-07", endDate: "2026-12-13" },
  { id: "W51-2026", label: "Week 51 (14 Dec - 20 Dec 2026)", startDate: "2026-12-14", endDate: "2026-12-20" },
];

const CASHFLOW_MONTHS = [
  { id: "2026-11", label: "November 2026" },
  { id: "2026-12", label: "December 2026" },
  { id: "2027-01", label: "January 2027" },
];

function CashflowView({
  workspace,
  onValidate,
  onReturn,
  onCalculate,
  onExport,
  onNewForm,
}: {
  workspace: WorkspaceData;
  onValidate: (id: string) => void;
  onReturn: (id: string) => void;
  onCalculate: (mode?: string, label?: string, net?: number) => void;
  onExport: () => void;
  onNewForm: () => void;
}) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Period modes: daily, weekly, monthly, all
  const [periodMode, setPeriodMode] = useState<"daily" | "weekly" | "monthly" | "all">("weekly");
  const [selectedDailyDate, setSelectedDailyDate] = useState("2026-11-25");
  const [selectedWeek, setSelectedWeek] = useState("W48-2026");
  const [selectedMonth, setSelectedMonth] = useState("2026-11");
  const [filterTableByPeriod, setFilterTableByPeriod] = useState(false);

  const availableDailyDates = useMemo(() => {
    const dates = Array.from(new Set(workspace.cashflows.map((item) => item.dueDate))).sort();
    return dates;
  }, [workspace.cashflows]);

  const periodLabel = useMemo(() => {
    if (periodMode === "daily") {
      return formatDate(selectedDailyDate);
    }
    if (periodMode === "weekly") {
      return CASHFLOW_WEEKS.find((w) => w.id === selectedWeek)?.label ?? selectedWeek;
    }
    if (periodMode === "monthly") {
      return CASHFLOW_MONTHS.find((m) => m.id === selectedMonth)?.label ?? selectedMonth;
    }
    return "All Periods";
  }, [periodMode, selectedDailyDate, selectedWeek, selectedMonth]);

  const activeDateRangeText = useMemo(() => {
    if (periodMode === "daily") {
      return selectedDailyDate ? formatDate(selectedDailyDate) : "Daily";
    }
    if (periodMode === "weekly") {
      const week = CASHFLOW_WEEKS.find((w) => w.id === selectedWeek);
      return week ? `${formatDate(week.startDate)} - ${formatDate(week.endDate)}` : "Weekly";
    }
    if (periodMode === "monthly") {
      const month = CASHFLOW_MONTHS.find((m) => m.id === selectedMonth);
      return month ? month.label : "Monthly";
    }
    return "24/11/2026 - 31/12/2026";
  }, [periodMode, selectedDailyDate, selectedWeek, selectedMonth]);

  const periodFilteredCashflows = useMemo(() => {
    if (periodMode === "daily") {
      return workspace.cashflows.filter((item) => item.dueDate === selectedDailyDate);
    }
    if (periodMode === "weekly") {
      const week = CASHFLOW_WEEKS.find((w) => w.id === selectedWeek);
      if (!week) return workspace.cashflows;
      return workspace.cashflows.filter((item) => item.dueDate >= week.startDate && item.dueDate <= week.endDate);
    }
    if (periodMode === "monthly") {
      return workspace.cashflows.filter((item) => item.dueDate.startsWith(selectedMonth));
    }
    return workspace.cashflows;
  }, [workspace.cashflows, periodMode, selectedDailyDate, selectedWeek, selectedMonth]);

  const incoming = periodFilteredCashflows.filter((item) => item.direction === "Incoming").reduce((sum, item) => sum + item.amount, 0);
  const outgoing = periodFilteredCashflows.filter((item) => item.direction === "Outgoing").reduce((sum, item) => sum + item.amount, 0);
  const net = incoming - outgoing;

  const filteredItems = useMemo(() => {
    const baseList = filterTableByPeriod ? periodFilteredCashflows : workspace.cashflows;
    return baseList.filter((item) => {
      const matchSearch =
        item.reference.toLowerCase().includes(search.toLowerCase()) ||
        item.department.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());
      const matchGroup =
        groupFilter === "All" ||
        (groupFilter === "Department" ? item.source === "Department form" : item.source === "ERP feed");
      const matchStatus = statusFilter === "All" || item.status === statusFilter;
      return matchSearch && matchGroup && matchStatus;
    });
  }, [workspace.cashflows, periodFilteredCashflows, filterTableByPeriod, search, groupFilter, statusFilter]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Calculation & Period Mode Selector Banner */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <CalendarDays className="size-4 text-primary" />
            Calculate Mode:
          </span>
          <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setPeriodMode("daily");
                setCurrentPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                periodMode === "daily"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodMode("weekly");
                setCurrentPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                periodMode === "weekly"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodMode("monthly");
                setCurrentPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                periodMode === "monthly"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodMode("all");
                setCurrentPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                periodMode === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Periods
            </button>
          </div>
        </div>

        {/* Dynamic Period Target Picker & Calculate Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {periodMode === "daily" ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Select Day:</span>
              <select
                value={selectedDailyDate}
                onChange={(e) => {
                  setSelectedDailyDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
              >
                {availableDailyDates.map((d) => (
                  <option key={d} value={d}>
                    {formatDate(d)} ({d})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {periodMode === "weekly" ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Select Week:</span>
              <select
                value={selectedWeek}
                onChange={(e) => {
                  setSelectedWeek(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
              >
                {CASHFLOW_WEEKS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {periodMode === "monthly" ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Select Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
              >
                {CASHFLOW_MONTHS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <Button
            type="button"
            size="sm"
            onClick={() => onCalculate(periodMode, periodLabel, net)}
            className="btn-blue h-8"
          >
            <Calculator className="size-3.5" />
            <span>Calculate Cash Flow</span>
          </Button>
        </div>
      </div>

      <StatCardGrid
        columns={4}
        items={[
          {
            title: "Total Incoming",
            value: formatCompactRupiah(incoming),
            subtitle: `${periodMode === "daily" ? "Daily" : periodMode === "weekly" ? "Weekly" : periodMode === "monthly" ? "Monthly" : "Total"} incoming · ${periodLabel}`,
            icon: <TrendingUp className="size-5 text-emerald-600" />,
            iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
            valueColor: "text-emerald-600 dark:text-emerald-400",
          },
          {
            title: "Total Expenditure",
            value: formatCompactRupiah(outgoing),
            subtitle: `${periodMode === "daily" ? "Daily" : periodMode === "weekly" ? "Weekly" : periodMode === "monthly" ? "Monthly" : "Total"} expenditure · ${periodLabel}`,
            icon: <TrendingDown className="size-5 text-rose-600" />,
            iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
            valueColor: "text-rose-600 dark:text-rose-400",
          },
          {
            title: "Net Cash Flow",
            value: formatCompactRupiah(net),
            subtitle: `${periodMode === "daily" ? "Daily" : periodMode === "weekly" ? "Weekly" : periodMode === "monthly" ? "Monthly" : "Total"} net · ${periodLabel}`,
            icon: <Activity className="size-5 text-[#1F5AA6]" />,
            iconBg: "bg-blue-50 text-[#1F5AA6] dark:bg-blue-900/30 dark:text-blue-400",
            valueColor: net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
          },
          {
            title: "Ending Balance Projection",
            value: formatCompactRupiah(workspace.cashBalance + net),
            subtitle: `Starting cash ${formatCompactRupiah(workspace.cashBalance)}`,
            icon: <Wallet className="size-5 text-indigo-600" />,
            iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
          },
        ]}
      />

      {/* Table & Filter Container Card Matching Reference Design */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        <div className="filter-toolbar">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by reference, department, or note..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={filterTableByPeriod}
                onChange={(e) => {
                  setFilterTableByPeriod(e.target.checked);
                  setCurrentPage(1);
                }}
                className="rounded border-border size-3.5"
              />
              <span>Filter by period</span>
            </label>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>Group :</span>
              <select
                value={groupFilter}
                onChange={(e) => {
                  setGroupFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none"
              >
                <option value="All">All Groups</option>
                <option value="Department">Department Form</option>
                <option value="ERP">ERP Feed</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>Status :</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none"
              >
                <option value="All">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Need revision">Need revision</option>
                <option value="Validated">Validated</option>
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              <span>{activeDateRangeText}</span>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table-reference">
            <thead>
              <tr>
                <th className="w-24 text-center">ACTION</th>
                <th className="w-12 text-center">NO.</th>
                <th>
                  <div className="flex items-center gap-1">
                    <span>REFERENCE</span>
                    <ChevronsUpDown className="size-3" />
                  </div>
                </th>
                <th>
                  <div className="flex items-center gap-1">
                    <span>DEPARTMENT</span>
                    <ChevronsUpDown className="size-3" />
                  </div>
                </th>
                <th>CATEGORY</th>
                <th>
                  <div className="flex items-center gap-1">
                    <span>DUE DATE</span>
                    <ChevronsUpDown className="size-3" />
                  </div>
                </th>
                <th>SOURCE</th>
                <th>AMOUNT</th>
                <th className="text-center">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((item, index) => (
                <tr key={item.id}>
                  <td className="text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="iconView"
                        onClick={() => toast.info(`Viewing details for ${item.reference}`)}
                        title="View Details"
                        aria-label="View Details"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="iconEdit"
                        onClick={() => onValidate(item.id)}
                        title={item.status === "Validated" ? "Already Validated" : "Validate"}
                        aria-label="Validate"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="iconDelete"
                        onClick={() => onReturn(item.id)}
                        title="Return for Revision"
                        aria-label="Return for Revision"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="text-center font-mono text-muted-foreground">
                    {(currentPage - 1) * pageSize + index + 1}
                  </td>
                  <td>
                    <div className="font-semibold text-foreground">{item.reference}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{item.id}</span>
                      {item.bankName ? (
                        <>
                          <span>·</span>
                          <span className="font-medium text-[#1F5AA6] dark:text-blue-400">{item.bankName}</span>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td>{item.department}</td>
                  <td>{item.category}</td>
                  <td className="whitespace-nowrap font-mono text-[11px]">{formatDate(item.dueDate)}</td>
                  <td>
                    <span className={cn("source-label", item.source === "ERP feed" ? "source-erp" : "source-form")}>
                      {item.source}
                    </span>
                  </td>
                  <td className={cn("whitespace-nowrap font-mono font-medium tabular-nums", item.direction === "Incoming" ? "text-positive" : "text-foreground")}>
                    {item.direction === "Incoming" ? "+" : "−"}{formatCompactRupiah(item.amount)}
                  </td>
                  <td className="text-center">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredItems.length ? (
            <div className="py-8">
              <EmptyState title="No matching cash flow records" description="Try adjusting search or filters to see records." />
            </div>
          ) : null}
        </div>

        <PaginationBar
          currentPage={currentPage}
          totalItems={filteredItems.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "warning";
  icon?: LucideIcon;
}) {
  const iconBg =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
      : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400";

  return (
    <StatCard
      title={label}
      value={value}
      subtitle={detail}
      icon={Icon ? <Icon className="size-5" /> : undefined}
      iconBg={iconBg}
      valueColor={tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
    />
  );
}

function AllocationView({
  workspace,
  onRecalculate,
  onEdit,
  onAddPlacement,
  onCreateVoucher,
}: {
  workspace: WorkspaceData;
  onRecalculate: () => void;
  onEdit: (line: AllocationLine) => void;
  onAddPlacement?: () => void;
  onCreateVoucher: () => void;
}) {
  const proposal = workspace.proposal;
  const total = proposal.lines.reduce((sum, line) => sum + line.amount, 0);
  const depositLimit = (workspace.parameters.equity * workspace.parameters.maxEquityPercent) / 100;
  const afterPlacement = workspace.parameters.existingDeposits + total;
  const limitUse = depositLimit ? (afterPlacement / depositLimit) * 100 : 0;
  const canCreateVoucher = proposal.status === "Ready" && workspace.allocationState !== "Voucher created" && proposal.lines.length > 0;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedLineIds, setExpandedLineIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedLineIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getBankCashflows = (bankName: string) => {
    const normalizedBank = bankName.toLowerCase().replace(/^(bank\s+)/i, "").trim();
    return workspace.cashflows.filter((cf) => {
      if (!cf.bankName) return false;
      const normalizedCf = cf.bankName.toLowerCase().replace(/^(bank\s+)/i, "").trim();
      return (
        cf.bankName.toLowerCase() === bankName.toLowerCase() ||
        normalizedCf.includes(normalizedBank) ||
        normalizedBank.includes(normalizedCf)
      );
    });
  };

  const filteredLines = useMemo(() => {
    return proposal.lines.filter((line) => {
      const matchSearch =
        line.bankName.toLowerCase().includes(search.toLowerCase()) ||
        line.reason.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || line.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [proposal.lines, search, statusFilter]);

  return (
    <div className="space-y-5">
      <StatCardGrid
        columns={4}
        items={[
          {
            title: "Available Cash",
            value: formatCompactRupiah(workspace.parameters.availableCash),
            subtitle: "Pre-allocation liquidity",
            icon: <Banknote className="size-5 text-[#1F5AA6]" />,
            iconBg: "bg-blue-50 text-[#1F5AA6] dark:bg-blue-900/30 dark:text-blue-400",
          },
          {
            title: "Suggested Placement",
            value: formatCompactRupiah(total),
            subtitle: `${proposal.lines.length} bank tranches proposed`,
            icon: <Landmark className="size-5 text-emerald-600" />,
            iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
          },
          {
            title: "Deposit Limit",
            value: formatCompactRupiah(depositLimit),
            subtitle: `${workspace.parameters.maxEquityPercent}% of total equity`,
            icon: <ShieldCheck className="size-5 text-amber-600" />,
            iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
          },
          {
            title: "Limit Used After Placement",
            value: `${limitUse.toFixed(1)}%`,
            subtitle: `${formatCompactRupiah(Math.max(0, depositLimit - total))} headroom remaining`,
            icon: <Activity className="size-5 text-indigo-600" />,
            iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
            badge: limitUse > 100 ? "Over Limit" : "Compliant",
            badgeColor: limitUse > 100 ? "text-rose-600" : "text-emerald-600",
            badgeBg: limitUse > 100 ? "bg-rose-50 dark:bg-rose-900/20" : "bg-emerald-50 dark:bg-emerald-900/20",
          },
        ]}
      />

      <Panel className="allocation-summary">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2">
              <StatusBadge status={workspace.allocationState === "Voucher created" ? "Voucher created" : proposal.status} />
              <span className="text-[11px] text-muted-foreground">Run · {formatDate(proposal.computedAt)}</span>
            </div>
            <h2 className="text-base font-semibold text-foreground">November deposit proposal</h2>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{proposal.explanation}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onRecalculate}><RefreshCw className="size-3.5" aria-hidden="true" />Recalculate</Button>
            {workspace.allocationState !== "Voucher created" && onAddPlacement ? (
              <Button variant="outline" size="sm" onClick={onAddPlacement}>
                <Plus className="size-3.5" aria-hidden="true" />
                Add placement
              </Button>
            ) : null}
            {canCreateVoucher ? (
              <Button size="sm" onClick={onCreateVoucher} className="btn-blue">
                <FileCheck2 className="size-3.5" aria-hidden="true" />
                Create ERP vouchers
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      {proposal.status !== "Ready" ? (
        <Panel>
          <EmptyState title={proposal.status === "Not required" ? "No placement required" : "No compliant proposal"} description={proposal.explanation} />
          {workspace.allocationState !== "Voucher created" && onAddPlacement ? (
            <div className="mt-4 flex justify-center">
              <Button size="sm" variant="outline" onClick={onAddPlacement}>
                <Plus className="mr-1 size-3.5" />
                Add placement manually
              </Button>
            </div>
          ) : null}
        </Panel>
      ) : (
        <div className="space-y-5">
          {/* Table & Filter Container Card (Fill Container) */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs w-full">
            <div className="filter-toolbar">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search suggested placement by bank, reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>Status :</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none"
                  >
                    <option value="All">All Status</option>
                    <option value="Suggested">Suggested</option>
                    <option value="Adjusted">Adjusted</option>
                    <option value="Voucher created">Voucher created</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  <span>24/11/2026</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => exportCsv("deposit-proposal.csv", proposal.lines.map((line) => ({ Bank: line.bankName, Rank: line.rank, Amount: line.amount, Rate: `${line.annualRate}%`, Tenor: `${line.tenorDays} days`, Maturity: line.maturityDate, Reason: line.reason })))}
                >
                  <Download className="mr-1.5 size-3.5" aria-hidden="true" />
                  Export
                </Button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table-reference">
                <thead>
                  <tr>
                    <th className="w-24 text-center">ACTION</th>
                    <th>
                      <div className="flex items-center gap-1">
                        <span>BANK NAME</span>
                        <ChevronsUpDown className="size-3" />
                      </div>
                    </th>
                    <th>PLACEMENT</th>
                    <th>RATE</th>
                    <th>TENOR</th>
                    <th>MATURITY</th>
                    <th className="text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((line) => {
                    const isExpanded = !!expandedLineIds[line.id];
                    const bankCashflows = getBankCashflows(line.bankName);
                    const incomingTotal = bankCashflows
                      .filter((cf) => cf.direction === "Incoming")
                      .reduce((sum, cf) => sum + cf.amount, 0);
                    const outgoingTotal = bankCashflows
                      .filter((cf) => cf.direction === "Outgoing")
                      .reduce((sum, cf) => sum + cf.amount, 0);
                    const netCash = incomingTotal - outgoingTotal;

                    return (
                      <Fragment key={line.id}>
                        <tr className={cn(isExpanded && "bg-muted/15 dark:bg-muted/10")}>
                          <td className="text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="iconView"
                                onClick={() => toggleExpand(line.id)}
                                title={isExpanded ? "Collapse cash flow transaction details" : "View cash flow transaction details"}
                                aria-label={isExpanded ? "Collapse cash flow transaction details" : "View cash flow transaction details"}
                                className={cn(isExpanded && "bg-[#EFF4FB] border-[#1F5AA6] text-[#1F5AA6] dark:bg-[#1F5AA6]/20")}
                              >
                                {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                              </Button>
                              <Button
                                type="button"
                                variant="iconEdit"
                                onClick={() => onEdit(line)}
                                disabled={workspace.allocationState !== "Draft"}
                                title="Adjust Allocation"
                                aria-label="Adjust Allocation"
                              >
                                <Pencil className="size-4" />
                              </Button>
                            </div>
                          </td>
                          <td>
                            <div
                              className="flex items-center gap-2 cursor-pointer group select-none"
                              onClick={() => toggleExpand(line.id)}
                              role="button"
                              tabIndex={0}
                              title={isExpanded ? "Click to collapse details" : "Click to view cash flow transaction details"}
                            >
                              <span className="rank-mark">{line.rank}</span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{line.bankName}</p>
                                  {isExpanded ? (
                                    <ChevronUp className="size-3.5 text-primary" />
                                  ) : (
                                    <ChevronDown className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground">{line.reason}</p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap font-mono font-medium tabular-nums text-foreground">{formatCompactRupiah(line.amount)}</td>
                          <td className="font-mono tabular-nums">{line.annualRate.toFixed(2)}%</td>
                          <td>{line.tenorDays} days</td>
                          <td className="whitespace-nowrap font-mono text-[11px]">{formatDate(line.maturityDate)}</td>
                          <td className="text-center"><StatusBadge status={line.status} /></td>
                        </tr>

                        {isExpanded ? (
                          <tr className="border-b border-border bg-slate-50/70 dark:bg-slate-900/50">
                            <td colSpan={7} className="p-0">
                              <div className="p-4 pl-6 sm:pl-8 border-l-4 border-l-[#1F5AA6] space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-xs font-bold text-foreground">
                                        Cash Flow Transaction Details — {line.bankName}
                                      </h4>
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                        {bankCashflows.length} Related Transactions
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      List of operational cash flow transactions (incoming & outgoing) underpinning deposit liquidity for this bank.
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                                    <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-700 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs">
                                      <span className="text-[10px] uppercase font-sans font-bold mr-1.5 opacity-90">INCOMING:</span>
                                      +{formatCompactRupiah(incomingTotal)}
                                    </div>
                                    <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/50 dark:border-rose-700 px-2.5 py-1 font-semibold text-rose-700 dark:text-rose-300 shadow-2xs">
                                      <span className="text-[10px] uppercase font-sans font-bold mr-1.5 opacity-90">OUTGOING:</span>
                                      -{formatCompactRupiah(outgoingTotal)}
                                    </div>
                                    <div className="rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-700 px-2.5 py-1 font-semibold text-[#1F5AA6] dark:text-blue-300 shadow-2xs">
                                      <span className="text-[10px] uppercase font-sans font-bold mr-1.5 opacity-90">NET:</span>
                                      {netCash >= 0 ? "+" : ""}{formatCompactRupiah(netCash)}
                                    </div>
                                  </div>
                                </div>

                                {bankCashflows.length > 0 ? (
                                  <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground">
                                          <th className="px-3 py-2 text-left">REF ID</th>
                                          <th className="px-3 py-2 text-left">REFERENCE & CATEGORY</th>
                                          <th className="px-3 py-2 text-left">DEPARTMENT</th>
                                          <th className="px-3 py-2 text-center">DIRECTION</th>
                                          <th className="px-3 py-2 text-right">AMOUNT (IDR)</th>
                                          <th className="px-3 py-2 text-left">DUE DATE</th>
                                          <th className="px-3 py-2 text-center">STATUS</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border">
                                        {bankCashflows.map((cf) => (
                                          <tr key={cf.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-3 py-2 font-mono text-[11px] font-medium text-foreground">{cf.id}</td>
                                            <td className="px-3 py-2">
                                              <div className="font-medium text-foreground">{cf.reference}</div>
                                              <div className="text-[10px] text-muted-foreground">{cf.category} · {cf.source}</div>
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground text-[11px]">{cf.department}</td>
                                            <td className="px-3 py-2 text-center">
                                              <span className={cn(
                                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                                cf.direction === "Incoming"
                                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                                              )}>
                                                {cf.direction === "Incoming" ? "↓ Incoming" : "↑ Outgoing"}
                                              </span>
                                            </td>
                                            <td className={cn(
                                              "px-3 py-2 text-right font-mono tabular-nums font-semibold",
                                              cf.direction === "Incoming" ? "text-positive" : "text-foreground"
                                            )}>
                                              {cf.direction === "Incoming" ? "+" : "−"}{formatCompactRupiah(cf.amount)}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{formatDate(cf.dueDate)}</td>
                                            <td className="px-3 py-2 text-center">
                                              <StatusBadge status={cf.status} />
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground bg-muted/10">
                                    No direct cash flow transactions recorded for this bank during this period. Placement is funded from existing demand deposit balances.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {!filteredLines.length ? (
                <div className="py-8">
                  <EmptyState title="No placements match filter" description="Try clearing search or changing the status filter." />
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
              <div className="flex items-center gap-2 text-xs text-positive"><CheckCircle2 className="size-4" aria-hidden="true" />No configured limit violations</div>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">Total · {formatRupiah(total)}</span>
            </div>
          </div>

          {/* Parameters & Constraints - Horizontal 3-Column Layout */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 1. Financial Constraints */}
            <Panel className="flex flex-col justify-between">
              <div>
                <PanelHeading title="1. Financial constraints" detail="Mandatory liquidity & equity guardrails" />
                <div className="mt-1 space-y-3">
                  <ConstraintRow
                    label="No negative ending balance"
                    value={`Ending cash: ${formatCompactRupiah(Math.max(0, workspace.parameters.availableCash - total))}`}
                    status="Satisfied"
                  />
                  <ConstraintRow
                    label="Maximum TD < 30% of equity"
                    value={`${((afterPlacement / workspace.parameters.equity) * 100).toFixed(1)}% / ${workspace.parameters.maxEquityPercent}% cap`}
                    status="Within limit"
                  />
                  <ConstraintRow
                    label="Deposit trigger (> Rp.500.000.000)"
                    value={`${formatCompactRupiah(workspace.parameters.availableCash)} > ${formatCompactRupiah(workspace.parameters.depositTrigger)}`}
                    status="Triggered"
                  />
                  <ConstraintRow
                    label="Min. placement (> Rp.100.000.000)"
                    value={`Min. ${formatCompactRupiah(workspace.parameters.minimumPlacement)} / bank`}
                    status="Satisfied"
                  />
                </div>
              </div>
            </Panel>

            {/* 2. Calendar & Timing Constraints */}
            <Panel className="flex flex-col justify-between">
              <div>
                <PanelHeading title="2. Calendar & timing constraints" detail="Settlement & clearing verification" />
                <div className="mt-1 space-y-3">
                  <ConstraintRow label="National holiday calendar" value="16 official Indonesian holidays" status="Checked" />
                  <ConstraintRow label="IDBM calendar (PUAB)" value="Money market business days" status="Operational" />
                  <ConstraintRow label="Bank Indonesia calendar" value="BI-RTGS & clearing settlement" status="Aligned" />
                  <ConstraintRow label="Each bank due date pattern" value="Following Business Day convention" status="Enforced" />
                </div>
              </div>
            </Panel>

            {/* 3. Optimization Parameters */}
            <Panel className="flex flex-col justify-between">
              <div>
                <PanelHeading title="3. Optimization parameters" detail="Yield & risk diversification rules" />
                <div className="mt-1 space-y-3 text-xs leading-5 text-muted-foreground">
                  <div className="flex items-start justify-between border-b border-border pb-2">
                    <div>
                      <p className="font-medium text-foreground">Deposit interest rate</p>
                      <p className="text-[11px]">Ranked to maximize return ({proposal.lines[0]?.annualRate ?? 5.4}% top rate)</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-positive">Optimized</span>
                  </div>
                  <div className="flex items-start justify-between border-b border-border pb-2">
                    <div>
                      <p className="font-medium text-foreground">Bank allocation percentage</p>
                      <p className="text-[11px]">BCA 30%, Mandiri 25%, BNI 20%, CIMB 15%, Danamon 10%</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-positive">Enforced</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">Bank balance / Diversification</p>
                      <p className="text-[11px]">Balanced across {proposal.lines.length} partner institutions</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-positive">Diversified</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground">Parameters verified · Deterministic calculation · No AI</div>
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
  onConfigureTemplate,
  onExport,
}: {
  banks: Bank[];
  onEdit: (bank: Bank) => void;
  onConfigureTemplate?: (bank: Bank) => void;
  onExport: () => void;
}) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredBanks = useMemo(() => {
    return banks.filter((b) => {
      const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) || b.creditRating.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || (statusFilter === "Active" ? b.active : !b.active);
      return matchSearch && matchStatus;
    });
  }, [banks, search, statusFilter]);

  const pagedBanks = useMemo(() => {
    const sorted = [...filteredBanks].sort((a, b) => a.rank - b.rank);
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [filteredBanks, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      <StatCardGrid
        columns={3}
        items={[
          {
            title: "Ranked Active Banks",
            value: String(banks.filter((bank) => bank.active).length).padStart(2, "0"),
            subtitle: "Eligible for placement",
            icon: <Building2 className="size-5 text-[#1F5AA6]" />,
            iconBg: "bg-blue-50 text-[#1F5AA6] dark:bg-blue-900/30 dark:text-blue-400",
          },
          {
            title: "Top Annual Rate",
            value: `${Math.max(...banks.map((bank) => bank.depositRate)).toFixed(2)}% p.a.`,
            subtitle: [...banks].sort((a, b) => b.depositRate - a.depositRate)[0]?.name ?? "No bank",
            icon: <Percent className="size-5 text-emerald-600" />,
            iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
            valueColor: "text-emerald-600 dark:text-emerald-400",
          },
          {
            title: "Current Deposits",
            value: formatCompactRupiah(banks.reduce((sum, bank) => sum + bank.depositBalance, 0)),
            subtitle: "Across ranked institutions",
            icon: <Landmark className="size-5 text-indigo-600" />,
            iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
          },
        ]}
      />

      {/* Table & Filter Container Card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        <div className="filter-toolbar">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by bank name, rating..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>Group :</span>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none"
              >
                <option value="All">All Tiers</option>
                <option value="KBMI 4">KBMI 4 (Top Tier)</option>
                <option value="KBMI 3">KBMI 3 (Mid Tier)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>Status :</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              <span>24/11/2026</span>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table-reference">
            <thead>
              <tr>
                <th className="w-24 text-center">ACTION</th>
                <th className="w-12 text-center">RANK</th>
                <th>
                  <div className="flex items-center gap-1">
                    <span>BANK NAME</span>
                    <ChevronsUpDown className="size-3" />
                  </div>
                </th>
                <th>
                  <div className="flex items-center gap-1">
                    <span>RATE</span>
                    <ChevronsUpDown className="size-3" />
                  </div>
                </th>
                <th>SERVICE</th>
                <th>RATING</th>
                <th>NPL</th>
                <th>NIM</th>
                <th>CAR</th>
                <th>MAX SHARE</th>
                <th className="text-center">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {pagedBanks.map((bank) => (
                <tr key={bank.id}>
                  <td className="text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="iconView"
                        onClick={() => toast.info(`Viewing details for ${bank.name}`)}
                        title="View Bank"
                        aria-label="View Bank"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="iconEdit"
                        onClick={() => onEdit(bank)}
                        title="Edit Bank"
                        aria-label="Edit Bank"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="iconView"
                        onClick={() => onConfigureTemplate?.(bank)}
                        title="Configure Voucher PDF Template"
                        aria-label="Configure Voucher PDF Template"
                      >
                        <FileText className="size-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="text-center">
                    <span className="rank-mark">{String(bank.rank).padStart(2, "0")}</span>
                  </td>
                  <td>
                    <div className="font-semibold text-foreground">{bank.name}</div>
                    <div className="text-[10px] text-muted-foreground">Deposit balance · {formatCompactRupiah(bank.depositBalance)}</div>
                  </td>
                  <td className="font-mono font-semibold tabular-nums text-foreground">{bank.depositRate.toFixed(2)}% p.a.</td>
                  <td>{bank.serviceRating}</td>
                  <td>{bank.creditRating}</td>
                  <td className="font-mono">{bank.npl.toFixed(1)}%</td>
                  <td className="font-mono">{bank.nim.toFixed(1)}%</td>
                  <td className="font-mono">{bank.car.toFixed(1)}%</td>
                  <td className="font-mono font-medium">{bank.maxAllocationPercent}%</td>
                  <td className="text-center"><StatusBadge status={bank.active ? "Active" : "Inactive"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationBar
          currentPage={currentPage}
          totalItems={filteredBanks.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>
    </div>
  );
}

function InstructionsView({
  instructions,
  canCreate,
  onCreate,
  onMarkSent,
  onPrint,
}: {
  instructions: BankInstruction[];
  canCreate: boolean;
  onCreate: () => void;
  onMarkSent: (id: string) => void;
  onPrint: (item: BankInstruction) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    return instructions.filter((item) => {
      const matchSearch = item.id.toLowerCase().includes(search.toLowerCase()) || item.bankName.toLowerCase().includes(search.toLowerCase()) || item.voucherNumber.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [instructions, search, statusFilter]);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const downloadInstructionPdf = (item: BankInstruction) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Pop-up blocked by browser. Please allow pop-ups to download PDF documents.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Deposit Placement Instruction Letter - ${item.id}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 24px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0a386c; padding-bottom: 12px; margin-bottom: 24px; }
            .company { font-size: 18px; font-weight: bold; color: #0a386c; text-transform: uppercase; letter-spacing: 0.5px; }
            .dept { font-size: 13px; font-weight: 600; color: #475569; }
            .address { font-size: 11px; color: #64748b; margin-top: 2px; }
            .doc-meta { text-align: right; font-size: 11px; }
            .doc-id { font-family: monospace; font-weight: bold; font-size: 14px; color: #0f172a; }
            .subject-box { background: #f8fafc; border-left: 4px solid #1F5AA6; padding: 10px 14px; margin: 20px 0; font-weight: bold; font-size: 13px; color: #0f172a; }
            .table-spec { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
            .table-spec td { padding: 10px 14px; border: 1px solid #cbd5e1; }
            .table-spec td.label { width: 35%; background: #f1f5f9; font-weight: 600; color: #334155; }
            .table-spec td.value { font-weight: 500; color: #0f172a; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; }
            .sign-col { width: 220px; }
            .sign-space { height: 80px; }
            .sign-name { font-weight: bold; text-decoration: underline; font-size: 13px; }
            .sign-title { font-size: 11px; color: #64748b; margin-top: 2px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="company">PT KORPORA MAJU BERSAMA</div>
              <div class="dept">Treasury & Cash Management Division</div>
              <div class="address">Indonesia Stock Exchange Building, Tower 2, 18th Floor, South Jakarta</div>
            </div>
            <div class="doc-meta">
              <div class="doc-id">${item.id}</div>
              <div>Voucher Ref: <strong>${item.voucherNumber}</strong></div>
              <div>Issue Date: ${formatDate(item.createdAt)}</div>
              <div style="margin-top: 4px;"><span style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 10px;">${item.status}</span></div>
            </div>
          </div>

          <p style="font-size: 12px; margin-bottom: 4px;">To:</p>
          <p style="font-size: 13px; font-weight: bold; margin: 0 0 2px 0;">Head of Operations / Corporate Division</p>
          <p style="font-size: 13px; font-weight: 600; margin: 0 0 2px 0; color: #1F5AA6;">${item.bankName}</p>
          <p style="font-size: 12px; color: #64748b; margin: 0;">Main Branch Office</p>

          <div class="subject-box">
            Subject: Term Deposit Placement Instruction Letter (Time Deposit)
          </div>

          <p style="font-size: 12px; color: #334155; line-height: 1.6;">
            Dear Sir/Madam, in connection with cash optimization and corporate liquidity placement, we hereby instruct the placement of a Time Deposit on behalf of <strong>PT Korpora Maju Bersama</strong> with the following details:
          </p>

          <table class="table-spec">
            <tr>
              <td class="label">Beneficiary Bank</td>
              <td class="value"><strong>${item.bankName}</strong></td>
            </tr>
            <tr>
              <td class="label">Principal Placement Amount</td>
              <td class="value" style="font-size: 14px; font-weight: bold; font-family: monospace; color: #0a386c;">${formatRupiah(item.amount)}</td>
            </tr>
            <tr>
              <td class="label">Effective Placement Date</td>
              <td class="value">${formatDate(item.createdAt)}</td>
            </tr>
            <tr>
              <td class="label">Maturity Date</td>
              <td class="value">${formatDate(item.maturityDate)}</td>
            </tr>
            <tr>
              <td class="label">Tenor</td>
              <td class="value">90 Business Days</td>
            </tr>
            <tr>
              <td class="label">Source Debit Account</td>
              <td class="value" style="font-family: monospace;">102-00-982144-0 (Operational Current Account IDR)</td>
            </tr>
            <tr>
              <td class="label">Maturity Instruction</td>
              <td class="value">Non-ARO (Principal and Interest credited back to Source Account)</td>
            </tr>
            <tr>
              <td class="label">Document Template Format</td>
              <td class="value" style="font-family: monospace; font-size: 11px;">${item.template}</td>
            </tr>
          </table>

          <p style="font-size: 11px; color: #64748b; line-height: 1.5;">
            Please issue and deliver the deposit certificate or electronic placement confirmation to the Corporate Treasury Department via official email. Thank you for your cooperation.
          </p>

          <div class="signatures">
            <div class="sign-col">
              <div class="sign-title">Prepared By,</div>
              <div class="sign-space"></div>
              <div class="sign-name">Agus Setiawan</div>
              <div class="sign-title">Treasury Dept. Head</div>
            </div>
            <div class="sign-col">
              <div class="sign-title">Approved By,</div>
              <div class="sign-space"></div>
              <div class="sign-name">Bambang Hartono</div>
              <div class="sign-title">Finance Accounting Director</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    toast.success(`Opening PDF document ${item.id} for printing / download.`);
  };

  return (
    <div className="space-y-4">
      <StatCardGrid
        columns={4}
        items={[
          {
            title: "Total Instructions",
            value: instructions.length,
            subtitle: "Total records generated",
            icon: <FileText className="size-5 text-[#1F5AA6]" />,
            iconBg: "bg-blue-50 text-[#1F5AA6] dark:bg-blue-900/30 dark:text-blue-400",
          },
          {
            title: "Total Placed Amount",
            value: formatCompactRupiah(instructions.reduce((sum, item) => sum + item.amount, 0)),
            subtitle: "Overall instruction volume",
            icon: <Banknote className="size-5 text-emerald-600" />,
            iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
          },
          {
            title: "Sent to Bank",
            value: instructions.filter((item) => item.status === "Sent to bank").length,
            subtitle: "Delivered to institutions",
            icon: <Check className="size-5 text-emerald-600" />,
            iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
            valueColor: "text-emerald-600 dark:text-emerald-400",
          },
          {
            title: "Draft Instructions",
            value: instructions.filter((item) => item.status === "Draft").length,
            subtitle: "Pending dispatch",
            icon: <Clock3 className="size-5 text-amber-600" />,
            iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
            valueColor: "text-amber-600 dark:text-amber-400",
          },
        ]}
      />

      {/* Table & Filter Container Card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        <div className="filter-toolbar">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by instruction ID, bank, voucher..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>Status :</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none"
              >
                <option value="All">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Sent to bank">Sent to bank</option>
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              <span>24/11/2026</span>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table-reference">
            <thead>
              <tr>
                <th className="w-28 text-center">ACTION</th>
                <th className="w-12 text-center">NO.</th>
                <th>
                  <div className="flex items-center gap-1">
                    <span>INSTRUCTION ID</span>
                    <ChevronsUpDown className="size-3" />
                  </div>
                </th>
                <th>BANK</th>
                <th>VOUCHER</th>
                <th>AMOUNT</th>
                <th>MATURITY</th>
                <th>TEMPLATE</th>
                <th className="text-center">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((item, index) => (
                <tr key={item.id}>
                  <td className="text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="iconView"
                        onClick={() => onPrint(item)}
                        title="Print / View Letter"
                        aria-label="Print / View Letter"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="iconDownload"
                        onClick={() => downloadInstructionPdf(item)}
                        title="Download PDF Document"
                        aria-label="Download PDF Document"
                      >
                        <Download className="size-4 text-rose-500" />
                      </Button>
                      {item.status !== "Sent to bank" ? (
                        <Button
                          type="button"
                          variant="icon"
                          intent="success"
                          onClick={() => onMarkSent(item.id)}
                          title="Mark Sent to Bank"
                          aria-label="Mark Sent to Bank"
                        >
                          <Check className="size-4 text-emerald-600" />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                  <td className="text-center font-mono text-muted-foreground">
                    {(currentPage - 1) * pageSize + index + 1}
                  </td>
                  <td>
                    <div className="font-semibold text-foreground">{item.id}</div>
                    <div className="text-[10px] text-muted-foreground">Created {formatDate(item.createdAt)}</div>
                  </td>
                  <td className="font-medium text-foreground">{item.bankName}</td>
                  <td className="font-mono text-xs">{item.voucherNumber}</td>
                  <td className="whitespace-nowrap font-mono font-medium tabular-nums text-foreground">{formatCompactRupiah(item.amount)}</td>
                  <td className="whitespace-nowrap font-mono text-[11px]">{formatDate(item.maturityDate)}</td>
                  <td>{item.template}</td>
                  <td className="text-center"><StatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? (
            <div className="py-8">
              <EmptyState title="No bank instructions found" description="Create vouchers from an approved proposal to generate instructions." />
            </div>
          ) : null}
        </div>

        <PaginationBar
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>
    </div>
  );
}

function ReportsView({
  workspace,
  onExport,
  onPrint,
}: {
  workspace: WorkspaceData;
  onExport: (kind: "cashflow" | "allocation" | "position") => void;
  onPrint: () => void;
}) {
  const totalDeposits = workspace.banks.reduce((sum, bank) => sum + bank.depositBalance, 0);
  const incoming = workspace.cashflows.filter((item) => item.direction === "Incoming").reduce((sum, item) => sum + item.amount, 0);
  const outgoing = workspace.cashflows.filter((item) => item.direction === "Outgoing").reduce((sum, item) => sum + item.amount, 0);
  const reports = [
    { name: "Balance & Deposit Allocation", period: "November 2026", generated: "24 Nov 2026", status: "Ready", kind: "allocation" as const, icon: FileCheck2, detail: "Current proposal, rate and equity-limit comparison" },
    { name: "Deposit Position as of", period: "24 November 2026", generated: "24 Nov 2026", status: "Ready", kind: "position" as const, icon: Landmark, detail: "Bank-by-bank balance, share and maturity date" },
    { name: "Cash Flow Forecast", period: "Week 48 · 2026", generated: "24 Nov 2026", status: "Ready", kind: "cashflow" as const, icon: Activity, detail: "Actual and forecast incoming and outgoing" },
  ];
  return (
    <div className="space-y-5">
      <StatCardGrid
        columns={3}
        items={[
          {
            title: "Total Equity",
            value: formatCompactRupiah(workspace.parameters.equity),
            subtitle: "Current parameter set",
            icon: <ShieldCheck className="size-5 text-[#1F5AA6]" />,
            iconBg: "bg-blue-50 text-[#1F5AA6] dark:bg-blue-900/30 dark:text-blue-400",
          },
          {
            title: "Total Time Deposits",
            value: formatCompactRupiah(totalDeposits),
            subtitle: `${((totalDeposits / workspace.parameters.equity) * 100).toFixed(1)}% of equity`,
            icon: <Landmark className="size-5 text-indigo-600" />,
            iconBg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
          },
          {
            title: "Net Forecast Cash Flow",
            value: formatCompactRupiah(incoming - outgoing),
            subtitle: "Week 48 · IDR",
            icon: <Activity className="size-5 text-emerald-600" />,
            iconBg: incoming >= outgoing
              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
            valueColor: incoming >= outgoing
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400",
          },
        ]}
      />
      <Panel>
        <PanelHeading title="Available reports" detail="Export a spreadsheet or print to PDF." action={<Button variant="outline" size="sm" onClick={onPrint}><Download className="size-3.5" aria-hidden="true" />Print report</Button>} />
        <div className="divide-y divide-border">
          {reports.map((report) => {
            const Icon = report.icon;
            return <div key={report.name} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="report-icon"><Icon className="size-4" aria-hidden="true" /></div><div><p className="text-sm font-medium text-foreground">{report.name}</p><p className="mt-1 text-xs text-muted-foreground">{report.detail}</p><p className="mt-1.5 text-[10px] text-muted-foreground">{report.period} · Generated {report.generated}</p></div></div><div className="flex items-center gap-2"><StatusBadge status={report.status} /><Button variant="outline" size="sm" onClick={() => onExport(report.kind)}><FileSpreadsheet className="size-3.5" aria-hidden="true" />Export CSV</Button></div></div>;
          })}
        </div>
      </Panel>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Current position snapshot</h3>
          <p className="text-xs text-muted-foreground">As of 24 November 2026 · sample values</p>
        </div>
        <div className="table-wrap">
          <table className="table-reference">
            <thead>
              <tr>
                <th className="w-12 text-center">NO.</th>
                <th>BANK NAME</th>
                <th>DEPOSIT BALANCE</th>
                <th>SHARE OF TOTAL</th>
                <th>RATE</th>
                <th>RANK</th>
                <th>FORECAST INTEREST (90D)</th>
              </tr>
            </thead>
            <tbody>
              {workspace.banks.map((bank, index) => (
                <tr key={bank.id}>
                  <td className="text-center font-mono text-muted-foreground">{index + 1}</td>
                  <td className="font-semibold text-foreground">{bank.name}</td>
                  <td className="font-mono tabular-nums">{formatRupiah(bank.depositBalance)}</td>
                  <td>{totalDeposits ? `${((bank.depositBalance / totalDeposits) * 100).toFixed(1)}%` : "0%"}</td>
                  <td className="font-mono">{bank.depositRate.toFixed(2)}%</td>
                  <td><span className="rank-mark">{bank.rank}</span></td>
                  <td className="font-mono tabular-nums">{formatRupiah((bank.depositBalance * bank.depositRate * 90) / 36_500 / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MasterDataView({
  parameters,
  onSaveParameters,
  onResetDefaults,
}: {
  parameters: DepositParameters;
  onSaveParameters: (next: DepositParameters) => void;
  onResetDefaults: () => void;
}) {
  const [draft, setDraft] = useState(parameters);
  useEffect(() => setDraft(parameters), [parameters]);
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSaveParameters(draft);
  };

  const tabItems: TabItem[] = [
    {
      value: "Parameters",
      label: "Placement Parameters",
      icon: <SlidersHorizontal className="size-3.5" />,
      content: (
        <form onSubmit={save} className="w-full pt-2">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground">Placement constraints</h2>
            <p className="mt-1 text-xs text-muted-foreground">Values shown here are editable sample parameters.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
            <ParameterInput
              label="Deposit trigger (IDR)"
              value={draft.depositTrigger}
              onChange={(value) => setDraft({ ...draft, depositTrigger: value })}
              prefix="Rp."
              isCurrency
            />
            <ParameterInput
              label="Maximum deposits (% of equity)"
              value={draft.maxEquityPercent}
              onChange={(value) => setDraft({ ...draft, maxEquityPercent: value })}
              suffix="%"
            />
            <ParameterInput
              label="Minimum placement (IDR)"
              value={draft.minimumPlacement}
              onChange={(value) => setDraft({ ...draft, minimumPlacement: value })}
              prefix="Rp."
              isCurrency
            />
            <ParameterInput
              label="Equity (IDR)"
              value={draft.equity}
              onChange={(value) => setDraft({ ...draft, equity: value })}
              prefix="Rp."
              isCurrency
            />
            <ParameterInput
              label="Existing deposits (IDR)"
              value={draft.existingDeposits}
              onChange={(value) => setDraft({ ...draft, existingDeposits: value })}
              prefix="Rp."
              isCurrency
            />
            <ParameterInput
              label="Available cash (IDR)"
              value={draft.availableCash}
              onChange={(value) => setDraft({ ...draft, availableCash: value })}
              prefix="Rp."
              isCurrency
            />
          </div>
          <div className="mt-5 flex w-full flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onResetDefaults}>
              <RefreshCw className="mr-1.5 size-3.5" />
              Reset demo defaults
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Saved to this browser only.</span>
              <Button type="submit" className="btn-blue">
                <Check className="size-4" aria-hidden="true" />
                Save parameters
              </Button>
            </div>
          </div>
        </form>
      ),
    },
    {
      value: "Calendars",
      label: "Calendars & Rules",
      icon: <Calendar className="size-3.5" />,
      content: (
        <div className="space-y-6 pt-2">
          <MasterList
            title="Calendar & Timing Constraints"
            description="Official calendars and non-working days used to calculate and validate deposit maturity dates."
            columns={["Calendar / Rule", "Specification", "Source", "Status"]}
            rows={[
              ["National holiday calendar", "16 official Indonesian national holidays (SKB 3 Menteri)", "Master data", "Enforced"],
              ["IDBM calendar (PUAB)", "Money market trading hours 08:30 - 15:00 WIB · T+0 settlement", "Bank Indonesia / PUAB", "Active"],
              ["Bank Indonesia calendar", "BI-RTGS & settlement operational days · Year-end closing", "Bank Indonesia", "Active"],
              ["Each bank due date pattern", "Following Business Day convention & per-bank cut-off times", "Bank ranking master", "Active"],
            ]}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-2xs">
              <h3 className="mb-2 text-xs font-semibold text-foreground">Each Bank Due Date Patterns</h3>
              <p className="mb-3 text-[11px] text-muted-foreground">Settlement convention, cut-off hours, and rollover rules applied per institution.</p>
              <div className="table-wrap">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground">
                      <th className="px-3 py-2 text-left">Bank</th>
                      <th className="px-3 py-2 text-left">Convention</th>
                      <th className="px-3 py-2 text-left">Cut-off</th>
                      <th className="px-3 py-2 text-left">Settlement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {BANK_DUE_DATE_PATTERNS.map((b) => (
                      <tr key={b.bankId} className="text-[11px]">
                        <td className="px-3 py-2 font-medium text-foreground">{b.bankName}</td>
                        <td className="px-3 py-2">{b.convention}</td>
                        <td className="px-3 py-2 font-mono">{b.cutOffTime}</td>
                        <td className="px-3 py-2">{b.settlementCycle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-2xs">
              <h3 className="mb-2 text-xs font-semibold text-foreground">National Holidays & BI Calendar 2026</h3>
              <p className="mb-3 text-[11px] text-muted-foreground">Non-clearing dates used to roll forward placement maturities to the next business day.</p>
              <div className="max-h-[220px] overflow-y-auto pr-1">
                <div className="space-y-1.5">
                  {INDONESIAN_NATIONAL_HOLIDAYS_2026.slice(0, 8).map((h) => (
                    <div key={h.date} className="flex items-center justify-between rounded border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[11px]">
                      <span className="font-mono text-muted-foreground">{h.date}</span>
                      <span className="font-medium text-foreground truncate max-w-[200px]">{h.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">Holiday</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Panel>
      <Tabs items={tabItems} variant="primary" defaultValue="Parameters" />
    </Panel>
  );
}

function ParameterInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  isCurrency = false,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  isCurrency?: boolean;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(() =>
    isCurrency ? (value ? value.toLocaleString("id-ID") : "") : String(value ?? 0)
  );

  useEffect(() => {
    if (isCurrency) {
      setDisplayValue(value ? value.toLocaleString("id-ID") : "");
    } else {
      setDisplayValue(String(value ?? 0));
    }
  }, [value, isCurrency]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (isCurrency) {
      const digits = raw.replace(/\D/g, "");
      if (!digits) {
        setDisplayValue("");
        onChange(0);
        return;
      }
      const num = Number(digits);
      setDisplayValue(num.toLocaleString("id-ID"));
      onChange(num);
    } else {
      setDisplayValue(raw);
      const num = parseFloat(raw);
      onChange(isNaN(num) ? 0 : num);
    }
  };

  return (
    <label className={cn("block w-full", className)}>
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      <div className="flex w-full items-stretch rounded-lg border border-input bg-background shadow-2xs transition-all focus-within:border-[#1F5AA6] focus-within:ring-2 focus-within:ring-[#1F5AA6]/20">
        {prefix ? (
          <span className="inline-flex items-center px-3 text-xs font-semibold text-muted-foreground bg-muted/60 dark:bg-muted/30 border-r border-input select-none shrink-0">
            {prefix}
          </span>
        ) : null}
        <input
          type={isCurrency ? "text" : "number"}
          inputMode={isCurrency ? "numeric" : "decimal"}
          min={0}
          step={isCurrency ? undefined : "any"}
          value={displayValue}
          onChange={handleChange}
          className="h-9 w-full min-w-0 flex-1 bg-transparent px-3 py-1 text-sm font-mono tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {suffix ? (
          <span className="inline-flex items-center px-3 text-xs font-semibold text-muted-foreground bg-muted/60 dark:bg-muted/30 border-l border-input select-none shrink-0">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function MasterList({ title, description, columns, rows }: { title: string; description: string; columns: string[]; rows: string[][] }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        <div className="table-wrap">
          <table className="table-reference">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((value, index) => (
                    <td key={`${row[0]}-${index}`}>
                      {index === row.length - 1 ? <StatusBadge status={value} /> : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">Reference data · Sample workspace</div>
    </div>
  );
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
          <DialogFooter><Button type="submit" className="btn-blue"><Plus className="size-4" aria-hidden="true" />Save as draft</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AllocationEditDialog({
  line,
  banks,
  open,
  onOpenChange,
  onSave,
}: {
  line: AllocationLine | null;
  banks: Bank[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: string,
    bankId: string,
    amount: number,
    tenorDays: number,
    maturityDate: string,
    reason: string
  ) => void;
}) {
  const [bankId, setBankId] = useState("");
  const [amount, setAmount] = useState("");
  const [tenor, setTenor] = useState("90");
  const [maturityDate, setMaturityDate] = useState("");
  const [overrideSchedule, setOverrideSchedule] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (line) {
      setBankId(line.bankId);
      setAmount(String(line.amount));
      setTenor(String(line.tenorDays));
      setMaturityDate(line.maturityDate);
      setOverrideSchedule(false);
      setReason("");
    }
  }, [line]);

  const handleTenorChange = (val: string) => {
    setTenor(val);
    const num = Number(val);
    if (!overrideSchedule && Number.isInteger(num) && num > 0) {
      setMaturityDate(addBusinessDays(new Date().toISOString().slice(0, 10), num));
    }
  };

  const selectedBank = banks.find((b) => b.id === bankId) ?? banks.find((b) => b.name === line?.bankName);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextAmount = Number(amount);
    const nextTenor = Number(tenor);
    if (
      !line ||
      !Number.isFinite(nextAmount) ||
      nextAmount <= 0 ||
      !Number.isInteger(nextTenor) ||
      nextTenor < 1 ||
      !reason.trim()
    ) {
      toast.error("Enter a valid amount, tenor and adjustment reason.");
      return;
    }
    const finalMaturity = maturityDate || addBusinessDays(new Date().toISOString().slice(0, 10), nextTenor);
    onSave(line.id, bankId || line.bankId, nextAmount, nextTenor, finalMaturity, reason.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust TD Placement</DialogTitle>
          <DialogDescription>
            {line
              ? `Adjust placement amount, tenor, bank allocation, and schedule for ${line.bankName}.`
              : "Update suggested placement."}
          </DialogDescription>
        </DialogHeader>
        {line ? (
          <form onSubmit={submit} className="space-y-4">
            {/* 1. Adjustment Bank Allocation */}
            <label className="block">
              <span className="field-label">Bank Allocation</span>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
              >
                {banks
                  .filter((b) => b.active)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — Rank #{b.rank} ({b.depositRate.toFixed(2)}% p.a. · Max {b.maxAllocationPercent}%)
                    </option>
                  ))}
              </select>
              {selectedBank ? (
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Current rate: <strong className="text-foreground">{selectedBank.depositRate.toFixed(2)}%</strong></span>
                  <span>Limit: <strong className="text-foreground">{selectedBank.maxAllocationPercent}%</strong></span>
                  <span>Existing deposit: <strong className="text-foreground">{formatCompactRupiah(selectedBank.depositBalance)}</strong></span>
                </div>
              ) : null}
            </label>

            {/* 2. Adjustment TD Amount */}
            <label className="block">
              <span className="field-label">Placement Amount (IDR)</span>
              <Input
                type="number"
                min="1"
                step="1000000"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                {amount && Number(amount) > 0 ? formatRupiah(Number(amount)) : "Min. placement Rp.100.000.000"}
              </span>
            </label>

            {/* 3. Adjustment TD Tenor */}
            <div>
              <span className="field-label">Tenor (Business Days)</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={tenor}
                  onChange={(event) => handleTenorChange(event.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[30, 60, 90, 180, 365].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleTenorChange(String(days))}
                    className={cn(
                      "rounded border px-2 py-0.5 text-[10px] font-medium transition-colors",
                      tenor === String(days)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Override Suggested Schedule */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Override Suggested Schedule</span>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={overrideSchedule}
                    onChange={(e) => {
                      setOverrideSchedule(e.target.checked);
                      if (!e.target.checked && Number(tenor) > 0) {
                        setMaturityDate(addBusinessDays(new Date().toISOString().slice(0, 10), Number(tenor)));
                      }
                    }}
                    className="size-3.5 rounded border-border"
                  />
                  <span>Manual date</span>
                </label>
              </div>
              <div className="mt-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">Maturity Date</span>
                  <Input
                    type="date"
                    value={maturityDate}
                    disabled={!overrideSchedule}
                    onChange={(event) => setMaturityDate(event.target.value)}
                    className={cn("text-xs font-mono", !overrideSchedule && "opacity-70 bg-muted/50 cursor-not-allowed")}
                  />
                </label>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {overrideSchedule
                    ? "Schedule is manually overridden by user."
                    : "Auto-calculated based on tenor in business days."}
                </p>
              </div>
            </div>

            {/* Audit Reason */}
            <label className="block">
              <span className="field-label">Reason for Adjustment</span>
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Rate negotiation with bank, cash flow timing override..."
              />
              <span className="mt-0.5 block text-[10px] text-muted-foreground">Required for governance & audit trail.</span>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-blue" size="sm">
                <Check className="size-3.5" aria-hidden="true" />
                Save Adjustment
              </Button>
            </DialogFooter>
          </form>
        ) : null}
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
        {draft ? <form onSubmit={submit} className="space-y-4"><div className="grid grid-cols-2 gap-3"><ParameterInput label="Rank" value={draft.rank} onChange={(value) => setDraft({ ...draft, rank: value })} /><ParameterInput label="Deposit rate (%)" value={draft.depositRate} onChange={(value) => setDraft({ ...draft, depositRate: value })} suffix="%" /><ParameterInput label="Maximum allocation share (%)" value={draft.maxAllocationPercent} onChange={(value) => setDraft({ ...draft, maxAllocationPercent: value })} suffix="%" /><label className="flex items-center gap-2 self-end pb-2 text-xs text-foreground"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Active for placement</label></div><DialogFooter><Button type="submit" className="btn-blue"><Check className="size-4" aria-hidden="true" />Save bank</Button></DialogFooter></form> : null}
      </DialogContent>
    </Dialog>
  );
}

const VOUCHER_TEMPLATE_PRESETS = [
  {
    id: "BCA — Fixed Deposit PDF Layout",
    label: "BCA — Fixed Deposit PDF Layout",
    desc: "Standard BCA format for corporate time deposit placement instructions and formal advisory.",
  },
  {
    id: "Mandiri — Universal Corporate Voucher",
    label: "Mandiri — Universal Corporate Voucher",
    desc: "Mandiri formal voucher layout for corporations with maker-checker-signer validation.",
  },
  {
    id: "BNI — Time Deposit Placement Letter",
    label: "BNI — Time Deposit Placement Letter",
    desc: "Official BNI instruction letter with debit account details and principal amount attachments.",
  },
  {
    id: "CIMB Niaga — Placement Template",
    label: "CIMB Niaga — Placement Template",
    desc: "CIMB Niaga time deposit placement template with ARO rollover clauses.",
  },
  {
    id: "Danamon — Standard Term Deposit Letter",
    label: "Danamon — Standard Term Deposit Letter",
    desc: "Formal Bank Danamon layout with maturity instructions table and certificate number.",
  },
  {
    id: "Universal — Standard Corporate Placement Voucher",
    label: "Universal — Standard Corporate Placement Voucher",
    desc: "Universal corporate template compatible with all partner banks.",
  },
];

function BankTemplateDialog({
  bank,
  open,
  onOpenChange,
  onSave,
}: {
  bank: Bank | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (bankId: string, template: string) => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    bank?.template || (bank ? `${bank.name} — Fixed Deposit PDF Layout` : "Universal — Standard Corporate Placement Voucher")
  );
  const [letterheadStyle, setLetterheadStyle] = useState<string>("Official Treasury Letterhead");
  const [signatoryLevel, setSignatoryLevel] = useState<string>("Dual Signatory (Treasury Head & Finance Director)");
  const [paperFormat, setPaperFormat] = useState<string>("A4 Portrait");
  const [includeQrCode, setIncludeQrCode] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (bank) {
      setSelectedTemplate(bank.template || `${bank.name} — Fixed Deposit PDF Layout`);
    }
  }, [bank]);

  if (!bank) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(bank.id, selectedTemplate);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-blue-600" />
            <DialogTitle>Bank Voucher & PDF Template Settings</DialogTitle>
          </div>
          <DialogDescription>
            Select and configure the PDF document layout for placement instructions and vouchers for <strong>{bank.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Bank Info Summary Banner */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-xs">
            <div>
              <span className="font-semibold text-foreground">{bank.name}</span>
              <span className="ml-2 text-muted-foreground">Rank #{bank.rank} · Rate {bank.depositRate.toFixed(2)}% p.a.</span>
            </div>
            <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
              Max Allocation: {bank.maxAllocationPercent}%
            </span>
          </div>

          {/* Template Preset Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Voucher & Bank Instruction Template Options
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
            >
              {VOUCHER_TEMPLATE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              {VOUCHER_TEMPLATE_PRESETS.find((p) => p.id === selectedTemplate)?.desc ?? "Custom banking template for PDF file output."}
            </p>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Letterhead Format</label>
              <select
                value={letterheadStyle}
                onChange={(e) => setLetterheadStyle(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="Official Treasury Letterhead">Official (PT Korpora Maju Bersama — Treasury)</option>
                <option value="Compact Corporate Header">Compact Corporate Header (Without Full Address)</option>
                <option value="Plain Bank Letter">Plain Format (No Corporate Header)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Signatory Authorization</label>
              <select
                value={signatoryLevel}
                onChange={(e) => setSignatoryLevel(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="Dual Signatory (Treasury Head & Finance Director)">Dual Signatory (Dept Head & Director)</option>
                <option value="Single Signatory (Treasury Manager)">Single Signatory (Treasury Manager)</option>
                <option value="Triple Signatory (Treasury, Div Head & Director)">Triple Signatory (Complete 3 Levels)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Paper Size / Orientation</label>
              <select
                value={paperFormat}
                onChange={(e) => setPaperFormat(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="A4 Portrait">A4 — Portrait (Banking Standard)</option>
                <option value="A4 Landscape">A4 — Landscape</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 pb-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeQrCode}
                  onChange={(e) => setIncludeQrCode(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Include QR Code for authentication verification</span>
              </label>
            </div>
          </div>

          {/* Custom Instruction Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Special Banking Clauses / Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Example: Automatic rollover of principal & interest (ARO + Interest), confirmation via dealing room..."
              className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Live Document Preview Box */}
          <div className="rounded-lg border border-border bg-muted/20 p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PDF Document Layout Preview</span>
              <span className="font-mono text-[10px] text-muted-foreground">{paperFormat}</span>
            </div>
            <div className="rounded border border-dashed border-border bg-card p-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border pb-2 text-[11px]">
                <span className="font-bold uppercase text-foreground">{letterheadStyle.split(" (")[0]}</span>
                <span className="font-mono text-[9px] text-muted-foreground">VCH-PDF-{bank.id.toUpperCase()}</span>
              </div>
              <div className="py-2 text-[11px] text-muted-foreground">
                <div className="font-medium text-foreground">To: {bank.name} — Corporate Treasury Division</div>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span>Template: <strong className="text-foreground">{selectedTemplate}</strong></span>
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">Ready to Print</span>
                </div>
              </div>
              <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
                <span>Authorization: {signatoryLevel}</span>
                {includeQrCode && <span className="ml-2 font-mono text-[9px] text-emerald-600 dark:text-emerald-400">• QR Verified</span>}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="btn-blue">
              <Check className="size-4" aria-hidden="true" />
              Save Bank Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InstructionLetterDialog({
  instruction,
  open,
  onOpenChange,
}: {
  instruction: BankInstruction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!instruction) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Deposit Placement Instruction Letter</DialogTitle>
            <StatusBadge status={instruction.status} />
          </div>
          <DialogDescription>
            Official physical banking instruction document for printing, signature authorization, and bank dispatch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 rounded-lg border border-border bg-card p-6 text-xs text-foreground">
          {/* Letterhead */}
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <p className="text-sm font-bold tracking-wider uppercase text-foreground">PT KORPORA MAJU BERSAMA</p>
              <p className="text-[11px] font-medium text-muted-foreground">Treasury & Cash Management Division</p>
              <p className="text-[10px] text-muted-foreground">Indonesia Stock Exchange Building, Tower 2, Jakarta</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs font-semibold text-foreground">{instruction.id}</span>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Voucher: {instruction.voucherNumber}</p>
              <p className="text-[10px] text-muted-foreground">{formatDate(instruction.createdAt)}</p>
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-0.5">
            <p className="font-medium text-muted-foreground">To:</p>
            <p className="font-semibold text-foreground">Head of Operations / Corporate Division</p>
            <p className="font-medium text-foreground">{instruction.bankName}</p>
            <p className="text-[11px] text-muted-foreground">Main Branch Office</p>
          </div>

          {/* Subject */}
          <div className="rounded border border-border bg-muted/40 p-2.5">
            <p className="font-semibold text-[11px] text-foreground">
              Subject: Opening & Term Deposit Placement Instructions (Time Deposit)
            </p>
          </div>

          <p className="leading-relaxed text-muted-foreground">
            Dear Sir/Madam, in connection with cash optimization and corporate liquidity placement, we hereby instruct the placement of a Time Deposit on behalf of <strong>PT Korpora Maju Bersama</strong> with the following details:
          </p>

          {/* Detail Table */}
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-border">
                <tr className="bg-muted/20">
                  <td className="w-1/3 px-3 py-2 font-medium text-muted-foreground">Beneficiary Bank</td>
                  <td className="px-3 py-2 font-semibold text-foreground">{instruction.bankName}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-muted-foreground">Principal Placement Amount</td>
                  <td className="px-3 py-2 font-mono text-sm font-bold text-foreground">{formatRupiah(instruction.amount)}</td>
                </tr>
                <tr className="bg-muted/20">
                  <td className="px-3 py-2 font-medium text-muted-foreground">Effective Placement Date</td>
                  <td className="px-3 py-2 font-medium text-foreground">{formatDate(instruction.createdAt)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-muted-foreground">Maturity Date</td>
                  <td className="px-3 py-2 font-medium text-foreground">{formatDate(instruction.maturityDate)}</td>
                </tr>
                <tr className="bg-muted/20">
                  <td className="px-3 py-2 font-medium text-muted-foreground">Tenor</td>
                  <td className="px-3 py-2 font-medium text-foreground">90 Business Days</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-muted-foreground">Source Debit Account</td>
                  <td className="px-3 py-2 font-mono text-foreground">102-00-982144-0 (Operational Current Account IDR)</td>
                </tr>
                <tr className="bg-muted/20">
                  <td className="px-3 py-2 font-medium text-muted-foreground">Maturity Instruction</td>
                  <td className="px-3 py-2 font-medium text-foreground">Non-ARO (Principal and Interest credited back to Source Account)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-muted-foreground">Template Format</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{instruction.template}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Please issue and deliver the deposit certificate or electronic placement confirmation to the Corporate Treasury Department via official email. Thank you for your cooperation.
          </p>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 border-t border-border pt-4 text-center">
            <div className="space-y-12">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Prepared By,</p>
              <div>
                <p className="font-semibold underline text-foreground">Agus Setiawan</p>
                <p className="text-[10px] text-muted-foreground">Treasury Dept. Head</p>
              </div>
            </div>
            <div className="space-y-12">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Approved By,</p>
              <div>
                <p className="font-semibold underline text-foreground">Bambang Hartono</p>
                <p className="text-[10px] text-muted-foreground">Finance Accounting Director</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
          <span className="text-[11px] text-muted-foreground">Voucher Ref: {instruction.voucherNumber}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
            <Button size="sm" onClick={() => window.print()} className="btn-blue"><Download className="mr-1.5 size-3.5" />Print Document (PDF)</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadExcelDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: CashflowItem[], filename?: string | undefined) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = (file: File) => {
    setSelectedFile(file);
  };

  const processImport = () => {
    if (!selectedFile) {
      toast.error("Please select an Excel or CSV file first.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text && typeof text === "string" && text.includes(",")) {
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length > 1) {
          const newRecords: CashflowItem[] = [];
          for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i];
            if (!currentLine) continue;
            const parts = currentLine.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
            if (parts.length >= 4) {
              const [ref, dept, cat, dir, amtStr, dueDateStr] = parts;
              const amount = Number((amtStr ?? "").replace(/[^0-9.-]+/g, "")) || 150_000_000;
              newRecords.push({
                id: `CF-IMP-${Date.now()}-${i}`,
                reference: ref || `Imported item ${i}`,
                department: dept || "Finance",
                category: cat || "Operations",
                direction: dir?.toLowerCase() === "incoming" ? "Incoming" : "Outgoing",
                amount,
                dueDate: dueDateStr || "2026-12-15",
                source: "Department form",
                status: "Submitted",
              });
            }
          }
          if (newRecords.length > 0) {
            onImport(newRecords, selectedFile.name);
            onOpenChange(false);
            setSelectedFile(null);
            return;
          }
        }
      }
      // If binary xlsx or unparsed text, simulate realistic imported records
      const timestamp = Date.now();
      const mockItems: CashflowItem[] = [
        {
          id: `CF-IMP-${timestamp}-1`,
          reference: "Plant Maintenance & Spares Q4",
          department: "Maintenance & Engineering",
          category: "Plant Maintenance",
          direction: "Outgoing",
          amount: 320_000_000,
          dueDate: "2026-12-10",
          source: "Department form",
          status: "Submitted",
        },
        {
          id: `CF-IMP-${timestamp}-2`,
          reference: "Receivable Collection Batch #109",
          department: "Sales & Marketing",
          category: "Customer collection",
          direction: "Incoming",
          amount: 850_000_000,
          dueDate: "2026-12-08",
          source: "Department form",
          status: "Submitted",
        },
        {
          id: `CF-IMP-${timestamp}-3`,
          reference: "Enterprise ERP Cloud Infrastructure",
          department: "Information Technology",
          category: "IT & Software",
          direction: "Outgoing",
          amount: 195_000_000,
          dueDate: "2026-12-18",
          source: "Department form",
          status: "Draft",
        },
      ];
      onImport(mockItems, selectedFile.name);
      onOpenChange(false);
      setSelectedFile(null);
    };
    reader.onerror = () => {
      toast.error("Failed to read file.");
    };
    reader.readAsText(selectedFile);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Cash Flow Excel</DialogTitle>
          <DialogDescription>
            Import cash inflow and outflow transactions via Excel (.xlsx, .xls) or CSV file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
              dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/20"
            )}
            onClick={() => document.getElementById("excel-file-input")?.click()}
          >
            <input
              id="excel-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <div className="mb-2.5 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="size-5" />
            </div>
            {selectedFile ? (
              <div>
                <p className="text-xs font-semibold text-foreground">{selectedFile.name}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB · Ready to import
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium text-foreground">Click to browse file or drag & drop</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Supports .xlsx, .xls, and .csv formats</p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">Excel Template Column Format:</p>
            <p className="mt-1 font-mono text-[10px]">
              Reference, Department, Category, Direction (Incoming/Outgoing), Amount, DueDate (YYYY-MM-DD)
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const timestamp = Date.now();
              onImport([
                {
                  id: `CF-TPL-${timestamp}-1`,
                  reference: "Q4 Marketing Campaigns & Ads",
                  department: "Marketing",
                  category: "Advertising",
                  direction: "Outgoing",
                  amount: 220_000_000,
                  dueDate: "2026-12-14",
                  source: "Department form",
                  status: "Submitted",
                },
                {
                  id: `CF-TPL-${timestamp}-2`,
                  reference: "Scrap & Residual Material Sale",
                  department: "Logistics",
                  category: "Scrap sales",
                  direction: "Incoming",
                  amount: 140_000_000,
                  dueDate: "2026-12-22",
                  source: "Department form",
                  status: "Submitted",
                },
              ], "Sample_Template.xlsx");
              onOpenChange(false);
            }}
            className="text-xs text-muted-foreground"
          >
            Use Sample Template
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={processImport} disabled={!selectedFile} className="btn-blue">
              <Upload className="mr-1.5 size-3.5" />
              Import Data
            </Button>
          </div>
        </DialogFooter>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [uploadExcelOpen, setUploadExcelOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<AllocationLine | null>(null);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [templateBank, setTemplateBank] = useState<Bank | null>(null);
  const [printingInstruction, setPrintingInstruction] = useState<BankInstruction | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isWorkspaceData(parsed)) {
          if (parsed.instructions.length < 10) {
            parsed.instructions = DEMO_WORKSPACE.instructions;
          }
          if (!parsed.cashflows[0]?.bankName || parsed.cashflows.length < 12) {
            parsed.cashflows = DEMO_WORKSPACE.cashflows;
          }
          setWorkspace(parsed);
        }
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

  const toggleTheme = () => setTheme((current) => current === "light" ? "dark" : "light");

  const recalculateProposal = () => {
    const date = new Date().toISOString().slice(0, 10);
    setWorkspace((current) => {
      const proposal = runAllocationProposal(current.parameters, current.banks, date);
      return withAudit({ ...current, proposal, allocationState: "Draft" }, "Allocation recalculated", `${formatCompactRupiah(proposal.totalAllocated)} · ${proposal.status}`);
    });
    toast.success("Allocation proposal recalculated.");
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

  const calculateBalance = (mode?: string, label?: string, periodNet?: number) => {
    const netToUse = periodNet !== undefined ? periodNet : workspace.cashflows.filter((item) => item.status === "Validated").reduce((sum, item) => sum + (item.direction === "Incoming" ? item.amount : -item.amount), 0);
    const modeLabel = label || "All periods";
    setWorkspace((current) => withAudit({
      ...current,
      cashBalance: Math.max(0, current.cashBalance + netToUse),
      parameters: {
        ...current.parameters,
        availableCash: Math.max(0, current.parameters.availableCash + netToUse),
      }
    }, `Cash flow calculated (${mode || "period"})`, `Calculated ${modeLabel} · Net movement: ${formatCompactRupiah(netToUse)}`));
    toast.success(`Cash flow calculated for ${modeLabel}! Net: ${formatCompactRupiah(netToUse)}`);
  };

  const addCashflow = (item: { reference: string; department: string; category: string; direction: "Incoming" | "Outgoing"; amount: number; dueDate: string }) => {
    const cashflow: CashflowItem = { ...item, id: `CF-${Date.now()}`, source: "Department form", status: "Draft" };
    setWorkspace((current) => withAudit({ ...current, cashflows: [cashflow, ...current.cashflows] }, "Cash flow form created", cashflow.reference));
    toast.success("Draft form saved.");
  };

  const handleImportCashflow = (newItems: CashflowItem[], filename?: string | undefined) => {
    setWorkspace((current) =>
      withAudit(
        { ...current, cashflows: [...newItems, ...current.cashflows] },
        "Cash flow Excel imported",
        `${newItems.length} records imported from ${filename ?? "Excel spreadsheet"}`
      )
    );
    toast.success(`${newItems.length} cash flow records successfully imported from Excel!`);
  };

  const handleAddPlacement = () => {
    const activeBanks = workspace.banks.filter((b) => b.active);
    const unusedBank = activeBanks.find(
      (b) => !workspace.proposal.lines.some((l) => l.bankId === b.id)
    ) ?? activeBanks[0];
    if (!unusedBank) {
      toast.error("No active banks available for placement.");
      return;
    }
    const newLine: AllocationLine = {
      id: `AL-${Date.now().toString().slice(-4)}`,
      bankId: unusedBank.id,
      bankName: unusedBank.name,
      rank: unusedBank.rank,
      amount: workspace.parameters.minimumPlacement,
      annualRate: unusedBank.depositRate,
      tenorDays: 90,
      maturityDate: addBusinessDays(new Date().toISOString().slice(0, 10), 90),
      reason: "Manual placement adjustment",
      status: "Adjusted",
    };
    const lines = [...workspace.proposal.lines, newLine];
    const totalAllocated = lines.reduce((sum, line) => sum + line.amount, 0);
    setWorkspace((current) => ({
      ...current,
      proposal: {
        ...current.proposal,
        status: "Ready",
        lines,
        totalAllocated,
        remainingCash: current.parameters.availableCash - totalAllocated,
      },
    }));
    setEditingAllocation(newLine);
  };

  const editAllocation = (
    id: string,
    bankId: string,
    amount: number,
    tenorDays: number,
    maturityDate: string,
    reason: string
  ) => {
    const original = workspace.proposal.lines.find((line) => line.id === id);
    if (!original) return;
    const targetBank = workspace.banks.find((b) => b.id === bankId) ?? workspace.banks.find((b) => b.name === original.bankName);
    const bankName = targetBank ? targetBank.name : original.bankName;
    const annualRate = targetBank ? targetBank.depositRate : original.annualRate;
    const rank = targetBank ? targetBank.rank : original.rank;

    const finalMaturityDate = maturityDate || addBusinessDays(new Date().toISOString().slice(0, 10), tenorDays);

    const lines = workspace.proposal.lines.map((line) =>
      line.id === id
        ? {
          ...line,
          bankId: targetBank ? targetBank.id : line.bankId,
          bankName,
          rank,
          annualRate,
          amount,
          tenorDays,
          maturityDate: finalMaturityDate,
          status: "Adjusted" as const,
          reason: `Manual override · ${reason}`,
        }
        : line
    );

    const validation = validateAllocationLines(lines, workspace.parameters);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    const totalAllocated = lines.reduce((sum, line) => sum + line.amount, 0);
    setWorkspace((current) =>
      withAudit(
        {
          ...current,
          proposal: {
            ...current.proposal,
            lines,
            totalAllocated,
            remainingCash: current.parameters.availableCash - totalAllocated,
          },
          allocationState: "Draft",
        },
        "Allocation adjusted",
        `${original.bankName} → ${bankName} · ${formatCompactRupiah(original.amount)} → ${formatCompactRupiah(amount)} · ${tenorDays}d · ${finalMaturityDate} · ${reason}`
      )
    );
    setEditingAllocation(null);
    toast.success(validation.message);
  };

  const saveBank = (bank: Bank) => {
    setWorkspace((current) => withAudit({ ...current, banks: current.banks.map((entry) => entry.id === bank.id ? bank : entry) }, "Bank ranking updated", `${bank.name} · rank ${bank.rank} · ${bank.depositRate.toFixed(2)}%`));
    setEditingBank(null);
    toast.success("Bank ranking saved.");
  };

  const saveBankTemplate = (bankId: string, template: string) => {
    const target = workspace.banks.find((b) => b.id === bankId);
    if (!target) return;
    setWorkspace((current) =>
      withAudit(
        {
          ...current,
          banks: current.banks.map((entry) => (entry.id === bankId ? { ...entry, template } : entry)),
        },
        "Voucher PDF template updated",
        `${target.name} · ${template}`
      )
    );
    setTemplateBank(null);
    toast.success(`PDF voucher template for ${target.name} successfully updated.`);
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
    if (workspace.proposal.lines.length === 0) {
      toast.error("Calculate a compliant proposal before creating vouchers.");
      return;
    }
    setWorkspace((current) => {
      const run = Date.now().toString().slice(-4);
      const now = Date.now().toString().slice(-6);
      const today = new Date().toISOString().slice(0, 10);

      const lines = current.proposal.lines.map((line, index) => ({
        ...line,
        status: "Voucher created" as const,
        voucherNumber: line.voucherNumber || `VCH-26-${run}-${index + 1}`,
      }));

      // Generate instructions for each voucher line that doesn't already have one
      const existingVoucherNumbers = new Set(current.instructions.map((item) => item.voucherNumber));
      const generatedInstructions: BankInstruction[] = lines
        .filter((line) => line.voucherNumber && !existingVoucherNumbers.has(line.voucherNumber))
        .map((line, idx) => {
          const bank = current.banks.find((b) => b.name === line.bankName || b.id === line.bankId);
          return {
            id: `BI-${now}-${line.rank || idx + 1}`,
            bankName: line.bankName,
            amount: line.amount,
            voucherNumber: line.voucherNumber ?? "",
            maturityDate: line.maturityDate,
            status: "Draft" as const,
            template: bank?.template ?? `${line.bankName} · Universal template`,
            createdAt: today,
          };
        });

      return withAudit(
        {
          ...current,
          proposal: { ...current.proposal, lines },
          instructions: [...generatedInstructions, ...current.instructions],
          allocationState: "Voucher created",
        },
        "ERP vouchers & bank instructions created",
        `${lines.length} vouchers created, ${generatedInstructions.length} bank instructions generated for Bank Instructions`,
        "System (demo)"
      );
    });
    toast.success("Voucher ERP dan Surat Instruksi Bank berhasil dibuat!");
  };

  const createInstructions = () => {
    if (workspace.allocationState !== "Voucher created") {
      toast.error("Create ERP vouchers before generating bank instructions.");
      return;
    }
    const newInstructions = workspace.proposal.lines.filter((line) => line.voucherNumber && !workspace.instructions.some((item) => item.voucherNumber === line.voucherNumber)).map((line) => ({
      id: `BI-${Date.now().toString().slice(-6)}-${line.rank}`,
      bankName: line.bankName,
      amount: line.amount,
      voucherNumber: line.voucherNumber ?? "",
      maturityDate: line.maturityDate,
      status: "Draft" as const,
      template: workspace.banks.find((b) => b.name === line.bankName || b.id === line.bankId)?.template ?? `${line.bankName} · Universal template`,
      createdAt: new Date().toISOString().slice(0, 10),
    }));
    if (!newInstructions.length) {
      toast.info("Instructions have already been created for these vouchers.");
      return;
    }
    setWorkspace((current) => withAudit({ ...current, instructions: [...newInstructions, ...current.instructions] }, "Bank instructions drafted", `${newInstructions.length} instruction(s) created from vouchers`));
    toast.success(`${newInstructions.length} bank instruction draft(s) created.`);
  };

  const markInstructionSent = (id: string) => {
    const item = workspace.instructions.find((instruction) => instruction.id === id);
    if (!item || item.status === "Sent to bank") return;
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

  const resetDefaults = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setWorkspace(DEMO_WORKSPACE);
    toast.success("Workspace data has been reset to demo defaults.");
  };

  const toggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileNavOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  return (
    <div className="min-h-svh bg-[#F4F7FB] dark:bg-background text-foreground">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        open={mobileNavOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className={cn("min-h-svh transition-all duration-300 ease-in-out", sidebarCollapsed ? "lg:pl-[70px]" : "lg:pl-[248px]")}>
        <TopBar
          onOpenSearch={() => setSearchOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleSidebar={toggleSidebar}
          isSidebarCollapsed={sidebarCollapsed}
        />
        <main className="mx-auto max-w-[1600px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
          <PageHeading
            activeView={activeView}
            onUploadExcel={activeView === "cashflow" ? () => setUploadExcelOpen(true) : undefined}
            onDownloadExcel={
              activeView === "ranking" ? () => exportCsv("bank-ranking.csv", workspace.banks.map((b) => ({ Rank: b.rank, Bank: b.name, Rate: b.depositRate }))) :
                activeView === "reports" ? () => exportCsv("deposit-position.csv", workspace.banks.map((b) => ({ Bank: b.name, Balance: b.depositBalance }))) :
                  undefined
            }
            onCreateNew={undefined}
            downloadLabel="Download Excel"
            uploadLabel="Upload Excel"
            createLabel="+ Create New"
          >
            {activeView === "cashflow" ? (
              <button type="button" onClick={syncErp} className="btn-blue">
                <RefreshCw className="size-3.5" />
                <span>Sync History</span>
              </button>
            ) : null}
            {activeView === "reports" ? (
              <Button variant="outline" size="sm" onClick={printPage} className="h-9">
                <Download className="mr-1.5 size-3.5" />
                Print / PDF
              </Button>
            ) : null}
          </PageHeading>

          {activeView === "dashboard" ? <DashboardView workspace={workspace} onNavigate={setActiveView} onRunProposal={recalculateProposal} /> : null}
          {activeView === "cashflow" ? <CashflowView workspace={workspace} onValidate={validateCashflow} onReturn={requestRevision} onCalculate={calculateBalance} onExport={exportCashflows} onNewForm={() => setNewFormOpen(true)} /> : null}
          {activeView === "allocation" ? <AllocationView workspace={workspace} onRecalculate={recalculateProposal} onEdit={setEditingAllocation} onAddPlacement={handleAddPlacement} onCreateVoucher={createVouchers} /> : null}
          {activeView === "ranking" ? <BankRankingView banks={workspace.banks} onEdit={setEditingBank} onConfigureTemplate={setTemplateBank} onExport={() => exportCsv("bank-ranking.csv", workspace.banks.map((bank) => ({ Rank: bank.rank, Bank: bank.name, Rate: bank.depositRate, ServiceRating: bank.serviceRating, CreditRating: bank.creditRating, NPL: bank.npl, NIM: bank.nim, CAR: bank.car, LDR: bank.ldr, MaxAllocationPercent: bank.maxAllocationPercent, Active: String(bank.active) })))} /> : null}
          {activeView === "instructions" ? <InstructionsView instructions={workspace.instructions} canCreate={workspace.allocationState === "Voucher created"} onCreate={createInstructions} onMarkSent={markInstructionSent} onPrint={(item) => setPrintingInstruction(item)} /> : null}
          {activeView === "reports" ? <ReportsView workspace={workspace} onPrint={printPage} onExport={(kind) => kind === "cashflow" ? exportCashflows() : kind === "allocation" ? exportAllocation() : exportCsv("deposit-position.csv", workspace.banks.map((bank) => ({ Bank: bank.name, DepositBalanceIDR: bank.depositBalance, SharePercent: ((bank.depositBalance / Math.max(1, workspace.parameters.existingDeposits)) * 100).toFixed(1), Rate: bank.depositRate, Rank: bank.rank })))} /> : null}
          {activeView === "settings" ? <MasterDataView parameters={workspace.parameters} onSaveParameters={saveParameters} onResetDefaults={resetDefaults} /> : null}

          <footer className="mt-8 flex flex-col gap-2 border-t border-border pt-4 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>DEPOSIT DESK · TREASURY MANAGEMENT SYSTEM</span>
            <span>Local prototype session · No actual bank execution is executed automatically</span>
          </footer>
        </main>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} onNavigate={setActiveView} />
      <CashflowFormDialog open={newFormOpen} onOpenChange={setNewFormOpen} onSave={addCashflow} />
      <AllocationEditDialog line={editingAllocation} banks={workspace.banks} open={editingAllocation !== null} onOpenChange={(open) => { if (!open) setEditingAllocation(null); }} onSave={editAllocation} />
      <BankEditDialog bank={editingBank} open={editingBank !== null} onOpenChange={(open) => { if (!open) setEditingBank(null); }} onSave={saveBank} />
      <BankTemplateDialog bank={templateBank} open={templateBank !== null} onOpenChange={(open) => { if (!open) setTemplateBank(null); }} onSave={saveBankTemplate} />
      <InstructionLetterDialog instruction={printingInstruction} open={printingInstruction !== null} onOpenChange={(open) => { if (!open) setPrintingInstruction(null); }} />
      <UploadExcelDialog open={uploadExcelOpen} onOpenChange={setUploadExcelOpen} onImport={handleImportCashflow} />
    </div>
  );
}
