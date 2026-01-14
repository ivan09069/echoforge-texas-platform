import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// ECHOFORGE TEXAS ENERGY PLATFORM v2.0
// "Drill 1 Well → Bootstrap Crypto → Reinvest Renewables"
// By Ivan Torres / EchoForge Studios
// ═══════════════════════════════════════════════════════════════════════════════

// Contract addresses (Base Sepolia testnet)
const CONTRACTS = {
  PIPE: '0x0000000000000000000000000000000000000000', // Will be updated after deployment
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
};

// PIPE Token ABI (simplified for frontend)
const PIPE_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function stake(uint256 amount, uint256 lockDays) external',
  'function unstake(uint256 amount) external',
  'function claimRewards() external',
  'function pendingRewards(address user) view returns (uint256)',
  'function getStakeInfo(address user) view returns (uint256, uint256, uint256, uint256)',
  'function getStakingStats() view returns (uint256, uint256, uint256, uint256)',
  'function getPipelineStats() view returns (uint256, uint256, uint256, uint256, uint256)',
  'function bookCapacity(uint256 capacityMCF, uint256 durationDays) external returns (uint256)',
  'event Staked(address indexed user, uint256 amount, uint256 lockUntil)',
  'event RewardsClaimed(address indexed user, uint256 amount)',
];

// Base Sepolia chain config
const BASE_SEPOLIA = {
  chainId: '0x14a34', // 84532
  chainName: 'Base Sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia.basescan.org'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// API HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

// Fetch live crypto prices
const useCryptoPrices = () => {
  const [prices, setPrices] = useState({ btc: 97000, eth: 3200, sol: 180 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Using CoinGecko API (free tier)
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true'
        );
        const data = await res.json();
        setPrices({
          btc: data.bitcoin?.usd || 97000,
          eth: data.ethereum?.usd || 3200,
          sol: data.solana?.usd || 180,
          btc_change: data.bitcoin?.usd_24h_change || 0,
          eth_change: data.ethereum?.usd_24h_change || 0,
          sol_change: data.solana?.usd_24h_change || 0,
        });
      } catch (e) {
        console.log('Price fetch error, using defaults');
      }
      setLoading(false);
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  return { prices, loading };
};

// Simulated ERCOT data (real API requires registration)
const useErcotData = () => {
  const [ercot, setErcot] = useState({
    grid_price: 42.50,
    demand_mw: 68420,
    capacity_mw: 85000,
    status: 'NORMAL',
    wind_output: 8240,
    solar_output: 4120,
  });

  useEffect(() => {
    // Simulate real-time ERCOT updates
    const interval = setInterval(() => {
      setErcot(prev => ({
        ...prev,
        grid_price: Math.max(15, Math.min(120, prev.grid_price + (Math.random() - 0.5) * 5)),
        demand_mw: Math.floor(prev.demand_mw + (Math.random() - 0.5) * 1000),
        wind_output: Math.floor(prev.wind_output + (Math.random() - 0.5) * 200),
        solar_output: Math.floor(Math.max(0, prev.solar_output + (Math.random() - 0.5) * 100)),
      }));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return ercot;
};

// Web3 wallet connection
const useWallet = () => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('No wallet detected. Install MetaMask.');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      setProvider(provider);
      setSigner(signer);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
      setError(null);

      // Switch to Base Sepolia if not on it
      if (Number(network.chainId) !== 84532) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_SEPOLIA.chainId }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [BASE_SEPOLIA],
            });
          }
        }
      }
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
  }, []);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) disconnect();
        else setAccount(accounts[0]);
      });
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
  }, [disconnect]);

  return { account, provider, signer, chainId, error, connect, disconnect };
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const StatusBadge = ({ status }) => {
  const colors = {
    active: 'bg-emerald-500 text-black',
    drilling: 'bg-blue-500',
    maintenance: 'bg-amber-500 text-black',
    NORMAL: 'bg-emerald-500 text-black',
    WARNING: 'bg-amber-500 text-black',
    CRITICAL: 'bg-red-500',
    connected: 'bg-emerald-500 text-black',
    disconnected: 'bg-red-500',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${colors[status] || 'bg-gray-500'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-pulse" />
      {status}
    </span>
  );
};

const Card = ({ title, badge, children, className = '' }) => (
  <div className={`bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden ${className}`}>
    {title && (
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.2em] text-white/50">{title}</h3>
        {badge}
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
);

const MetricCard = ({ label, value, sub, trend, color = 'white', live = false }) => {
  const colors = {
    white: 'text-white',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    orange: 'text-orange-400',
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
  };
  return (
    <div className="p-4 bg-black/20 rounded-lg border border-white/5 relative">
      {live && <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />}
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
      {trend !== undefined && (
        <p className={`text-xs mt-2 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(2)}%
        </p>
      )}
    </div>
  );
};

const WalletButton = ({ account, onConnect, onDisconnect }) => {
  if (account) {
    return (
      <div className="flex items-center gap-3">
        <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <p className="text-xs text-emerald-400 font-mono">
            {account.slice(0, 6)}...{account.slice(-4)}
          </p>
        </div>
        <button
          onClick={onDisconnect}
          className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs hover:bg-red-500/20"
        >
          Disconnect
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onConnect}
      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm transition"
    >
      Connect Wallet
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════

const WELLS_DATA = [
  { id: 'PB-001', name: 'Permian Alpha', status: 'active', mcf_day: 2400, btc_mined: 1.247, efficiency: 94, depth: 9850 },
  { id: 'PB-002', name: 'Midland Echo', status: 'active', mcf_day: 1800, btc_mined: 0.891, efficiency: 91, depth: 8720 },
  { id: 'PB-003', name: 'Delaware Basin', status: 'drilling', mcf_day: 0, btc_mined: 0, efficiency: 0, depth: 4200 },
  { id: 'PB-004', name: 'Wolfcamp West', status: 'active', mcf_day: 3100, btc_mined: 1.534, efficiency: 97, depth: 10200 },
  { id: 'PB-005', name: 'Spraberry Deep', status: 'maintenance', mcf_day: 0, btc_mined: 0.412, efficiency: 0, depth: 11400 },
];

const generateChartData = (days = 30) => {
  const data = [];
  let production = 7000;
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    production = Math.max(5000, Math.min(9000, production + (Math.random() - 0.48) * 400));
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      production: Math.floor(production),
      mined: 0.065 + Math.random() * 0.025,
    });
  }
  return data;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [time, setTime] = useState(new Date());
  const [chartData] = useState(generateChartData(30));
  
  // Hooks
  const { prices, loading: pricesLoading } = useCryptoPrices();
  const ercot = useErcotData();
  const wallet = useWallet();

  // Portfolio data (would come from contract in production)
  const [portfolio] = useState({
    btc_balance: 4.084,
    eth_balance: 24.7,
    sol_balance: 312,
    usdc_balance: 148750,
    pipe_balance: 8500,
    pipe_staked: 6000,
    pipe_pending_rewards: 847.50,
  });

  const [pipeline] = useState({
    token_price: 14.80,
    total_supply: 100000,
    total_staked: 45000,
    holders: 1247,
    volume_24h: 584000,
    apy: 18.4,
    your_capacity: 2125, // MCF
  });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalCrypto = 
    (portfolio.btc_balance * prices.btc) +
    (portfolio.eth_balance * prices.eth) +
    (portfolio.sol_balance * prices.sol) +
    portfolio.usdc_balance;

  const totalProd = WELLS_DATA.reduce((s, w) => s + w.mcf_day, 0);
  const totalBtc = WELLS_DATA.reduce((s, w) => s + w.btc_mined, 0);

  const COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#10b981'];

  // ═══════════════════════════════════════════════════════════════════════════════
  // TAB RENDERERS
  // ═══════════════════════════════════════════════════════════════════════════════

  const renderOverview = () => (
    <>
      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/20 border border-amber-500/30 rounded-xl p-6">
          <p className="text-[10px] text-amber-500/70 uppercase tracking-wider mb-2">Portfolio Value</p>
          <p className="text-3xl font-bold text-amber-400">${totalCrypto.toLocaleString()}</p>
          <p className="text-xs text-emerald-400 mt-2">Live prices</p>
        </div>
        <MetricCard label="BTC Price" value={`$${prices.btc.toLocaleString()}`} trend={prices.btc_change} color="orange" live />
        <MetricCard label="Gas Production" value={`${totalProd.toLocaleString()} MCF`} sub="Daily" color="amber" />
        <MetricCard label="BTC Mined" value={totalBtc.toFixed(3)} sub={`≈ $${(totalBtc * prices.btc).toLocaleString()}`} color="orange" />
        <MetricCard label="PIPE Holdings" value={`${portfolio.pipe_balance.toLocaleString()}`} sub={`$${(portfolio.pipe_balance * pipeline.token_price).toLocaleString()}`} color="purple" />
      </div>

      {/* Bootstrap Model */}
      <Card className="mb-8">
        <div className="text-center mb-6">
          <h2 className="text-xs uppercase tracking-[0.3em] text-white/40">EchoForge Bootstrap Model</h2>
        </div>
        <div className="flex items-center justify-between px-8">
          {[
            { icon: '⛽', label: 'DRILL WELL', value: `${totalProd} MCF/day`, color: 'text-amber-400', bg: 'bg-amber-900/30 border-amber-500/50' },
            { icon: '⚡', label: 'GENERATE', value: '4.8 MW', color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-500/50' },
            { icon: '₿', label: 'MINE BTC', value: `${(totalBtc / 30).toFixed(4)} BTC/day`, color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-500/50' },
            { icon: '☀', label: 'REINVEST', value: `$2.85M`, color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-500/50' },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              <div className="text-center">
                <div className={`w-20 h-20 mx-auto ${s.bg} border-2 rounded-full flex items-center justify-center mb-3 text-3xl`}>{s.icon}</div>
                <p className={`text-sm font-bold ${s.color}`}>{s.label}</p>
                <p className={`text-sm font-mono ${s.color} opacity-70 mt-2`}>{s.value}</p>
              </div>
              {i < 3 && (
                <svg className="w-12 h-8 text-white/20 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-8 h-1 bg-gradient-to-r from-amber-500 via-orange-500 via-yellow-500 to-emerald-500 rounded-full max-w-2xl mx-auto" />
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <Card title="Production (30 Days)">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" stroke="#ffffff30" fontSize={10} />
              <YAxis stroke="#ffffff30" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1b', border: '1px solid #ffffff20', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="production" stroke="#f59e0b" fill="url(#prodGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="ERCOT Grid Status" badge={<StatusBadge status={ercot.status} />}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-black/30 rounded-lg">
              <p className="text-xs text-white/40">Grid Price</p>
              <p className="text-2xl font-bold text-emerald-400">${ercot.grid_price.toFixed(2)}/MWh</p>
            </div>
            <div className="p-3 bg-black/30 rounded-lg">
              <p className="text-xs text-white/40">Demand</p>
              <p className="text-2xl font-bold">{(ercot.demand_mw / 1000).toFixed(1)} GW</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-lg">
              <p className="text-xs text-cyan-400">Wind Output</p>
              <p className="text-lg font-bold">{ercot.wind_output.toLocaleString()} MW</p>
            </div>
            <div className="p-3 bg-amber-950/30 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400">Solar Output</p>
              <p className="text-lg font-bold">{ercot.solar_output.toLocaleString()} MW</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-3 gap-6">
        <Card title="Wells Status">
          <div className="space-y-2">
            {WELLS_DATA.slice(0, 4).map(w => (
              <div key={w.id} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                <div>
                  <p className="text-sm font-bold">{w.name}</p>
                  <p className="text-xs text-white/40">{w.id}</p>
                </div>
                <StatusBadge status={w.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Crypto Holdings">
          <div className="space-y-3">
            {[
              { name: 'Bitcoin', symbol: 'BTC', balance: portfolio.btc_balance, price: prices.btc, color: '#f97316' },
              { name: 'Ethereum', symbol: 'ETH', balance: portfolio.eth_balance, price: prices.eth, color: '#3b82f6' },
              { name: 'Solana', symbol: 'SOL', balance: portfolio.sol_balance, price: prices.sol, color: '#8b5cf6' },
            ].map(a => (
              <div key={a.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-sm">{a.symbol}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">${(a.balance * a.price).toLocaleString()}</p>
                  <p className="text-xs text-white/40">{a.balance} {a.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="PIPE Token">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-white/40">Price</span>
              <span className="text-xl font-bold text-purple-400">${pipeline.token_price}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40">Your Balance</span>
              <span>{portfolio.pipe_balance.toLocaleString()} PIPE</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40">Staked</span>
              <span className="text-emerald-400">{portfolio.pipe_staked.toLocaleString()} PIPE</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/40">Pending Rewards</span>
              <span className="text-amber-400">${portfolio.pipe_pending_rewards.toFixed(2)}</span>
            </div>
            <button 
              onClick={() => wallet.account ? alert('Claiming rewards...') : wallet.connect()}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold transition"
            >
              {wallet.account ? 'Claim Rewards' : 'Connect to Claim'}
            </button>
          </div>
        </Card>
      </div>
    </>
  );

  const renderWells = () => (
    <>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard label="Active Wells" value={WELLS_DATA.filter(w => w.status === 'active').length} sub={`of ${WELLS_DATA.length}`} color="emerald" />
        <MetricCard label="Total Production" value={`${totalProd.toLocaleString()} MCF`} sub="Daily" color="amber" />
        <MetricCard label="Avg Efficiency" value={`${Math.round(WELLS_DATA.filter(w => w.efficiency > 0).reduce((s, w) => s + w.efficiency, 0) / WELLS_DATA.filter(w => w.efficiency > 0).length)}%`} color="blue" />
        <MetricCard label="BTC Revenue" value={`$${(totalBtc * prices.btc).toLocaleString()}`} color="orange" live />
      </div>
      <Card title="Well Management">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-white/40 uppercase tracking-wider border-b border-white/10">
                <th className="pb-4 pr-4">ID</th>
                <th className="pb-4 pr-4">Name</th>
                <th className="pb-4 pr-4">Status</th>
                <th className="pb-4 pr-4">Production</th>
                <th className="pb-4 pr-4">BTC Mined</th>
                <th className="pb-4 pr-4">Efficiency</th>
                <th className="pb-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {WELLS_DATA.map(w => (
                <tr key={w.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-4 pr-4 font-mono text-amber-400">{w.id}</td>
                  <td className="py-4 pr-4 font-bold">{w.name}</td>
                  <td className="py-4 pr-4"><StatusBadge status={w.status} /></td>
                  <td className="py-4 pr-4">{w.mcf_day.toLocaleString()} MCF/day</td>
                  <td className="py-4 pr-4 text-orange-400">{w.btc_mined.toFixed(3)} BTC</td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${w.efficiency > 90 ? 'bg-emerald-500' : w.efficiency > 0 ? 'bg-amber-500' : 'bg-gray-500'}`} style={{ width: `${w.efficiency}%` }} />
                      </div>
                      <span className="text-xs">{w.efficiency}%</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <button className="px-3 py-1.5 bg-white/10 rounded text-xs hover:bg-white/20">Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );

  const renderCrypto = () => (
    <>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/20 border border-orange-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-orange-500/70 uppercase tracking-wider">Total Value</p>
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          </div>
          <p className="text-3xl font-bold text-orange-400">${totalCrypto.toLocaleString()}</p>
          <p className="text-xs text-white/40 mt-1">Live prices from CoinGecko</p>
        </div>
        <MetricCard label="Bitcoin" value={`${portfolio.btc_balance} BTC`} sub={`$${prices.btc.toLocaleString()}`} trend={prices.btc_change} color="orange" live />
        <MetricCard label="Ethereum" value={`${portfolio.eth_balance} ETH`} sub={`$${prices.eth.toLocaleString()}`} trend={prices.eth_change} color="blue" live />
        <MetricCard label="Solana" value={`${portfolio.sol_balance} SOL`} sub={`$${prices.sol.toLocaleString()}`} trend={prices.sol_change} color="purple" live />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card title="Portfolio Allocation">
            <div className="flex items-center gap-8">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'BTC', value: portfolio.btc_balance * prices.btc },
                      { name: 'ETH', value: portfolio.eth_balance * prices.eth },
                      { name: 'SOL', value: portfolio.sol_balance * prices.sol },
                      { name: 'USDC', value: portfolio.usdc_balance },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-4">
                {[
                  { n: 'Bitcoin', s: 'BTC', b: portfolio.btc_balance, p: prices.btc, c: '#f97316' },
                  { n: 'Ethereum', s: 'ETH', b: portfolio.eth_balance, p: prices.eth, c: '#3b82f6' },
                  { n: 'Solana', s: 'SOL', b: portfolio.sol_balance, p: prices.sol, c: '#8b5cf6' },
                  { n: 'USDC', s: 'USDC', b: portfolio.usdc_balance, p: 1, c: '#10b981' },
                ].map(a => (
                  <div key={a.s} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.c }} />
                      <span className="text-sm">{a.n}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">${(a.b * a.p).toLocaleString()}</p>
                      <p className="text-xs text-white/40">{a.b.toLocaleString()} {a.s}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card title="Quick Actions">
          <div className="space-y-3">
            <p className="text-xs text-white/40 mb-4">
              {wallet.account ? 'Connected to Base Sepolia' : 'Connect wallet to trade'}
            </p>
            {['BTC', 'ETH', 'SOL'].map(asset => (
              <div key={asset} className="flex gap-2">
                <button className="flex-1 py-2 bg-emerald-900/30 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm font-medium hover:bg-emerald-900/50 transition">
                  Buy {asset}
                </button>
                <button className="flex-1 py-2 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium hover:bg-red-900/50 transition">
                  Sell {asset}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );

  const renderPipeline = () => (
    <>
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/20 border border-purple-500/30 rounded-xl p-6">
          <p className="text-[10px] text-purple-500/70 uppercase tracking-wider mb-2">PIPE Price</p>
          <p className="text-3xl font-bold text-purple-400">${pipeline.token_price}</p>
          <p className="text-xs text-emerald-400 mt-2">↑ 4.8% (24h)</p>
        </div>
        <MetricCard label="Your Holdings" value={`${portfolio.pipe_balance.toLocaleString()} PIPE`} sub={`$${(portfolio.pipe_balance * pipeline.token_price).toLocaleString()}`} color="purple" />
        <MetricCard label="Staked" value={`${portfolio.pipe_staked.toLocaleString()} PIPE`} sub={`${pipeline.apy}% APY`} color="emerald" />
        <MetricCard label="Pending Rewards" value={`$${portfolio.pipe_pending_rewards.toFixed(2)}`} sub="Claimable" color="amber" />
        <MetricCard label="Your Capacity" value={`${pipeline.your_capacity.toLocaleString()} MCF`} sub="Pipeline Rights" color="blue" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card title="Pipeline Capacity Token (PIPE)">
            <div className="p-6 bg-gradient-to-r from-purple-950/50 to-indigo-950/50 rounded-xl border border-purple-500/20 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-purple-400">Tokenized Permian Basin Pipeline Rights</p>
                  <p className="text-white/40 mt-1">Fractional ownership with automated USDC revenue distribution</p>
                  <p className="text-xs text-white/30 mt-2 font-mono">Contract: {CONTRACTS.PIPE.slice(0, 10)}... (Base Sepolia)</p>
                </div>
                <div className="text-6xl">🛢️</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-black/30 rounded-lg text-center">
                <p className="text-xs text-white/40 mb-2">Total Supply</p>
                <p className="text-xl font-bold">{pipeline.total_supply.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-black/30 rounded-lg text-center">
                <p className="text-xs text-white/40 mb-2">Total Staked</p>
                <p className="text-xl font-bold text-emerald-400">{pipeline.total_staked.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-black/30 rounded-lg text-center">
                <p className="text-xs text-white/40 mb-2">Holders</p>
                <p className="text-xl font-bold">{pipeline.holders.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-black/30 rounded-lg text-center">
                <p className="text-xs text-white/40 mb-2">24h Volume</p>
                <p className="text-xl font-bold">${(pipeline.volume_24h / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Token Actions">
          <div className="space-y-4">
            {!wallet.account ? (
              <button onClick={wallet.connect} className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-bold transition">
                Connect Wallet
              </button>
            ) : (
              <>
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-center">
                  <p className="text-xs text-emerald-400">Connected</p>
                  <p className="text-xs font-mono text-white/60 mt-1">{wallet.account.slice(0, 8)}...{wallet.account.slice(-6)}</p>
                </div>
                <button className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition">
                  Stake PIPE
                </button>
                <button className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition">
                  Unstake PIPE
                </button>
                <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition">
                  Claim ${portfolio.pipe_pending_rewards.toFixed(2)}
                </button>
              </>
            )}
            <div className="p-4 bg-amber-950/30 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400 font-bold mb-1">Staking APY</p>
              <p className="text-2xl font-bold text-amber-400">{pipeline.apy}%</p>
              <p className="text-xs text-white/40 mt-1">Paid in USDC from pipeline fees</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );

  const renderErcot = () => (
    <>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-emerald-900/30 to-green-900/20 border border-emerald-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-emerald-500/70 uppercase tracking-wider">Grid Status</p>
            <StatusBadge status={ercot.status} />
          </div>
          <p className="text-3xl font-bold text-emerald-400">${ercot.grid_price.toFixed(2)}</p>
          <p className="text-xs text-white/40 mt-1">/MWh (Live)</p>
        </div>
        <MetricCard label="Grid Demand" value={`${(ercot.demand_mw / 1000).toFixed(1)} GW`} sub={`of ${(ercot.capacity_mw / 1000).toFixed(0)} GW`} color="blue" live />
        <MetricCard label="Wind Output" value={`${(ercot.wind_output / 1000).toFixed(1)} GW`} color="cyan" live />
        <MetricCard label="Solar Output" value={`${(ercot.solar_output / 1000).toFixed(1)} GW`} color="amber" live />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card title="ERCOT Real-Time Grid">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-black/30 rounded-lg">
                  <p className="text-xs text-white/40 mb-2">Load Factor</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${ercot.demand_mw / ercot.capacity_mw > 0.85 ? 'bg-red-500' : ercot.demand_mw / ercot.capacity_mw > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${(ercot.demand_mw / ercot.capacity_mw) * 100}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold">{((ercot.demand_mw / ercot.capacity_mw) * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="p-4 bg-black/30 rounded-lg">
                  <p className="text-xs text-white/40 mb-2">Renewable Mix</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden flex">
                      <div className="h-full bg-cyan-500" style={{ width: `${(ercot.wind_output / ercot.demand_mw) * 100}%` }} />
                      <div className="h-full bg-amber-500" style={{ width: `${(ercot.solar_output / ercot.demand_mw) * 100}%` }} />
                    </div>
                    <span className="text-lg font-bold">{(((ercot.wind_output + ercot.solar_output) / ercot.demand_mw) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-cyan-950/30 border border-cyan-500/20 rounded-lg">
                  <p className="text-xs text-cyan-400 mb-1">Wind Generation</p>
                  <p className="text-2xl font-bold">{ercot.wind_output.toLocaleString()} MW</p>
                  <p className="text-xs text-white/40">{((ercot.wind_output / ercot.demand_mw) * 100).toFixed(1)}% of load</p>
                </div>
                <div className="p-4 bg-amber-950/30 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-400 mb-1">Solar Generation</p>
                  <p className="text-2xl font-bold">{ercot.solar_output.toLocaleString()} MW</p>
                  <p className="text-xs text-white/40">{((ercot.solar_output / ercot.demand_mw) * 100).toFixed(1)}% of load</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Mining Operations">
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${ercot.grid_price < 50 ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-amber-950/30 border-amber-500/30'}`}>
              <p className={`text-lg font-bold ${ercot.grid_price < 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {ercot.grid_price < 50 ? '✓ Full Mining' : '⚠ Reduced Mining'}
              </p>
              <p className="text-xs text-white/40 mt-1">
                {ercot.grid_price < 50 ? 'All ASICs online' : 'Curtailing for grid support'}
              </p>
            </div>
            <div className="p-4 bg-black/30 rounded-lg">
              <p className="text-xs text-white/40 mb-2">Auto-Curtailment Threshold</p>
              <p className="text-xl font-bold text-amber-400">$65/MWh</p>
              <p className="text-xs text-white/40 mt-1">Current: ${ercot.grid_price.toFixed(2)}/MWh</p>
            </div>
            <div className="p-4 bg-black/30 rounded-lg">
              <p className="text-xs text-white/40 mb-2">Registered Capacity</p>
              <p className="text-xl font-bold">4.8 MW</p>
              <p className="text-xs text-white/40 mt-1">PUCT Compliant</p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );

  const tabs = { overview: renderOverview, wells: renderWells, crypto: renderCrypto, pipeline: renderPipeline, ercot: renderErcot };

  return (
    <div className="min-h-screen bg-[#08080a] text-white font-mono">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
              <span className="text-2xl font-black text-black">E</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">ECHOFORGE</h1>
              <p className="text-[9px] text-white/30 tracking-[0.4em] uppercase">Texas Energy Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-medium">LIVE</span>
            </div>
            <div className="text-white/60 text-sm">
              {time.toLocaleTimeString('en-US', { hour12: false })} <span className="text-white/30">CST</span>
            </div>
            <WalletButton 
              account={wallet.account} 
              onConnect={wallet.connect} 
              onDisconnect={wallet.disconnect} 
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="max-w-[1920px] mx-auto px-8 flex gap-1">
          {['overview', 'wells', 'crypto', 'pipeline', 'ercot'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-6 py-3 text-[11px] uppercase tracking-[0.15em] font-medium transition ${
                activeTab === t
                  ? 'bg-white/[0.08] text-white border-t-2 border-amber-500'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/[0.03]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1920px] mx-auto p-8">
        {tabs[activeTab]?.()}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12 py-8 text-center">
        <p className="text-xs text-white/20">
          EchoForge Texas Energy Platform v2.0 • Ivan Torres / EchoForge Studios • 2025
        </p>
        <p className="text-[10px] text-white/10 mt-2 tracking-widest">
          "DRILL 1 WELL → BOOTSTRAP CRYPTO → REINVEST RENEWABLES"
        </p>
        <p className="text-[10px] text-white/10 mt-1">
          Base Sepolia • Contract: {CONTRACTS.PIPE}
        </p>
      </footer>
    </div>
  );
}
