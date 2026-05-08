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
  name: string;
  amount: number;
  date: string;
  note?: string;
}

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
    const saved = localStorage.getItem('wealthflow_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [investmentRate, setInvestmentRate] = useState(40); // 30% - 50%
  const [growthRate, setGrowthRate] = useState(17.5); // 15% - 20%
  const [activeTab, setActiveTab] = useState<'dashboard' | 'income' | 'expense' | 'simulator' | 'analysis'>('dashboard');
  
  // Persistence
  useEffect(() => {
    localStorage.setItem('wealthflow_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'INCOME' as TransactionType,
    note: ''
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
      end: endOfMonth(lastDate)
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
      const key = format(parseISO(t.date), 'MMM yyyy');
      if (months[key]) {
        if (t.type === 'INCOME') months[key].income += t.amount;
        else months[key].expense += t.amount;
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

  const totalBalance = useMemo(() => {
    return transactions.reduce((acc, t) => {
      return t.type === 'INCOME' ? acc + t.amount : acc - t.amount;
    }, 0);
  }, [transactions]);

  // Simulation Logic
  const simulationData = useMemo(() => {
    const recentNetFlows = monthlyData.slice(-6).map(m => Math.max(0, m.net));
    const avgMonthlyInvest = recentNetFlows.length > 0 
      ? (recentNetFlows.reduce((a, b) => a + b, 0) / recentNetFlows.length) * (investmentRate / 100)
      : 0;
    
    const calculateValue = (years: number) => {
      const monthlyRate = growthRate / 100 / 12;
      const months = years * 12;
      if (monthlyRate === 0) return avgMonthlyInvest * months;
      return avgMonthlyInvest * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    };

    const points = [];
    for (let i = 0; i <= 30; i++) {
        points.push({
            year: i,
            value: calculateValue(i),
            investment: avgMonthlyInvest * i * 12
        });
    }

    return {
      points,
      avgMonthlyInvest,
      allocationPerStock: avgMonthlyInvest / 5,
      m10: calculateValue(10),
      m20: calculateValue(20),
      m30: calculateValue(30)
    };
  }, [monthlyData, investmentRate, growthRate]);

  // Handlers
  const handleSubmit = (type: TransactionType) => (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      name: formData.name,
      amount: parseFloat(formData.amount),
      date: formData.date,
      type: type,
      note: formData.note
    };

    setTransactions([newTransaction, ...transactions]);
    setFormData({
      ...formData,
      name: '',
      amount: '',
      note: ''
    });
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const incomeTransactions = transactions.filter(t => t.type === 'INCOME');
  const expenseTransactions = transactions.filter(t => t.type === 'EXPENSE');

  return (
    <div className="h-screen bg-cream flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <nav className="h-16 border-b border-border-subtle flex items-center justify-between px-8 bg-primary text-cream z-30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cream flex items-center justify-center font-bold text-primary rounded-sm">W</div>
          <span className="text-xl font-bold tracking-tighter uppercase whitespace-nowrap">WealthFlow &copy;</span>
        </div>
        
        <div className="hidden md:flex gap-6 lg:gap-10 text-[11px] font-bold uppercase tracking-widest">
          <button onClick={() => setActiveTab('dashboard')} className={cn("hover:text-white transition-colors whitespace-nowrap py-2", activeTab === 'dashboard' ? "text-white border-b-2 border-white" : "text-cream/60")}>Dashboard</button>
          <button onClick={() => setActiveTab('income')} className={cn("hover:text-white transition-colors whitespace-nowrap py-2", activeTab === 'income' ? "text-white border-b-2 border-white" : "text-cream/60")}>Income Management</button>
          <button onClick={() => setActiveTab('expense')} className={cn("hover:text-white transition-colors whitespace-nowrap py-2", activeTab === 'expense' ? "text-white border-b-2 border-white" : "text-cream/60")}>Expense Management</button>
          <button onClick={() => setActiveTab('simulator')} className={cn("hover:text-white transition-colors whitespace-nowrap py-2", activeTab === 'simulator' ? "text-white border-b-2 border-white" : "text-cream/60")}>Investment Simulation</button>
          <button onClick={() => setActiveTab('analysis')} className={cn("hover:text-white transition-colors whitespace-nowrap py-2", activeTab === 'analysis' ? "text-white border-b-2 border-white" : "text-cream/60")}>Deeply Analysis</button>
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
                        <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
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
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Bar name="Income" dataKey="income" fill="#74070E" radius={[2, 2, 0, 0]} barSize={24} />
                          <Bar name="Expense" dataKey="expense" fill="rgba(116, 7, 14, 0.2)" radius={[2, 2, 0, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <Card title="Monthly Statistics View" className="col-span-1 md:col-span-2">
                    <div className="overflow-x-auto relative max-h-[250px]">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-border-subtle uppercase tracking-widest text-[10px] opacity-60 font-bold">
                            <th className="py-3 px-2">Month</th>
                            <th className="py-3 px-2">Income</th>
                            <th className="py-3 px-2">Expense</th>
                            <th className="py-3 px-2 text-right">Net Cash Flow</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/20">
                          {monthlyData.slice().reverse().map((m) => (
                            <tr key={m.month} className="hover:bg-primary/5 transition-colors">
                              <td className="py-3 px-2 font-bold italic">{m.month}</td>
                            <td className="py-3 px-2 opacity-80">{m.income.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</td>
                            <td className="py-3 px-2 opacity-80">{m.expense.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</td>
                            <td className="py-3 px-2 font-bold text-right italic underline underline-offset-4 decoration-primary/20">{m.net.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                          type="text" required placeholder={activeTab === 'income' ? "Salary, Investment, etc." : "Rent, Grocery, etc."} value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-white/60 border border-border-subtle rounded px-4 py-3 text-sm italic focus:border-primary/60 outline-none transition-all"
                        />
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
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 ml-1 italic">Notes (Ghi chú)</label>
                        <textarea 
                          rows={2} placeholder="..." value={formData.note}
                          onChange={e => setFormData({...formData, note: e.target.value})}
                          className="w-full bg-white/60 border border-border-subtle rounded px-4 py-3 text-sm italic focus:border-primary/60 outline-none transition-all resize-none"
                        />
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
                              <h4 className="text-sm font-bold tracking-tight">{t.name}</h4>
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
                          <label className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Investment %</label>
                          <span className="text-sm font-bold">{investmentRate}%</span>
                        </div>
                        <input type="range" min="30" max="50" value={investmentRate} onChange={e => setInvestmentRate(parseInt(e.target.value))} className="w-full accent-primary h-1 bg-primary/10 rounded-full appearance-none outline-none" />
                        <p className="text-[9px] mt-2 opacity-50 font-bold uppercase tracking-tighter">Budget split for assets</p>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-2">
                          <label className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Expected CAGR</label>
                          <span className="text-sm font-bold">{growthRate}%</span>
                        </div>
                        <input type="range" min="15" max="20" step="0.5" value={growthRate} onChange={e => setGrowthRate(parseFloat(e.target.value))} className="w-full accent-primary h-1 bg-primary/10 rounded-full appearance-none outline-none" />
                        <p className="text-[9px] mt-2 opacity-50 font-bold uppercase tracking-tighter">Market growth potential</p>
                      </div>

                      <div className="p-5 border border-border-subtle bg-primary/5 rounded-lg shadow-inner">
                        <h4 className="text-[10px] font-bold uppercase opacity-60 mb-2">Monthly Installment</h4>
                        <div className="text-3xl font-bold tracking-tighter text-primary">{simulationData.avgMonthlyInvest.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</div>
                        <p className="text-[9px] opacity-40 italic mt-2 font-bold leading-tight">Average of recent net cash flows after investment split applied.</p>
                      </div>
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

                   <Card title="Simulated Portfolio Allocation (Top 5 Equities)">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {STOCK_TICKERS.map(stock => (
                          <div key={stock.symbol} className="border border-border-subtle p-5 rounded-lg bg-white/40 hover:bg-white/60 transition-all hover:scale-[1.02] text-center group cursor-default">
                            <div className="text-sm font-bold tracking-tighter text-primary mb-1 underline underline-offset-2">{stock.symbol}</div>
                            <div className="text-[9px] opacity-50 uppercase font-bold tracking-widest mb-4 truncate">{stock.name}</div>
                            <div className="text-xl font-bold tracking-tight text-emerald-900">{simulationData.allocationPerStock.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫</div>
                            <div className="text-[8px] uppercase font-bold opacity-30 tracking-widest mt-1">Monthly Lot</div>
                          </div>
                        ))}
                      </div>
                   </Card>

                   <div className="bg-white/20 rounded-xl p-8 border border-border-subtle flex flex-col min-h-[400px] shadow-sm relative">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest opacity-60 mb-8 italic">Trajectory of Compounded Asset Value</h3>
                      <div className="flex-1 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={simulationData.points} margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(116, 7, 14, 0.05)" />
                            <XAxis dataKey="year" stroke="rgba(116, 7, 14, 0.4)" fontSize={10} tickLine={false} axisLine={false} unit="y" />
                            <YAxis 
                                stroke="rgba(116, 7, 14, 0.4)" fontSize={10} tickLine={false} axisLine={false} 
                                tickFormatter={(val) => formatCurrency(val)} 
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#F4E3B2', border: '1px solid rgba(116, 7, 14, 0.2)', borderRadius: '2px', fontSize: '11px' }}
                                labelFormatter={(label) => `Year ${label}`}
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Area 
                                name="Projected Value"
                                type="monotone" dataKey="value" stroke="#74070E" strokeWidth={2}
                                fill="#74070E" fillOpacity={0.05} 
                            />
                            <Area 
                                name="Principal Basis"
                                type="monotone" dataKey="investment" stroke="rgba(16, 185, 129, 0.3)" strokeWidth={1}
                                strokeDasharray="5 5" fill="transparent" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-8 mt-6 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                          <span className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Total Projected Capital</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 border border-emerald-400 border-dashed rounded-full" />
                          <span className="text-[10px] font-bold uppercase opacity-60 tracking-widest">Principal Basis</span>
                        </div>
                      </div>
                   </div>
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
                    <h1 className="text-4xl font-bold tracking-tighter text-primary">Deeply Analysis</h1>
                    <p className="text-xs uppercase tracking-widest opacity-60 font-medium italic mt-1">Advanced Statistical Financial Modelling</p>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-7">
                    <Card title="Structural Cash Flow Analysis" className="h-full">
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(116, 7, 14, 0.05)" />
                                    <XAxis dataKey="month" stroke="rgba(116, 7, 14, 0.4)" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis 
                                        stroke="rgba(116, 7, 14, 0.4)" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                        tickFormatter={(val) => formatCurrency(val)}
                                    />
                                    <Tooltip contentStyle={{ backgroundColor: '#F4E3B2', border: '1px solid rgba(116, 7, 14, 0.2)', fontSize: '12px' }} />
                                    <Legend />
                                    <Area type="monotone" name="Income Delta" dataKey="income" stroke="#10B981" fill="#10B981" fillOpacity={0.05} />
                                    <Area type="monotone" name="Expense Load" dataKey="expense" stroke="#74070E" fill="#74070E" fillOpacity={0.05} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                <div className="col-span-12 lg:col-span-5 space-y-8">
                    <Card title="Allocation Quality Metrics">
                         <div className="space-y-6 pt-4">
                            <div className="p-5 border border-primary/10 rounded-lg bg-white/20">
                                <span className="text-[10px] font-bold uppercase opacity-40 tracking-widest mb-2 block">Savings Ratio</span>
                                <div className="text-2xl font-bold italic">
                                    {currentMonthSummary.income > 0 ? ((currentMonthSummary.net / currentMonthSummary.income) * 100).toFixed(1) : '0.0'}%
                                </div>
                                <div className="text-[9px] uppercase font-bold mt-1 text-primary/40 italic">Efficiency Score</div>
                            </div>
                            <div className="p-5 border border-primary/10 rounded-lg bg-primary text-cream shadow-md">
                                <span className="text-[10px] font-bold uppercase opacity-60 tracking-widest mb-2 block">Investment Utility</span>
                                <div className="text-2xl font-bold">
                                    {(currentMonthSummary.net * (investmentRate / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })} ₫ / month
                                </div>
                                <div className="text-[9px] uppercase font-bold mt-1 opacity-60 italic">Current Capital Engine</div>
                            </div>
                         </div>
                    </Card>

                    <div className="p-6 border-l-4 border-primary bg-white/40 rounded shadow-sm italic">
                        <p className="text-xs text-primary/80 leading-relaxed font-medium">
                            "System indicates that maintaining a net flow of <span className="font-bold underline decoration-primary/20">{monthlyData.length > 0 ? (monthlyData.reduce((a, b) => a + b.net, 0) / monthlyData.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'} ₫</span> is the critical base for your 30-year simulation targets. Fluctuations below this threshold will exponentially delay milestone achievement."
                        </p>
                        <div className="mt-2 text-[9px] font-bold uppercase tracking-widest opacity-40">&mdash; Financial Advisory Model Alpha</div>
                    </div>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-primary/20 py-20 italic">
      <History size={40} strokeWidth={1} className="mb-2 opacity-50" />
      <p className="text-xs uppercase tracking-widest font-bold">{message}</p>
    </div>
  );
}
