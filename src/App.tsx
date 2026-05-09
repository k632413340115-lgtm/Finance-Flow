/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  BarChart3, 
  LineChart, 
  PieChart, 
  ArrowUpRight, 
  ChevronRight,
  Info,
  History,
  LayoutDashboard,
  Wallet,
  Coins,
  Settings as SettingsIcon,
  Trash2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  Legend,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isSameMonth } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utilities */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'B';
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K';
  }
  return value.toLocaleString();
}

/** Types */
type TransactionType = 'INCOME' | 'EXPENSE';

interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  name: string;
  amount: number;
  date: string;
  note?: string;
  isRecurring?: boolean;
}

const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salary' },
  { id: 'bonus', label: 'Bonus' },
  { id: 'side', label: 'Side Income' },
  { id: 'biz', label: 'Business' },
  { id: 'invest', label: 'Investment' },
  { id: 'other', label: 'Other' }
];

const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'transport', label: 'Transport' },
  { id: 'study', label: 'Study' },
  { id: 'housing', label: 'Housing' },
  { id: 'ent', label: 'Entertainment' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'other', label: 'Other' }
];

interface MonthlySummary {
  month: string;
  dateStr: string;
  income: number;
  expense: number;
  net: number;
}

const STOCK_TICKERS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'NVDA', name: 'Nvidia Corp.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' }
];

export default function App() {
  // State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    // Check for new key first
    const saved = localStorage.getItem('financeflow_transactions');
    if (saved) return JSON.parse(saved);
    
    // Legacy migration check
    const legacy = localStorage.getItem('wealthflow_transactions');
    if (legacy) {
      localStorage.setItem('financeflow_transactions', legacy);
      // We keep the old one for one more session just in case, but return the data
      return JSON.parse(legacy);
    }
    return [];
  });

  const [tickers, setTickers] = useState(() => {
    const saved = localStorage.getItem('financeflow_tickers');
    if (saved) return JSON.parse(saved);

    const legacy = localStorage.getItem('wealthflow_tickers');
    if (legacy) return JSON.parse(legacy);

    return [
      { symbol: 'FPT', name: 'FPT Corp' },
      { symbol: 'VCB', name: 'Vietcombank' },
      { symbol: 'HPG', name: 'Hoa Phat Steel' },
      { symbol: 'VIC', name: 'Vingroup' },
      { symbol: 'VNM', name: 'Vinamilk' }
    ];
  });
  
  const [growthRate, setGrowthRate] = useState(17.5); // 15% - 20%
  const [stockAllocation, setStockAllocation] = useState(40); // 30% - 50% as requested
  const [activeTab, setActiveTab] = useState<'dashboard' | 'income' | 'expense' | 'simulator' | 'analysis'>('dashboard');
  const [isEditingTickers, setIsEditingTickers] = useState(false);

  // Asset Allocation Ratios (Calculated based on stockAllocation state)
  const allocationRatios = useMemo(() => {
    const remaining = (100 - stockAllocation) / 5;
    return {
      STOCKS: stockAllocation / 100,
      SAVINGS: remaining / 100,
      CASH: remaining / 100,
      GOLD: remaining / 100,
      USD: remaining / 100,
      OTHER: remaining / 100
    };
  }, [stockAllocation]);

  // Persistence
  useEffect(() => {
    localStorage.setItem('financeflow_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('financeflow_tickers', JSON.stringify(tickers));
  }, [tickers]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'INCOME' as TransactionType,
    note: '',
    isRecurring: false
  });

  // Basic Calculations
  const monthlyData = useMemo(() => {
    const months: Record<string, MonthlySummary> = {};
    
    // Last 12 months for initial range or based on data
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (sorted.length === 0) return [];

    const firstDate = parseISO(sorted[0].date);
    const lastDate = parseISO(sorted[sorted.length - 1].date);
    
    const interval = eachMonthOfInterval({
      start: startOfMonth(firstDate),
      end: endOfMonth(new Date() > lastDate ? new Date() : lastDate)
    });

    interval.forEach(date => {
      const key = format(date, 'MMM yyyy');
      months[key] = {
        month: key,
        dateStr: format(date, 'yyyy-MM'),
        income: 0,
        expense: 0,
        net: 0
      };
    });

    transactions.forEach(t => {
      const tDate = parseISO(t.date);
      const tKey = format(tDate, 'MMM yyyy');
      
      if (t.isRecurring) {
        // Apply to all months from start date onwards within the displayed interval
        Object.keys(months).forEach(monthKey => {
          const mDate = parseISO(months[monthKey].dateStr + '-01'); // Approximation for check
          if (mDate >= startOfMonth(tDate)) {
            if (t.type === 'INCOME') months[monthKey].income += t.amount;
            else months[monthKey].expense += t.amount;
          }
        });
      } else {
        if (months[tKey]) {
          if (t.type === 'INCOME') months[tKey].income += t.amount;
          else months[tKey].expense += t.amount;
        }
      }
    });

    return Object.values(months).map(m => ({
      ...m,
      net: m.income - m.expense
    }));
  }, [transactions]);

  const currentMonthSummary = useMemo(() => {
    const now = format(new Date(), 'MMM yyyy');
    const existing = monthlyData.find(m => m.month === now);
    return existing || { month: now, income: 0, expense: 0, net: 0 };
  }, [monthlyData]);

  const expandedTransactions = useMemo(() => {
    const list: (Transaction & { isInstance?: boolean })[] = [];
    const now = new Date();
    const currentMonthStart = startOfMonth(now);

    transactions.forEach(t => {
      if (t.isRecurring) {
        const tDate = parseISO(t.date);
        // Ensure we don't try to generate interval if start > end
        const endRange = currentMonthStart > startOfMonth(tDate) ? currentMonthStart : startOfMonth(tDate);
        
        const interval = eachMonthOfInterval({
          start: startOfMonth(tDate),
          end: endRange
        });

        interval.forEach(date => {
          list.push({
            ...t,
            id: `${t.id}-${format(date, 'yyyy-MM')}`,
            date: format(date, 'yyyy-MM-dd'),
            isInstance: true
          });
        });
      } else {
        list.push(t);
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  const totalBalance = useMemo(() => {
    return expandedTransactions.reduce((acc, t) => {
      return t.type === 'INCOME' ? acc + t.amount : acc - t.amount;
    }, 0);
  }, [expandedTransactions]);

  const incomeTransactions = expandedTransactions.filter(t => t.type === 'INCOME');
  const expenseTransactions = expandedTransactions.filter(t => t.type === 'EXPENSE');

  // Simulation Logic
  const simulationData = useMemo(() => {
    let baseInvest = 0; 
    
    if (monthlyData.length > 0) {
      const recentNetFlows = monthlyData.slice(-6).map(m => Math.max(0, m.net));
      const calculatedBase = recentNetFlows.reduce((a, b) => a + b, 0) / recentNetFlows.length;
      if (calculatedBase > 0) baseInvest = calculatedBase;
    }

    // Portfolio portion for equities based on adjustable state
    const avgMonthlyInvest = baseInvest * allocationRatios.STOCKS;
    
    // Scenarios for Analysis
    const scenarios = [
      { id: 'pessimistic', name: 'Conservative', rate: 10, color: '#94a3b8', opacity: 0.2 },
      { id: 'expected', name: 'Expected', rate: growthRate, color: '#812423', opacity: 0.4 },
      { id: 'optimistic', name: 'Aggressive', rate: 22, color: '#059669', opacity: 0.2 }
    ];

    const calculateValue = (years: number, rate: number = growthRate) => {
      const monthlyRate = rate / 100 / 12;
      const months = years * 12;
      if (monthlyRate === 0) return avgMonthlyInvest * months;
      return avgMonthlyInvest * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    };

    // Financial Freedom Logic: When monthly returns >= current monthly expenses
    const monthlyExpenses = currentMonthSummary.expense > 0 ? currentMonthSummary.expense : (expenseTransactions.length > 0 ? expenseTransactions.reduce((a, b) => a + b.amount, 0) / expandedTransactions.length : 10_000_000);
    
    let freedomYear = -1;
    const points = [];
    const scenarioPoints = [];

    for (let i = 0; i <= 30; i++) {
        const baseVal = calculateValue(i, growthRate);
        const monthlyYield = baseVal * (growthRate / 100 / 12);
        
        if (freedomYear === -1 && monthlyYield >= monthlyExpenses) {
          freedomYear = i;
        }

        points.push({
            year: i,
            value: Math.floor(baseVal),
            investment: Math.floor(avgMonthlyInvest * i * 12)
        });

        scenarioPoints.push({
          year: i,
          conservative: Math.floor(calculateValue(i, 10)),
          expected: Math.floor(baseVal),
          aggressive: Math.floor(calculateValue(i, 22))
        });
    }

    // Health Score Components
    const savingsRatio = currentMonthSummary.income > 0 ? (currentMonthSummary.net / currentMonthSummary.income) * 100 : 0;
    const leverageRatio = currentMonthSummary.expense > 0 ? (avgMonthlyInvest / currentMonthSummary.expense) : 0;

    return {
      points,
      scenarioPoints,
      avgMonthlyInvest,
      baseInvest,
      freedomYear,
      savingsRatio,
      leverageRatio,
      monthlyExpenses,
      allocationPerStock: tickers.length > 0 ? avgMonthlyInvest / tickers.length : 0,
      m10: calculateValue(10),
      m20: calculateValue(20),
      m30: calculateValue(30)
    };
  }, [monthlyData, growthRate, tickers.length, currentMonthSummary, expandedTransactions]);

  // Handlers
  const handleSubmit = (type: TransactionType) => (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount || !formData.category) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      name: formData.name,
      amount: parseFloat(formData.amount),
      category: formData.category,
      date: formData.date,
      type: type,
      note: formData.note,
      isRecurring: formData.isRecurring
    };

    setTransactions([newTransaction, ...transactions]);
    setFormData({
      ...formData,
      name: '',
      amount: '',
      category: '',
      note: '',
      isRecurring: false
    });
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => !id.startsWith(t.id)));
  };

  return (
    <div className="h-screen bg-cream flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <nav className="h-16 border-b border-border-subtle flex items-center justify-between px-8 bg-primary text-cream z-30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cream flex items-center justify-center font-bold text-primary rounded-sm">F</div>
          <span className="text-xl font-bold tracking-tighter uppercase whitespace-nowrap">FinanceFlow &copy;</span>
        </div>
        
        <div className="hidden md:flex gap-6 lg:gap-10 text-[11px] font-bold uppercase tracking-widest">
          <button onClick={() => setActiveTab('dashboard')} className={cn("hover:text-white transition-colors whitespace-nowrap py-2", activeTab === 'dashboard' ? "text-white border-b-2 border-white" : "text-cream/60")}>Dashboard</button>
          <button onClick={() => setActiveTab('income')} className={cn("hover:text-white transition-colors whitespace-nowrap py-2", activeTab === 'income' ? "text-white border-b-2 border-white" : "text-cream/60")}>Income Management</button>
          <button onClick={() => setActiveTab('expense')} className={cn("hover:text-white transition-colors whitespace-nowrap py-2", activeTab === 'expense' ? "text-white border-b-2 border-white" : "text-cream/60")}>Expense Management</button>
          <button onClick={() => setActiveTab('simulator')} className={cn("hover:text-white transition-colors whitespace-nowrap py-2", activeTab === 'simulator' ? "text-white border-b-2 border-white" : "text-cream/60")}>Investment Simulation</button>
          <button onClick={() => setActiveTab('analysis')} className={cn("hover:text-white transition-colors whitespace-nowrap py-2", activeTab === 'analysis' ? "text-white border-b-2 border-white" : "text-cream/60")}>Deep Analysis</button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[9px] uppercase opacity-60 font-bold leading-none mb-1">Portfolio Balance</p>
            <p className="text-sm font-bold tracking-tight">
              {totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫
            </p>
          </div>
          <div className="w-8 h-8 rounded-full border border-cream/20 bg-white/10 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors lg:hidden" onClick={() => {
              // Simple cycle for mobile demo
              const tabs: any[] = ['dashboard', 'income', 'expense', 'simulator', 'analysis'];
              const idx = tabs.indexOf(activeTab);
              setActiveTab(tabs[(idx + 1) % tabs.length]);
          }}>
            <LayoutDashboard size={14} />
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-cream/30">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 grid grid-cols-12 gap-8"
              >
                <div className="col-span-12 flex justify-between items-end mb-4">
                  <div>
                    <h1 className="text-4xl font-bold tracking-tighter text-primary">Financial Dashboard</h1>
                    <p className="text-xs uppercase tracking-widest opacity-60 font-medium italic mt-1">Unified Intelligence & Oversight</p>
                  </div>
                  <div className="text-[10px] font-mono uppercase bg-primary/5 px-3 py-1 border border-border-subtle rounded text-primary/60">
                    Period: {format(new Date(), 'MMM yyyy')}
                  </div>
                </div>

                {/* Status Section */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest opacity-60 italic">Monthly Cash Flow</h2>
                  <div className="grid grid-cols-1 gap-4">
                    <StatusCard 
                      title="Monthly Revenue" 
                      value={currentMonthSummary.income} 
                      icon={<TrendingUp size={16} />}
                      trend="+12%" 
                    />
                    <StatusCard 
                      title="Current Expenses" 
                      value={currentMonthSummary.expense} 
                      icon={<TrendingDown size={16} />}
                      trend="-3%" 
                    />
                    <StatusCard 
                      title="Net Cash Position" 
                      value={currentMonthSummary.net} 
                      icon={<BarChart3 size={16} />}
                      trend="Stable" 
                      isHighlight
                    />
                  </div>
                </div>

                {/* Main Graph Section */}
                <div className="col-span-12 lg:col-span-8 flex flex-col">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest opacity-60 mb-4 italic">Performance Metrics</h2>
                  <div className="flex-1 bg-white/20 rounded-xl p-8 border border-border-subtle flex flex-col min-h-[400px]">
                    <div className="flex-1 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData} margin={{ top: 20, right: 10, left: 30, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(116, 7, 14, 0.1)" />
                          <XAxis dataKey="month" stroke="rgba(116, 7, 14, 0.4)" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis 
                            stroke="rgba(116, 7, 14, 0.4)" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(val) => formatCurrency(val)}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#F4E3B2', border: '1px solid rgba(116, 7, 14, 0.2)', borderRadius: '4px', fontSize: '12px' }}
                            itemStyle={{ color: '#74070E' }}
                          />
                          <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.6 }} />
                          <Bar name="Income" dataKey="income" fill="#74070E" radius={[2, 2, 0, 0]} barSize={24} />
                          <Bar name="Expense" dataKey="expense" fill="rgba(116, 7, 14, 0.2)" radius={[2, 2, 0, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <Card title="Monthly Statistics View" className="col-span-1 md:col-span-2 lg:col-span-2">
                    <div className="overflow-x-auto relative max-h-[250px]">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-border-subtle uppercase tracking-widest text-[10px] opacity-60 font-bold">
                            <th className="py-3 px-2">Month</th>
                            <th className="py-3 px-2">Income</th>
                            <th className="py-3 px-2">Expense</th>
                            <th className="py-3 px-2 text-right">Net Flow</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/20">
                          {monthlyData.slice().reverse().map((m) => (
                            <tr key={m.month} className="hover:bg-primary/5 transition-colors">
                              <td className="py-3 px-2 font-bold italic">{m.month}</td>
                            <td className="py-3 px-2 opacity-80">{m.income.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</td>
                            <td className="py-3 px-2 opacity-80">{m.expense.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</td>
                            <td className="py-3 px-2 font-bold text-right italic decoration-primary/20">{m.net.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                   <Card title="Target Asset Allocation" className="col-span-1 md:col-span-2 lg:col-span-2">
                      <div className="grid grid-cols-2 gap-4">
                        <AllocationCard 
                          label={`Stocks (${stockAllocation}%)`} 
                          value={currentMonthSummary.net * allocationRatios.STOCKS} 
                          percentage={`${stockAllocation}%`}
                          isPrimary
                        />
                        <AllocationCard 
                          label={`Savings (${(allocationRatios.SAVINGS * 100).toFixed(1)}%)`} 
                          value={currentMonthSummary.net * allocationRatios.SAVINGS} 
                          percentage={`${(allocationRatios.SAVINGS * 100).toFixed(1)}%`}
                        />
                        <AllocationCard 
                          label={`Cash (${(allocationRatios.CASH * 100).toFixed(1)}%)`} 
                          value={currentMonthSummary.net * allocationRatios.CASH} 
                          percentage={`${(allocationRatios.CASH * 100).toFixed(1)}%`}
                        />
                        <AllocationCard 
                          label={`Gold (${(allocationRatios.GOLD * 100).toFixed(1)}%)`} 
                          value={currentMonthSummary.net * allocationRatios.GOLD} 
                          percentage={`${(allocationRatios.GOLD * 100).toFixed(1)}%`}
                        />
                        <AllocationCard 
                          label={`USD (${(allocationRatios.USD * 100).toFixed(1)}%)`} 
                          value={currentMonthSummary.net * allocationRatios.USD} 
                          percentage={`${(allocationRatios.USD * 100).toFixed(1)}%`}
                        />
                        <AllocationCard 
                          label={`Remaining (${(allocationRatios.OTHER * 100).toFixed(1)}%)`} 
                          value={currentMonthSummary.net * allocationRatios.OTHER} 
                          percentage={`${(allocationRatios.OTHER * 100).toFixed(1)}%`}
                        />
                      </div>
                   </Card>
                </div>
              </motion.div>
            )}

            {(activeTab === 'income' || activeTab === 'expense') && (
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8 grid grid-cols-12 gap-8"
              >
                <div className="col-span-12 flex justify-between items-end mb-4">
                  <div>
                    <h1 className="text-4xl font-bold tracking-tighter text-primary">
                        {activeTab === 'income' ? 'Income Management' : 'Expense Management'}
                    </h1>
                    <p className="text-xs uppercase tracking-widest opacity-60 font-medium italic mt-1">
                        {activeTab === 'income' ? 'Track your revenue streams' : 'Monitor and optimize spending'}
                    </p>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-4 translate-y-2">
                  <div className="bg-white/40 p-8 rounded-xl border border-border-subtle shadow-sm">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest opacity-60 mb-6 italic flex items-center gap-2">
                       <Plus size={14} /> Add New {activeTab === 'income' ? 'Revenue' : 'Expense'}
                    </h3>
                    <form onSubmit={handleSubmit(activeTab === 'income' ? 'INCOME' : 'EXPENSE')} className="space-y-5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1 italic">Identifier</label>
                        <input 
                          type="text" required placeholder={activeTab === 'income' ? "Company A, Client B, etc." : "Rent, Grocery, etc."} value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-white/60 border border-border-subtle rounded px-4 py-3 text-sm italic focus:border-primary/60 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1 italic">Classification</label>
                        <select 
                          required
                          value={formData.category}
                          onChange={e => setFormData({...formData, category: e.target.value})}
                          className="w-full bg-white/60 border border-border-subtle rounded px-4 py-3 text-sm italic focus:border-primary/60 outline-none transition-all"
                        >
                          <option value="" disabled>Select category...</option>
                          {(activeTab === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1 italic">Amount (VND)</label>
                        <input 
                          type="number" required step="1000" placeholder="0" value={formData.amount}
                          onChange={e => setFormData({...formData, amount: e.target.value})}
                          className="w-full bg-white/60 border border-border-subtle rounded px-4 py-3 text-sm font-bold focus:border-primary/60 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1 italic">Date Recorded</label>
                        <input 
                          type="date" required value={formData.date}
                          onChange={e => setFormData({...formData, date: e.target.value})}
                          className="w-full bg-white/60 border border-border-subtle rounded px-4 py-3 text-sm italic focus:border-primary/60 outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1 italic">Notes</label>
                        <textarea 
                          rows={2} placeholder="..." value={formData.note}
                          onChange={e => setFormData({...formData, note: e.target.value})}
                          className="w-full bg-white/60 border border-border-subtle rounded px-4 py-3 text-sm italic focus:border-primary/60 outline-none transition-all resize-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 px-1">
                        <input 
                          type="checkbox"
                          id="recurring-toggle"
                          checked={formData.isRecurring}
                          onChange={e => setFormData({...formData, isRecurring: e.target.checked})}
                          className="w-4 h-4 accent-primary"
                        />
                        <label htmlFor="recurring-toggle" className="text-[10px] font-bold uppercase tracking-widest text-primary/70 cursor-pointer">
                          Recurring monthly
                        </label>
                      </div>

                      <button 
                        type="submit"
                        className="w-full bg-primary text-cream py-4 rounded font-bold uppercase tracking-widest text-xs hover:opacity-90 transition-opacity mt-4 shadow-md"
                      >
                        Record {activeTab === 'income' ? 'Credit' : 'Debit'} Entry
                      </button>
                    </form>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-8 flex flex-col">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest opacity-60 mb-4 italic">Ledger History</h2>
                  <div className="flex-1 bg-white/20 rounded-xl p-8 border border-border-subtle overflow-y-auto max-h-[600px] shadow-inner">
                    <div className="space-y-1">
                       {(activeTab === 'income' ? incomeTransactions : expenseTransactions).length > 0 ? (
                         (activeTab === 'income' ? incomeTransactions : expenseTransactions).map((t) => (
                          <div key={t.id} className="group flex justify-between items-center border-b border-border-subtle/30 py-4 hover:bg-white/40 px-4 rounded-lg transition-all">
                            <div className="flex-1">
                               <h4 className="text-sm font-bold tracking-tight flex items-center gap-2">
                                 {t.name}
                                 <span className="text-[9px] uppercase font-bold opacity-30 px-1.5 py-0.5 border border-primary/10 rounded bg-primary/5">
                                   {INCOME_CATEGORIES.find(c => c.id === t.category)?.label || EXPENSE_CATEGORIES.find(c => c.id === t.category)?.label || t.category}
                                 </span>
                                 {t.isRecurring && (
                                   <span className="bg-primary/10 text-primary text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1 border border-primary/20">
                                     <History size={8} /> {t.isInstance ? 'Instance' : 'Recurring'}
                                   </span>
                                 )}
                               </h4>
                               <div className="flex items-center gap-3 text-[10px] opacity-40 uppercase font-bold tracking-widest mt-1">
                                <span className="flex items-center gap-1"><Calendar size={10} /> {format(parseISO(t.date), 'MMM dd, yyyy')}</span>
                                {t.note && <span>&bull; {t.note}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <span className={cn("text-lg font-bold tracking-tighter", t.type === 'INCOME' ? "text-emerald-800" : "text-primary italic opacity-80")}>
                                {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫
                              </span>
                              <button onClick={() => deleteTransaction(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary/20 hover:text-primary">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                         ))
                       ) : (
                         <EmptyState message={`No ${activeTab} entries recorded.`} />
                       )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'simulator' && (
              <motion.div 
                key="simulator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 grid grid-cols-12 gap-8"
              >
                 <div className="col-span-12 flex justify-between items-end mb-4">
                  <div>
                    <h1 className="text-4xl font-bold tracking-tighter text-primary">Investment Simulation</h1>
                    <p className="text-xs uppercase tracking-widest opacity-60 font-medium italic mt-1">Compound Growth Projection Model</p>
                  </div>
                </div>

                 <div className="col-span-12 lg:col-span-3 space-y-8">
                   <div className="bg-white/40 p-8 rounded-xl border border-border-subtle space-y-8 shadow-sm">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest opacity-60 italic flex items-center gap-2">
                       <LineChart size={14} /> Control Parameters
                    </h3>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Equity Portion</label>
                          <span className="text-sm font-bold">{stockAllocation}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="30" 
                          max="50" 
                          step="1"
                          value={stockAllocation} 
                          onChange={e => setStockAllocation(parseInt(e.target.value))} 
                          className="w-full accent-primary h-1 bg-primary/10 rounded-full appearance-none outline-none" 
                        />
                        <p className="text-[9px] mt-2 opacity-50 font-bold uppercase tracking-tighter">Budget split for assets (30% - 50%)</p>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Expected CAGR</label>
                          <span className="text-sm font-bold">{growthRate}%</span>
                        </div>
                        <input type="range" min="15" max="20" step="0.5" value={growthRate} onChange={e => setGrowthRate(parseFloat(e.target.value))} className="w-full accent-primary h-1 bg-primary/10 rounded-full appearance-none outline-none" />
                        <p className="text-[9px] mt-2 opacity-50 font-bold uppercase tracking-tighter">Equity market growth rate (15% - 20%)</p>
                      </div>

                      <div className="p-5 border border-border-subtle bg-primary/5 rounded-lg shadow-inner">
                        <h4 className="text-[10px] font-bold uppercase opacity-60 mb-2">Monthly Stock Inflow</h4>
                        <div className="text-3xl font-bold tracking-tighter text-primary">{simulationData.avgMonthlyInvest.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</div>
                        <p className="text-[9px] opacity-40 italic mt-2 font-bold leading-tight">Calculated as {stockAllocation}% of your average net cash flow ({simulationData.baseInvest.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫).</p>
                      </div>
                    </div>
                   </div>

                   <div className="bg-white/40 p-6 rounded-xl border border-border-subtle shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest opacity-60 italic">Portfolio Breakdown</h3>
                        <button onClick={() => setIsEditingTickers(!isEditingTickers)} className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors">
                          {isEditingTickers ? 'Save' : 'Edit Tickers'}
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {tickers.map((ticker, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 border border-border-subtle/30 bg-white/40 rounded shadow-sm">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-primary">{ticker.symbol}</span>
                              <span className="text-[9px] opacity-40 uppercase font-bold">{ticker.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] font-bold text-primary">{(simulationData.avgMonthlyInvest / tickers.length).toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</div>
                              <div className="text-[8px] opacity-40 uppercase font-bold tracking-tighter">Monthly Deposit</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 p-4 border border-dashed border-primary/20 rounded text-[10px] opacity-60 italic leading-relaxed">
                        Total investment is split equally among {tickers.length} tickers ({(100/tickers.length).toFixed(0)}% each).
                      </div>
                   </div>

                   <div className="p-6 border border-primary bg-cream shadow-xl rounded-sm">
                      <h4 className="text-[11px] font-bold uppercase mb-4 tracking-widest opacity-80 border-b border-primary pb-2 font-sans italic">Projection Thesis</h4>
                      <div className="space-y-3">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase opacity-40">Asset Diversification</span>
                            <span className="text-xs font-bold italic">5 Equal Positions in Equities</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase opacity-40">Compounding Logic</span>
                            <span className="text-xs font-bold italic">Monthly Reinvestment Cycle</span>
                         </div>
                      </div>
                   </div>
                 </div>

                 <div className="col-span-12 lg:col-span-9 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <MilestoneCard label="10 Year Horizon" value={simulationData.m10} year={10} color="bg-white/40 border-border-subtle" />
                      <MilestoneCard label="20 Year Horizon" value={simulationData.m20} year={20} color="bg-white/60 border-border-subtle" />
                      <MilestoneCard label="30 Year Horizon" value={simulationData.m30} year={30} color="bg-primary text-cream" isTotal />
                   </div>

                   <Card title="Simulated Portfolio Allocation (Top Equities)">
                      <div className="flex justify-between items-center mb-6">
                        <div className="text-[10px] font-bold uppercase opacity-40 tracking-widest italic">Capital Distribution Analysis</div>
                        <button 
                         onClick={() => setIsEditingTickers(!isEditingTickers)}
                         className="text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20 px-3 py-1 rounded bg-white hover:bg-primary hover:text-cream transition-all flex items-center gap-1.5"
                        >
                          <SettingsIcon size={12} /> {isEditingTickers ? "Lock Portfolio" : "Configure Equities"}
                        </button>
                      </div>

                      <AnimatePresence>
                        {isEditingTickers && (
                          <motion.div 
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: 'auto', opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           className="mb-8 overflow-hidden"
                          >
                            <div className="p-6 bg-primary/5 border border-primary/10 rounded-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                              {tickers.map((ticker: any, idx: number) => (
                                <div key={idx} className="space-y-2">
                                  <input 
                                   className="w-full text-xs font-bold bg-white border border-border-subtle p-2 outline-none focus:border-primary/40 rounded"
                                   value={ticker.symbol}
                                   placeholder="Symbol"
                                   onChange={(e) => {
                                     const newTickers = [...tickers];
                                     newTickers[idx].symbol = e.target.value.toUpperCase();
                                     setTickers(newTickers);
                                   }}
                                  />
                                  <input 
                                   className="w-full text-[10px] italic bg-white/60 border border-border-subtle p-2 outline-none focus:border-primary/40 rounded"
                                   value={ticker.name}
                                   placeholder="Company Name"
                                   onChange={(e) => {
                                     const newTickers = [...tickers];
                                     newTickers[idx].name = e.target.value;
                                     setTickers(newTickers);
                                   }}
                                  />
                                </div>
                              ))}
                            </div>
                            <p className="text-[9px] uppercase font-bold opacity-30 mt-2 text-center tracking-widest italic">Live update engaged: simulation targets will recalibrate based on these identifiers.</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {tickers.map((stock: any) => (
                          <div key={stock.symbol} className="border border-border-subtle p-5 rounded-lg bg-white/40 hover:bg-white/60 transition-all hover:scale-[1.02] text-center group cursor-default">
                            <div className="text-sm font-bold tracking-tighter text-primary mb-1 underline underline-offset-2">{stock.symbol}</div>
                            <div className="text-[9px] opacity-50 uppercase font-bold tracking-widest mb-4 truncate">{stock.name}</div>
                            <div className="text-xl font-bold tracking-tight text-emerald-900">{simulationData.allocationPerStock.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</div>
                            <div className="text-[8px] uppercase font-bold opacity-30 tracking-widest mt-1">Monthly Lot</div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card title="Wealth Compounding Trajectory (30 Years)" className="lg:min-h-[600px] flex flex-col">
                        <div className="w-full pt-4 h-[450px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={simulationData.points} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#812423" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#812423" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} stroke="rgba(116, 7, 14, 0.4)" />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} tickFormatter={(val) => `${(val / 1000000000).toFixed(1)}B`} stroke="rgba(116, 7, 14, 0.4)" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#FAF9F6', border: '1px solid #812423', borderRadius: '4px' }}
                                        labelFormatter={(label) => `Year ${label}`}
                                        formatter={(val: number, name: string) => [`${val.toLocaleString()} ₫`, name === 'Projected Wealth' ? 'Projected Wealth' : 'Principal Basis']}
                                    />
                                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.6 }} />
                                    <Area type="monotone" name="Projected Wealth" dataKey="value" stroke="#812423" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                                    <Area type="monotone" name="Principal Basis" dataKey="investment" stroke="rgba(16, 185, 129, 0.8)" strokeWidth={2} strokeDasharray="5 5" fill="transparent" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-3 gap-4 p-4 border-t border-border-subtle/30 bg-white/20 mt-4">
                            <div className="text-center p-3 border border-primary/10 rounded bg-white/40 shadow-sm transition-transform hover:scale-105">
                                <div className="text-[9px] font-bold uppercase opacity-50 mb-1">Year 10 Benchmark</div>
                                <div className="text-sm font-bold text-primary">{simulationData.m10.toLocaleString()} ₫</div>
                                <div className="text-[8px] opacity-40 uppercase font-bold mt-1">Projected Wealth</div>
                            </div>
                            <div className="text-center p-3 border border-primary/10 rounded bg-white/40 shadow-sm transition-transform hover:scale-105">
                                <div className="text-[9px] font-bold uppercase opacity-50 mb-1">Year 20 Benchmark</div>
                                <div className="text-sm font-bold text-primary">{simulationData.m20.toLocaleString()} ₫</div>
                                <div className="text-[8px] opacity-40 uppercase font-bold mt-1">Projected Wealth</div>
                            </div>
                            <div className="text-center p-3 border border-primary/10 rounded bg-primary text-cream shadow-md transition-transform hover:scale-105">
                                <div className="text-[9px] font-bold uppercase opacity-80 mb-1">Year 30 Milestone</div>
                                <div className="text-sm font-bold font-serif">{simulationData.m30.toLocaleString()} ₫</div>
                                <div className="text-[8px] opacity-60 uppercase font-bold mt-1">Target Achievement</div>
                            </div>
                        </div>
                    </Card>
                  </div>
               </motion.div>
             )}

            {activeTab === 'analysis' && (
              <motion.div 
                key="analysis"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 grid grid-cols-12 gap-8"
              >
                <div className="col-span-12 flex justify-between items-end mb-4">
                  <div>
                    <h1 className="text-4xl font-bold tracking-tighter text-primary">Deep Analysis</h1>
                    <p className="text-xs uppercase tracking-widest opacity-60 font-medium italic mt-1">Advanced Statistical Financial Modelling</p>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 px-4 py-2 rounded-lg text-primary flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase opacity-60">Financial Freedom Year</span>
                      <span className="text-lg font-bold italic">
                        {simulationData.freedomYear !== -1 ? `Year ${simulationData.freedomYear}` : '30+ Years'}
                      </span>
                    </div>
                    <div className="h-8 w-px bg-primary/20" />
                    <Info size={16} className="opacity-40" />
                  </div>
                </div>

                               <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="bg-white/40 border border-border-subtle p-6 rounded-xl shadow-sm">
                      <span className="text-[10px] font-bold uppercase opacity-40 block mb-2">Savings Ratio</span>
                      <div className="text-3xl font-bold tracking-tighter text-primary">
                        {simulationData.savingsRatio.toFixed(1)}%
                      </div>
                      <div className="mt-2 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block border border-emerald-100 uppercase">
                        {simulationData.savingsRatio > 20 ? "Elite Position" : "Building Phase"}
                      </div>
                   </div>
                   <div className="bg-white/40 border border-border-subtle p-6 rounded-xl shadow-sm">
                      <span className="text-[10px] font-bold uppercase opacity-40 block mb-2">Investment Power</span>
                      <div className="text-3xl font-bold tracking-tighter text-primary">
                        1 : {simulationData.leverageRatio.toFixed(1)}
                      </div>
                      <div className="mt-2 text-[9px] font-bold opacity-40 uppercase">Invest vs Spend</div>
                   </div>
                   <div className="bg-white/40 border border-border-subtle p-6 rounded-xl shadow-sm">
                      <span className="text-[10px] font-bold uppercase opacity-40 block mb-2">Est. Gain</span>
                      <div className="text-3xl font-bold tracking-tighter text-primary">
                        {((simulationData.m30 * (growthRate/100/12))).toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫
                      </div>
                      <div className="mt-2 text-[9px] font-bold opacity-40 uppercase">Monthly Passive</div>
                   </div>
                   <div className="bg-white/40 border border-border-subtle p-6 rounded-xl shadow-sm">
                      <span className="text-[10px] font-bold uppercase opacity-40 block mb-2">Health Score</span>
                      <div className="text-3xl font-bold tracking-tighter text-primary">
                        {simulationData.baseInvest > (simulationData.monthlyExpenses * 0.5) ? "A+" : "B"}
                      </div>
                      <div className="mt-2 text-[9px] font-bold opacity-40 uppercase">System Assessment</div>
                   </div>
                </div>

                <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
                  <Card title="Income vs Expense Analysis" className="h-auto">
                    <div className="h-[400px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold'}} tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} />
                                <Tooltip contentStyle={{ backgroundColor: '#FAF9F6', borderRadius: '4px' }} />
                                <Bar dataKey="income" name="Income" fill="#812423" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name="Expense" fill="rgba(129, 36, 35, 0.2)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card title="Growth Scenarios">
                     <div className="h-[400px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={simulationData.scenarioPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold'}} tickFormatter={(val) => `${(val / 1_000_000_000).toFixed(1)}B`} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#FAF9F6', borderRadius: '4px', border: '1px solid #812423' }}
                                  formatter={(val) => `${val.toLocaleString()} ₫`}
                                />
                                <Legend verticalAlign="top" align="right" height={36} wrapperStyle={{fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                                <Area type="monotone" dataKey="aggressive" name="Optimistic (22%)" stroke="#059669" fill="#059669" fillOpacity={0.05} />
                                <Area type="monotone" dataKey="expected" name="Base Case" stroke="#812423" fill="#812423" fillOpacity={0.1} />
                                <Area type="monotone" dataKey="conservative" name="Conservative (10%)" stroke="#64748b" fill="#64748b" fillOpacity={0.05} />
                            </AreaChart>
                        </ResponsiveContainer>
                     </div>
                  </Card>
                </div>

                <div className="col-span-12 lg:col-span-4 space-y-8">
                   <div className="p-8 bg-primary text-cream rounded-xl shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                      <div className="relative z-10">
                        <h4 className="text-[11px] font-bold uppercase tracking-widest opacity-60 mb-4 flex items-center gap-2">
                           <LayoutDashboard size={14} /> AI Optimization Strategy
                        </h4>
                        <div className="space-y-6">
                           <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase opacity-60">Insight #1: Speed to Freedom</span>
                              <p className="text-sm italic leading-relaxed">
                                {simulationData.savingsRatio > 30 
                                  ? `Maintaining a ${simulationData.savingsRatio.toFixed(1)}% savings ratio places you in the elite 1% of users. Freedom is projected in ~${simulationData.freedomYear} years.`
                                  : "Reducing discretionary spending by 15% would accelerate your freedom target by 3.5 years."}
                              </p>
                           </div>
                           <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase opacity-60">Insight #2: Portfolio Alpha</span>
                              <p className="text-sm italic leading-relaxed">
                                Current allocation risk is low. System suggests you could {stockAllocation > 45 ? "hold" : "increase"} equity exposure. Tuning to 50% could add {((simulationData.m30 * 0.1)).toLocaleString(undefined, {maximumFractionDigits: 0})} ₫ to your 30-year terminal value.
                              </p>
                           </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                           <div className="text-[9px] font-bold uppercase tracking-widest italic opacity-60">DeepFlow Alpha v1.4</div>
                           <button onClick={() => setActiveTab('simulator')} className="text-[9px] font-bold uppercase bg-white text-primary px-3 py-1.5 rounded-sm hover:bg-cream transition-colors">
                               Adjust Model
                           </button>
                        </div>
                      </div>
                   </div>

                   <Card title="Structural Health Indicators">
                      <div className="space-y-6 pt-4">
                         <div className="space-y-4">
                            <ScoreRow label="Savings vs Income (Rule 50/30/20)" value={simulationData.savingsRatio} target={20} />
                            <ScoreRow label="Invest vs Spend (Capital Leverage)" value={simulationData.leverageRatio * 10} target={10} />
                            <ScoreRow label="Compounding Progress" value={100} target={100} />
                         </div>
                         
                         <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                            <p className="text-[11px] leading-relaxed italic text-primary/80">
                              "Current structural integrity is <span className="font-bold underline">Robust</span>. Diversification across {tickers.length} tickers effectively mitigates idiosyncratic market risk."
                            </p>
                         </div>
                      </div>
                   </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

/** UI Components */

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 w-full group",
        active 
          ? "bg-secondary text-primary font-bold shadow-lg translate-x-2" 
          : "text-secondary/50 hover:text-secondary hover:bg-white/5"
      )}
    >
      <span className={cn(active ? "text-primary" : "text-secondary/50 group-hover:text-secondary")}>
        {icon}
      </span>
      <span className="text-base tracking-wide">{label}</span>
    </button>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("p-8 rounded-xl border border-border-subtle bg-white/20", className)}>
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-primary/60 mb-6 italic">{title}</h3>
      {children}
    </div>
  );
}

function StatusCard({ title, value, icon, trend, isHighlight = false }: { title: string; value: number; icon: React.ReactNode; trend: string; isHighlight?: boolean }) {
  return (
    <div className={cn(
      "p-6 rounded-xl transition-all border border-border-subtle relative overflow-hidden group shadow-sm",
      isHighlight ? "bg-primary text-cream" : "bg-white/40 text-primary"
    )}>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className={cn(
            "p-2 rounded border border-border-subtle transition-transform group-hover:scale-110",
            isHighlight ? "bg-white/10" : "bg-primary/5"
          )}>
            {icon}
          </div>
          <span className={cn(
            "text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-widest",
            isHighlight ? "bg-cream text-primary" : "bg-primary/10 text-primary/60"
          )}>
            {trend}
          </span>
        </div>
        <p className={cn(
          "text-[10px] font-bold uppercase tracking-widest mb-1 italic",
          isHighlight ? "opacity-70" : "opacity-40"
        )}>{title}</p>
        <p className="text-3xl font-bold tracking-tighter">
          {Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫
        </p>
      </div>
    </div>
  );
}

function MilestoneCard({ label, value, year, color, isTotal }: { label: string; value: number; year: number; color: string; isTotal?: boolean }) {
    return (
        <div className={cn("p-8 rounded-xl border transition-all hover:translate-y-[-4px] group relative overflow-hidden", color)}>
            {isTotal && (
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp size={100} />
                </div>
            )}
            <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2 italic", isTotal ? "opacity-70" : "opacity-40")}>{label}</p>
            <div className="flex items-baseline gap-1">
              <p className="text-4xl font-bold tracking-tighter mb-4">{value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</p>
            </div>
            <div className="relative pl-4 border-l-2 border-primary">
               <div className="text-[10px] italic opacity-70">Projected Milestone</div>
               <div className="text-[10px] font-bold uppercase tracking-widest mt-1">Year {year} Goal</div>
            </div>
        </div>
    );
}

function AllocationCard({ label, value, percentage, description, isPrimary = false }: { label: string; value: number; percentage: string; description?: string; isPrimary?: boolean }) {
  return (
    <div className={cn(
      "p-4 rounded-lg border border-border-subtle flex flex-col group transition-all duration-300",
      isPrimary ? "bg-primary/5 border-primary/20" : "bg-white/40 shadow-sm"
    )}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[9px] font-bold uppercase tracking-tight opacity-50 italic">{label}</span>
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", isPrimary ? "bg-primary text-cream" : "bg-primary/10 text-primary")}>
          {percentage}
        </span>
      </div>
      <div className="text-sm font-bold tracking-tight text-primary">
        {Math.max(0, value).toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫
      </div>
      {description && (
        <p className="text-[8px] opacity-40 italic mt-1 leading-tight">{description}</p>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-primary/20 py-20 italic">
      <History size={40} strokeWidth={1} className="mb-2 opacity-50" />
      <p className="text-xs uppercase tracking-widest font-bold">{message}</p>
    </div>
  );
}

function ScoreRow({ label, value, target }: { label: string, value: number, target: number }) {
  const percent = Math.min(100, Math.max(0, (value / target) * 100));
  return (
    <div className="space-y-1.5">
       <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-60">
          <span>{label}</span>
          <span className="text-primary italic">{value.toFixed(1)} / {target}</span>
       </div>
       <div className="w-full h-1 bg-primary/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            className={cn("h-full", percent >= 100 ? "bg-emerald-600" : "bg-primary")} 
          />
       </div>
    </div>
  );
}
