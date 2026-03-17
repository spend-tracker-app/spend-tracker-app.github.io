import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Link2,
  Moon,
  Plus,
  ReceiptText,
  Sun,
  Tags,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PieChart } from "@mui/x-charts/PieChart";
import "./App.css";

const EditTransactionModal = lazy(() => import("./components/EditTransactionModal.jsx"));
const AddTransactionModal = lazy(() => import("./components/AddTransactionModal.jsx"));
const AddAccountModal = lazy(() => import("./components/AddAccountModal.jsx"));
const EditAccountModal = lazy(() => import("./components/EditAccountModal.jsx"));
const CHART_COLORS = ["#5b8cff", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6"];
const CHART_COLORS_LIGHT = ["#3659f6", "#6d43d8", "#178a47", "#c27a07", "#c43232", "#0b8f82"];

function formatCurrency(value, currency = "SGD") {
  const amount = Number(value || 0);
  return `${currency} ${amount.toFixed(2)}`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString();
}

function getCategoryLabel(transaction) {
  return transaction.mcc_description?.trim() || transaction.category?.trim() || "Uncategorized";
}

function normalizeCategoryName(category) {
  return String(category || "").trim() || "Uncategorized";
}

function toLocalDateTimeInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeBackendUrl(url) {
  if (!url) return "";
  return String(url).trim().replace(/\/$/, "");
}

function decodeBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return atob(padded);
}

function parseStartParam(startParam) {
  if (!startParam) return "";

  const raw = String(startParam).trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    return normalizeBackendUrl(raw);
  }

  if (raw.startsWith("backend_url=")) {
    return normalizeBackendUrl(decodeURIComponent(raw.slice("backend_url=".length)));
  }

  if (raw.startsWith("b64:")) {
    try {
      return normalizeBackendUrl(decodeBase64Url(raw.slice(4)));
    } catch {
      return "";
    }
  }

  return "";
}

function resolveBootstrapBackendUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const directParam =
    searchParams.get("backend_url") ||
    searchParams.get("backendUrl") ||
    searchParams.get("url") ||
    "";

  if (directParam) {
    return normalizeBackendUrl(decodeURIComponent(directParam));
  }

  const telegramWebApp = window.Telegram?.WebApp;
  if (telegramWebApp) {
    telegramWebApp.ready?.();
    const tgStartParam =
      telegramWebApp.initDataUnsafe?.start_param ||
      searchParams.get("tgWebAppStartParam") ||
      "";

    const parsed = parseStartParam(tgStartParam);
    if (parsed) return parsed;
  }

  return normalizeBackendUrl(localStorage.getItem("tx_backend_url") || "");
}

function App() {
  const [backendUrlInput, setBackendUrlInput] = useState(
    localStorage.getItem("tx_backend_url") || "http://localhost:4000"
  );
  const [backendUrl, setBackendUrl] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("tx_theme") || "dark");

  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [overviewSummary, setOverviewSummary] = useState({
    totalSpending: 0,
    transactionCount: 0,
    averageTransaction: 0,
  });
  const [overviewCategories, setOverviewCategories] = useState([]);
  const [overviewTimeseries, setOverviewTimeseries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountsOverview, setAccountsOverview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [accountId, setAccountId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [chartGranularity, setChartGranularity] = useState("month");
  const [editForm, setEditForm] = useState({
    merchant: "",
    amount: "",
    currency: "SGD",
    category: "",
    mcc_code: "",
    transaction_timestamp: "",
  });
  const [saving, setSaving] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mccOptions, setMccOptions] = useState([]);
  const [showMccOptions, setShowMccOptions] = useState(false);
  const [addForm, setAddForm] = useState({
    account_id: "",
    merchant: "",
    amount: "",
    currency: "SGD",
    category: "",
    mcc_code: "",
    transaction_timestamp: toLocalDateTimeInput(new Date()),
  });
  const [addAccountForm, setAddAccountForm] = useState({
    bank: "",
    identifier: "",
  });
  const [editAccountForm, setEditAccountForm] = useState({
    nickname: "",
  });
  const infiniteSentinelRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tx_theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchAccounts = async (baseUrl = backendUrl) => {
    if (!baseUrl) return false;

    try {
      const response = await fetch(`${baseUrl}/api/accounts`);
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      setAccounts(Array.isArray(data) ? data : []);
      return true;
    } catch {
      return false;
    }
  };

  const fetchOverview = async (baseUrl = backendUrl) => {
    if (!baseUrl) return false;

    try {
      const response = await fetch(`${baseUrl}/api/overview`);
      if (!response.ok) throw new Error("unavailable");

      const data = await response.json();
      setOverviewSummary({
        totalSpending: Number(data.total_spending || 0),
        transactionCount: Number(data.transaction_count || 0),
        averageTransaction: Number(data.average_transaction || 0),
      });
      setOverviewCategories(Array.isArray(data.categories) ? data.categories : []);
      return true;
    } catch {
      return false;
    }
  };

  const fetchAccountsOverview = async (baseUrl = backendUrl) => {
    if (!baseUrl) return false;

    try {
      const response = await fetch(`${baseUrl}/api/accounts/overview`);
      if (!response.ok) throw new Error("unavailable");

      const data = await response.json();
      setAccountsOverview(Array.isArray(data) ? data : []);
      return true;
    } catch {
      return false;
    }
  };

  const fetchOverviewTimeseries = async (baseUrl = backendUrl, granularity = chartGranularity) => {
    if (!baseUrl) return false;

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const params = new URLSearchParams({ granularity, timezone });
      const response = await fetch(`${baseUrl}/api/overview/timeseries?${params.toString()}`);
      if (!response.ok) throw new Error("unavailable");

      const data = await response.json();
      setOverviewTimeseries(Array.isArray(data) ? data : []);
      return true;
    } catch {
      return false;
    }
  };

  const fetchFilteredTransactions = async (
    baseUrl = backendUrl,
    options = { page: 1, append: false }
  ) => {
    if (!baseUrl) return false;

    const requestedPage = Math.max(1, Number(options.page || 1));
    const append = Boolean(options.append) && requestedPage > 1;
    const offset = (requestedPage - 1) * pageSize;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (query.trim()) params.set("search", query.trim());
      if (accountId) params.set("accountId", accountId);

      const response = await fetch(`${baseUrl}/api/transactions?${params.toString()}`);
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();

      const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
      const nextTotalItems = Array.isArray(data)
        ? items.length
        : Math.max(0, Number(data.total_items || 0));
      const nextTotalPages = Array.isArray(data)
        ? Math.max(1, Math.ceil(items.length / pageSize))
        : Math.max(1, Number(data.total_pages || 1));

      setFilteredTransactions((prev) => {
        if (!append) return items;

        const merged = [...prev, ...items];
        const seen = new Set();

        return merged.filter((item) => {
          const key = String(item?.id ?? "");
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      setTotalItems(nextTotalItems);
      setTotalPages(nextTotalPages);
      return true;
    } catch {
      return false;
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  const onConnect = async () => {
    const normalized = backendUrlInput.trim().replace(/\/$/, "");
    if (!normalized) {
      setIsConnected(false);
      setBackendUrl("");
      setAccounts([]);
      setAccountsOverview([]);
      setFilteredTransactions([]);
      setTotalItems(0);
      setTotalPages(1);
      setOverviewSummary({ totalSpending: 0, transactionCount: 0, averageTransaction: 0 });
      setOverviewCategories([]);
      setOverviewTimeseries([]);
      setCurrentPage(1);
      return;
    }

    setBackendUrl(normalized);
    localStorage.setItem("tx_backend_url", normalized);
    setCurrentPage(1);

    const [accountsOk, transactionsOk, overviewOk, timeseriesOk, accountsOverviewOk] = await Promise.all([
      fetchAccounts(normalized),
      fetchFilteredTransactions(normalized, { page: 1, append: false }),
      fetchOverview(normalized),
      fetchOverviewTimeseries(normalized, chartGranularity),
      fetchAccountsOverview(normalized),
    ]);

    const ok = accountsOk || transactionsOk || overviewOk || timeseriesOk || accountsOverviewOk;
    setIsConnected(ok);

    if (!ok) {
      setAccounts([]);
      setAccountsOverview([]);
      setFilteredTransactions([]);
      setTotalItems(0);
      setTotalPages(1);
      setOverviewSummary({ totalSpending: 0, transactionCount: 0, averageTransaction: 0 });
      setOverviewCategories([]);
      setOverviewTimeseries([]);
      setCurrentPage(1);
    }
  };

  useEffect(() => {
    const normalized = resolveBootstrapBackendUrl();
    if (!normalized) return;

    setBackendUrlInput(normalized);
    setBackendUrl(normalized);
    localStorage.setItem("tx_backend_url", normalized);
    setCurrentPage(1);

    Promise.all([
      fetchAccounts(normalized),
      fetchFilteredTransactions(normalized, { page: 1, append: false }),
      fetchOverview(normalized),
      fetchOverviewTimeseries(normalized, chartGranularity),
      fetchAccountsOverview(normalized),
    ]).then(([accountsOk, transactionsOk, overviewOk, timeseriesOk, accountsOverviewOk]) => {
      const ok = accountsOk || transactionsOk || overviewOk || timeseriesOk || accountsOverviewOk;
      setIsConnected(ok);

      if (!ok) {
        setAccounts([]);
        setAccountsOverview([]);
        setFilteredTransactions([]);
        setTotalItems(0);
        setTotalPages(1);
        setOverviewSummary({ totalSpending: 0, transactionCount: 0, averageTransaction: 0 });
        setOverviewCategories([]);
        setOverviewTimeseries([]);
        setCurrentPage(1);
      }
    }
    );
  }, []);

  useEffect(() => {
    if (!isConnected || !backendUrl) return;
    fetchOverviewTimeseries(backendUrl, chartGranularity);
  }, [chartGranularity, isConnected, backendUrl]);

  useEffect(() => {
    if (!isConnected || !backendUrl) return;

    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchFilteredTransactions(backendUrl, { page: 1, append: false });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [query, accountId, pageSize, isConnected, backendUrl]);

  useEffect(() => {
    if (!isConnected || !backendUrl || activeTab !== "transactions") return;

    const timeoutId = setTimeout(() => {
      fetchFilteredTransactions(backendUrl, {
        page: currentPage,
        append: isMobile && currentPage > 1,
      });
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [currentPage, isConnected, backendUrl, activeTab, isMobile]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const mccQuery = selectedTransaction ? editForm.mcc_code : isAddModalOpen ? addForm.mcc_code : "";

      if (!isConnected || !backendUrl || !mccQuery?.trim()) {
        setMccOptions([]);
        return;
      }

      fetch(`${backendUrl}/api/mcc?q=${encodeURIComponent(mccQuery)}&limit=1000`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setMccOptions(Array.isArray(data) ? data : []))
        .catch(() => setMccOptions([]));
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [backendUrl, editForm.mcc_code, addForm.mcc_code, isAddModalOpen, selectedTransaction, isConnected]);

  const openEditModal = (transaction) => {
    setSelectedTransaction(transaction);
    setEditForm({
      merchant: transaction.merchant || "",
      amount: String(transaction.amount),
      currency: transaction.currency || "SGD",
      category: transaction.category || "",
      mcc_code: transaction.mcc_code || "",
      transaction_timestamp: toLocalDateTimeInput(transaction.transaction_timestamp),
    });
  };

  const openEditAccountModal = (account) => {
    setSelectedAccount(account);
    setEditAccountForm({
      nickname: account.nickname || "",
    });
  };

  const closeEditModal = () => {
    setSelectedTransaction(null);
    setShowMccOptions(false);
  };

  const closeEditAccountModal = () => {
    setSelectedAccount(null);
  };

  const openAddModal = () => {
    setAddForm({
      account_id: accounts[0]?.id ? String(accounts[0].id) : "",
      merchant: "",
      amount: "",
      currency: "SGD",
      category: "",
      mcc_code: "",
      transaction_timestamp: toLocalDateTimeInput(new Date()),
    });
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  const openAddAccountModal = () => {
    setAddAccountForm({ bank: "", identifier: "" });
    setIsAddAccountModalOpen(true);
  };

  const closeAddAccountModal = () => {
    setIsAddAccountModalOpen(false);
  };

  const onSave = async (event) => {
    event.preventDefault();
    if (!selectedTransaction || !backendUrl || !isConnected) return;

    setSaving(true);

    try {
      const response = await fetch(`${backendUrl}/api/transactions/${selectedTransaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: editForm.merchant,
          amount: Number(editForm.amount),
          currency: editForm.currency,
          category: editForm.category,
          mcc_code: editForm.mcc_code,
          transaction_timestamp: new Date(editForm.transaction_timestamp).toISOString(),
        }),
      });

      if (!response.ok) throw new Error("unavailable");

      closeEditModal();
      setCurrentPage(1);
      await fetchFilteredTransactions(backendUrl, { page: 1, append: false });
      await fetchOverview();
    } catch {
      setIsConnected(true);
    } finally {
      setSaving(false);
    }
  };

  const onSaveAccount = async (event) => {
    event.preventDefault();
    if (!selectedAccount || !backendUrl || !isConnected) return;

    setSavingAccount(true);

    try {
      // TODO: update this API to accept more than just card alias
      const response = await fetch(`${backendUrl}/api/accounts/${selectedAccount.id}/card-alias`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_alias: editAccountForm.nickname,
        })
      });

      if (!response.ok) throw new Error("unavailable");

      closeEditAccountModal();
      await fetchOverview();
      await fetchAccountsOverview(backendUrl);
    } catch {
      setIsConnected(true);
    } finally {
      setSavingAccount(false);
    }
  };

  const onAdd = async (event) => {
    event.preventDefault();
    if (!backendUrl || !isConnected) return;

    setAdding(true);

    try {
      const response = await fetch(`${backendUrl}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: Number(addForm.account_id),
          merchant: addForm.merchant,
          amount: Number(addForm.amount),
          currency: addForm.currency,
          category: addForm.category,
          mcc_code: addForm.mcc_code,
          transaction_timestamp: new Date(addForm.transaction_timestamp).toISOString(),
        }),
      });

      if (!response.ok) throw new Error("unavailable");

      closeAddModal();
      setCurrentPage(1);
      await fetchFilteredTransactions(backendUrl, { page: 1, append: false });
      await fetchOverview(backendUrl);
      await fetchOverviewTimeseries(backendUrl, chartGranularity);
    } catch {
      setIsConnected(true);
    } finally {
      setAdding(false);
    }
  };

  const onAddAccount = async (event) => {
    event.preventDefault();
    if (!backendUrl || !isConnected) return;

    setAddingAccount(true);

    try {
      const response = await fetch(`${backendUrl}/api/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank: addAccountForm.bank,
          identifier: addAccountForm.identifier,
        }),
      });

      if (!response.ok) throw new Error("unavailable");

      closeAddAccountModal();
      await fetchAccounts(backendUrl);
      await fetchAccountsOverview(backendUrl);
    } catch {
      setIsConnected(true);
    } finally {
      setAddingAccount(false);
    }
  };

  const onTabClick = (tabName) => {
    setActiveTab(tabName);

    if (!isConnected || !backendUrl) return;

    if (tabName === "overview") {
      fetchOverview(backendUrl);
      fetchAccounts(backendUrl);
      fetchAccountsOverview(backendUrl);
      return;
    }

    if (tabName === "transactions") {
      if (isMobile && currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
      fetchFilteredTransactions(backendUrl, { page: currentPage, append: false });
      return;
    }

    fetchOverviewTimeseries(backendUrl, chartGranularity);
  };

  const totalSpending = overviewSummary.totalSpending;
  const avgSpending = overviewSummary.averageTransaction;
  const categoryStats = useMemo(() => {
    const grouped = new Map();

    for (const item of overviewCategories) {
      const category = normalizeCategoryName(item.category);
      const existing = grouped.get(category) || { category, amount: 0, percent: 0 };

      existing.amount += Number(item.amount || 0);
      existing.percent += Number(item.percent || 0);
      grouped.set(category, existing);
    }

    return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
  }, [overviewCategories]);

  const topCategory = categoryStats[0];

  const chartPalette = theme === "dark" ? CHART_COLORS : CHART_COLORS_LIGHT;
  const pieChartData = useMemo(
    () =>
      categoryStats.map((item, index) => ({
        id: `${item.category}-${index}`,
        label: item.category,
        value: Math.max(0, Number(item.amount || 0)),
        color: chartPalette[index % chartPalette.length],
      })),
    [categoryStats, chartPalette]
  );

  const pieTotal = useMemo(
    () => pieChartData.reduce((sum, item) => sum + item.value, 0),
    [pieChartData]
  );
  const centerLabelColor = theme === "dark" ? "#f6f8ff" : "#101b39";

  const accountLabelById = useMemo(() => {
    const labels = new Map();
    for (const account of accounts) {
      labels.set(account.id, `${account.bank}${account.identifier ? ` (${account.identifier})` : ""}`);
    }
    return labels;
  }, [accounts]);

  const spendingOverTime = overviewTimeseries;

  const maxPeriodSpending = useMemo(
    () => spendingOverTime.reduce((max, item) => Math.max(max, item.total), 0),
    [spendingOverTime]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!isMobile || activeTab !== "transactions") return;
    const sentinel = infiniteSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry.isIntersecting) return;

        setCurrentPage((prev) => {
          if (loading || loadingMore || prev >= totalPages) return prev;
          return prev + 1;
        });
      },
      { rootMargin: "120px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isMobile, activeTab, loading, loadingMore, totalPages]);

  return (
    <div className="tracker-shell">
      <header className="tracker-header">
        <div className="header-row">
          <div>
            <p className="screen-title">Transactions</p>
            <h1>Transaction Tracker</h1>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <section className="connect-strip">
        <input
          value={backendUrlInput}
          onChange={(event) => setBackendUrlInput(event.target.value)}
          placeholder="https://your-backend-host"
        />
        <button onClick={onConnect}>
          <Link2 size={15} className="ui-icon" /> Connect
        </button>
      </section>

      {!isConnected ? (
        <section className="query-strip">
          <p className="empty">Not connected. Enter backend URL and click Connect.</p>
        </section>
      ) : (
        <>
          <nav className="top-tabs">
            <button
              className={activeTab === "overview" ? "active" : ""}
              onClick={() => onTabClick("overview")}
            >
              <Wallet size={15} className="ui-icon" /> Overview
            </button>
            <button
              className={activeTab === "transactions" ? "active" : ""}
              onClick={() => onTabClick("transactions")}
            >
              <ReceiptText size={15} className="ui-icon" /> Transactions
            </button>
            <button
              className={activeTab === "charts" ? "active" : ""}
              onClick={() => onTabClick("charts")}
            >
              <BarChart3 size={15} className="ui-icon" /> Charts
            </button>
          </nav>

          {activeTab === "overview" ? (
            <main className="overview-panel">
              <section className="stats-grid">
                <article className="stat-card">
                  <p className="label">
                    <Wallet size={14} className="ui-icon" /> Total Spending
                  </p>
                  <h3>{formatCurrency(totalSpending)}</h3>
                  <p className="sub">{overviewSummary.transactionCount} transactions</p>
                </article>

                <article className="stat-card">
                  <p className="label">
                    <TrendingUp size={14} className="ui-icon" /> Average Transaction
                  </p>
                  <h3>{formatCurrency(avgSpending)}</h3>
                  <p className="sub">Per transaction</p>
                </article>

                <article className="stat-card">
                  <p className="label">
                    <Tags size={14} className="ui-icon" /> Top Category
                  </p>
                  <h3>{topCategory?.category || "-"}</h3>
                  <p className="sub">{topCategory ? formatCurrency(topCategory.amount) : "No data"}</p>
                </article>
              </section>

              <section className="chart-card">
                <h2>Spending by Category</h2>
                <div className="chart-body chart-interaction">
                  <div style={{ width: "100%", height: 340, position: "relative" }}>
                    <PieChart
                      height={340}
                      margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                      series={[
                        {
                          data: pieChartData,
                          innerRadius: 82,
                          outerRadius: 132,
                          paddingAngle: 1,
                          cornerRadius: 3,
                          cx: "50%",
                          cy: "50%",
                          valueFormatter: (item) => formatCurrency(item.value),
                          highlightScope: { faded: "global", highlighted: "item" },
                          faded: {
                            innerRadius: 82,
                            additionalRadius: -4,
                            color: theme === "dark" ? "#303a61" : "#d4def9",
                          },
                        },
                      ]}
                      slotProps={{
                        legend: { hidden: true },
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        pointerEvents: "none",
                        color: centerLabelColor,
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(pieTotal)}
                    </div>
                  </div>
                </div>
              </section>

              <section className="category-list-card">
                <h2>Categories</h2>
                {categoryStats.map((item, index) => (
                  <article key={`${item.category}-${index}`} className="category-row">
                    <div>
                      <p>{normalizeCategoryName(item.category)}</p>
                      <small>{formatCurrency(item.amount)}</small>
                    </div>
                    <div>
                      <span className="dot" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                      <strong>{item.percent.toFixed(1)}%</strong>
                    </div>
                  </article>
                ))}
                {!categoryStats.length && <p className="empty">No transactions available.</p>}
              </section>

              <section className="category-list-card">
                <h2>Accounts</h2>
                <section className="query-strip">
                  <button onClick={openAddAccountModal}>
                    <Plus size={15} className="ui-icon" /> Add account
                  </button>
                  <button onClick={() => fetchAccountsOverview(backendUrl)}>Refresh</button>
                </section>

                <section className="accounts-list">
                  {accountsOverview.map((account) => (
                    <article key={account.id} className="account-card">
                      <div>
                        <p className="merchant">{account.card_alias ? account.card_alias : account.bank}</p>
                        <p className="meta">
                          {account.card_alias ? account.bank : ''}
                          {' '}
                          {account.identifier || "No identifier"}
                        </p>
                      </div>                  <div className="tx-right">
                        <p className="amount">{formatCurrency(account.total_spending)}</p>
                        <p className="meta">{account.transaction_count} transactions</p>
                        <p className="meta">Avg {formatCurrency(account.average_transaction)}</p>
                        <button onClick={() => openEditAccountModal(account)}>Edit</button>
                      </div>
                    </article>
                  ))}
                  {!accountsOverview.length && <p className="empty">No accounts available.</p>}
                </section>
              </section>

              <footer className="app-footer">Powered by Transaction Manager • Data synced via API</footer>
            </main>
          ) : activeTab === "transactions" ? (
            <main className="transactions-panel">
              <section className="query-strip">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search merchant, MCC description, MCC"
                />
                <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                  <option value="">All accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={String(account.id)}>
                      {account.bank}
                      {account.identifier ? ` (${account.identifier})` : ""}
                    </option>
                  ))}
                </select>
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <button onClick={openAddModal} disabled={!accounts.length}>
                  <Plus size={15} className="ui-icon" /> Add
                </button>
                <button onClick={() => fetchFilteredTransactions(backendUrl, { page: currentPage, append: false })}>Refresh</button>
              </section>

              {loading ? (
                <p className="loading">Loading transactions...</p>
              ) : (
                <>
                  <section className="tx-list">
                    {filteredTransactions.map((transaction) => (
                      <article key={transaction.id} className="tx-card">
                        <div>
                          <p className="merchant">{transaction.merchant || "Unknown merchant"}</p>
                          <p className="meta">{formatDate(transaction.transaction_timestamp)}</p>
                          <p className="meta">{accountLabelById.get(transaction.account_id) || "-"}</p>
                        </div>
                        <div className="tx-right">
                          <p className="amount">{formatCurrency(transaction.amount, transaction.currency)}</p>
                          <p className="meta">
                            {transaction.mcc_code?.trim()
                              ? `${getCategoryLabel(transaction)} • ${transaction.mcc_code}`
                              : "Uncategorized"}
                          </p>
                          <button onClick={() => openEditModal(transaction)}>Edit</button>
                        </div>
                      </article>
                    ))}
                    {!filteredTransactions.length && <p className="empty">No transactions found.</p>}
                  </section>

                  {!isMobile && totalItems > 0 && (
                    <section className="pagination-strip">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </button>
                      <span>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </button>
                    </section>
                  )}

                  {isMobile && totalItems > 0 && (
                    <section className="pagination-strip">
                      <span>
                        Showing {filteredTransactions.length} of {totalItems}
                      </span>
                    </section>
                  )}

                  {isMobile && currentPage < totalPages && (
                    <div className="infinite-sentinel" ref={infiniteSentinelRef}>
                      {loadingMore ? "Loading more..." : "Scroll to load more"}
                    </div>
                  )}
                </>
              )}
            </main>
          ) : (
            <main className="charts-panel">
              <section className="chart-filter-card">
                <h2>Spending Over Time</h2>
                <div className="granularity-tabs">
                  <button
                    className={chartGranularity === "day" ? "active" : ""}
                    onClick={() => setChartGranularity("day")}
                  >
                    Per day
                  </button>
                  <button
                    className={chartGranularity === "month" ? "active" : ""}
                    onClick={() => setChartGranularity("month")}
                  >
                    Per month
                  </button>
                  <button
                    className={chartGranularity === "year" ? "active" : ""}
                    onClick={() => setChartGranularity("year")}
                  >
                    Per year
                  </button>
                </div>
              </section>

              <section className="time-chart-card">
                {spendingOverTime.length ? (
                  <div className="bars-list">
                    {spendingOverTime.map((item) => (
                      <article className="bar-row" key={item.periodKey}>
                        <div className="bar-labels">
                          <p>{item.period_label || item.label || item.period_key}</p>
                          <strong>{formatCurrency(item.total)}</strong>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${maxPeriodSpending > 0 ? (item.total / maxPeriodSpending) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty">No spending data to chart.</p>
                )}
              </section>
            </main>
          )}
        </>
      )}

      <Suspense fallback={null}>
        <AddTransactionModal
          isOpen={isAddModalOpen}
          closeAddModal={closeAddModal}
          onAdd={onAdd}
          addForm={addForm}
          setAddForm={setAddForm}
          showMccOptions={showMccOptions}
          setShowMccOptions={setShowMccOptions}
          mccOptions={mccOptions}
          accounts={accounts}
          adding={adding}
        />
        <AddAccountModal
          isOpen={isAddAccountModalOpen}
          closeAddAccountModal={closeAddAccountModal}
          onAddAccount={onAddAccount}
          addAccountForm={addAccountForm}
          setAddAccountForm={setAddAccountForm}
          addingAccount={addingAccount}
        />
        <EditTransactionModal
          selectedTransaction={selectedTransaction}
          closeEditModal={closeEditModal}
          onSave={onSave}
          editForm={editForm}
          setEditForm={setEditForm}
          showMccOptions={showMccOptions}
          setShowMccOptions={setShowMccOptions}
          mccOptions={mccOptions}
          saving={saving}
        />
        <EditAccountModal
          selectedAccount={selectedAccount}
          closeEditAccountModal={closeEditAccountModal}
          onSaveAccount={onSaveAccount}
          editAccountForm={editAccountForm}
          setEditAccountForm={setEditAccountForm}
          savingAccount={savingAccount}
        />
      </Suspense>
    </div>
  );
}

export default App;
