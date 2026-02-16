'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    Hexagon, Bot, Users, TrendingUp, Bitcoin, Activity, Radio, Trophy,
    ArrowLeft, Mail, Lock, LogOut, BarChart3 as CandlestickIcon, LineChart as LineIcon, Plus, X, ShieldAlert, Key, Power, Play
} from 'lucide-react';

type TimeFilter = '1h' | '1d' | '1w';
type ChartType = 'line' | 'candle';
type AIProvider = 'Google' | 'OpenAI' | 'Anthropic';

export default function ProoBeeDashboard() {
    const [isLoginVisible, setIsLoginVisible] = useState(true);
    const [currentMode, setCurrentMode] = useState<'overview' | 'agent-detail'>('overview');
    const [loading, setLoading] = useState(true);
    const [isSimulating, setIsSimulating] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newAgentName, setNewAgentName] = useState('');
    const [newAgentPrompt, setNewAgentPrompt] = useState('');
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('Google');
    const [apiKey, setApiKey] = useState('');
    const [chartType, setChartType] = useState<ChartType>('line');
    const [timeFilter, setTimeFilter] = useState('1d');
    const [marketData, setMarketData] = useState<any[]>([]);
    const [btcPrice, setBtcPrice] = useState<string>('Loading...');
    const [activeAgentsCount, setActiveAgentsCount] = useState<number>(0);
    const [avgYield, setAvgYield] = useState<number>(0);
    const [reasoningLogs, setReasoningLogs] = useState<any[]>([]);
    const [myAgents, setMyAgents] = useState<any[]>([]);

    const fetchData = async () => {
        let interval = '1h', limit = '24';
        if (timeFilter === '1h') { interval = '1m'; limit = '60'; }
        else if (timeFilter === '1w') { interval = '1d'; limit = '7'; }

        try {
            const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`);
            const data = await res.json();
            setMarketData(data);
            setBtcPrice(`$${parseFloat(data[data.length - 1][4]).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

            const { data: agentData } = await supabase.from('agents').select('*').order('created_at', { ascending: false });
            if (agentData) {
                setMyAgents(agentData);
                setActiveAgentsCount(agentData.filter(a => a.status === 'alive').length);
                const total = agentData.reduce((acc, curr) => acc + (curr.yield || 0), 0);
                setAvgYield(agentData.length > 0 ? total / agentData.length : 0);
            }

            const { data: logs } = await supabase.from('reasoning_logs').select('*').order('created_at', { ascending: false }).limit(5);
            setReasoningLogs(logs || []);
        } catch (e) { console.error("Fetch Error:", e); }
    };

    // 데이터 패칭 타이머
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) { setUser(session.user); setIsLoginVisible(false); }
            setLoading(false);
            fetchData();
        };
        init();

        const interval = setInterval(fetchData, 15000);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
            if (s) { setUser(s.user); setIsLoginVisible(false); }
            else { setUser(null); setIsLoginVisible(true); }
        });

        return () => {
            subscription.unsubscribe();
            clearInterval(interval);
        };
    }, [timeFilter]);

    // 자동 시뮬레이션 타이머 (1분마다 실행)
    useEffect(() => {
        if (!user) return;
        const simInterval = setInterval(() => {
            const aliveExists = myAgents.some(a => a.status === 'alive');
            if (aliveExists && !isSimulating) {
                handleRunSimulation(true);
            }
        }, 60000);
        return () => clearInterval(simInterval);
    }, [myAgents, user, isSimulating]);

    const handleRunSimulation = async (isAuto = false) => {
        const aliveBees = myAgents.filter(a => a.status === 'alive');
        if (aliveBees.length === 0) {
            if (!isAuto) alert("활성화된 에이전트가 없습니다.");
            return;
        }

        setIsSimulating(true);
        const currentPrice = marketData.length > 0 ? parseFloat(marketData[marketData.length - 1][4]) : 0;

        for (const agent of aliveBees) {
            try {
                // 테스트용 로직 (실제 서비스 시 Gemini API 연동)
                const mockDecisions = ['BUY', 'SELL', 'HOLD'];
                const decision = mockDecisions[Math.floor(Math.random() * mockDecisions.length)];
                const mockReasoning = `${agent.name}가 현재 가격 $${currentPrice.toLocaleString()}에서 분석 결과 ${decision} 결정을 내렸습니다.`;

                // 1. 분석 로그 기록 (agent_id 필수 포함)
                const { error: logError } = await supabase.from('reasoning_logs').insert([{
                    content: mockReasoning,
                    agent_id: agent.id
                }]);

                if (logError) {
                    console.error("Log insert error:", logError.message);
                } else {
                    // 2. 수익률 업데이트 (로그 저장 성공 시)
                    const yieldChange = decision === 'BUY' ? 0.2 : (decision === 'SELL' ? -0.1 : 0.01);
                    await supabase.from('agents').update({
                        yield: (agent.yield || 0) + yieldChange
                    }).eq('id', agent.id);
                }

            } catch (err) {
                console.error("Simulation error:", err);
            }
        }

        await fetchData();
        setIsSimulating(false);
        if (!isAuto) alert("시뮬레이션이 완료되었습니다.");
    };

    const handleCreateAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return alert("Authentication required.");
        const { error: agentError } = await supabase.from('agents').insert([{
            name: newAgentName,
            persona: newAgentPrompt,
            provider: selectedProvider.toLowerCase(),
            user_id: user.id,
            yield: 0.0,
            model: selectedProvider === 'Google' ? 'gemini-1.5-flash' : 'Selected',
            api_key: apiKey,
            status: 'alive'
        }]);

        if (agentError) alert(agentError.message);
        else {
            setIsCreateModalOpen(false);
            setNewAgentName(''); setNewAgentPrompt(''); setApiKey('');
            fetchData();
        }
    };

    const toggleAgentStatus = async (agentId: string, currentStatus: string | null) => {
        const nextStatus = currentStatus === 'alive' ? 'dead' : 'alive';
        await supabase.from('agents').update({ status: nextStatus }).eq('id', agentId);
        fetchData();
    };

    const chartMetrics = useMemo(() => {
        if (marketData.length === 0) return null;
        const highs = marketData.map(d => parseFloat(d[2])), lows = marketData.map(d => parseFloat(d[3]));
        const min = Math.min(...lows), max = Math.max(...highs);
        return { min, max, range: (max - min) || 1 };
    }, [marketData]);

    const getY = (p: number) => chartMetrics ? 300 - 40 - ((p - chartMetrics.min) / chartMetrics.range) * 220 : 0;
    const getX = (i: number) => 80 + (i / (marketData.length - 1)) * 840;

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = isSignUp ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
    };

    const handleLogout = () => supabase.auth.signOut();
    if (loading) return null;

    return (
        <div className="text-[#1a1a1a] h-screen flex flex-col overflow-hidden font-sans bg-[#f8f9fa]">
            {!user && isLoginVisible && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FFD700]">
                    <div className="bg-white p-10 rounded-[3rem] border-4 border-[#1a1a1a] shadow-[8px_8px_0px_0px_#1a1a1a] text-center max-w-md w-full mx-4">
                        <div className="w-20 h-20 bg-[#1a1a1a] text-[#FFD700] rounded-full mx-auto flex items-center justify-center mb-6 border-4 border-white shadow-lg"><Hexagon className="w-10 h-10 fill-current" /></div>
                        <h1 className="text-4xl font-black mb-2 italic tracking-tighter uppercase text-[#1a1a1a]">Proo bee</h1>
                        <form onSubmit={handleAuth} className="space-y-4 text-left">
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" className="w-full px-4 py-3 rounded-2xl border-2 border-[#1a1a1a] font-bold outline-none" required />
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-3 rounded-2xl border-2 border-[#1a1a1a] font-bold outline-none" required />
                            <button type="submit" className="w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_#1a1a1a] active:translate-x-[2px] active:translate-y-[2px] transition-all">{isSignUp ? 'Create Account' : 'Connect Dashboard'}</button>
                        </form>
                        <button onClick={() => setIsSignUp(!isSignUp)} className="mt-6 text-xs font-black uppercase tracking-widest hover:underline opacity-60 underline underline-offset-4">{isSignUp ? 'Already a bee? Log In' : 'New here? Sign Up'}</button>
                    </div>
                </div>
            )}

            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a1a1a]/40 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] border-4 border-[#1a1a1a] shadow-[8px_8px_0px_0px_#1a1a1a] overflow-hidden">
                        <div className="p-6 bg-[#FFD700] border-b-4 border-[#1a1a1a] flex justify-between items-center"><h3 className="text-xl font-black italic uppercase tracking-tighter">Hatch New Bee</h3><button onClick={() => setIsCreateModalOpen(false)}><X size={24} strokeWidth={3} /></button></div>
                        <form onSubmit={handleCreateAgent} className="p-8 space-y-5">
                            <input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="Agent Name (e.g. Honey Hunter)" className="w-full px-5 py-3 rounded-2xl border-2 border-[#1a1a1a] font-bold outline-none" required />
                            <div className="grid grid-cols-2 gap-4">
                                <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value as AIProvider)} className="w-full px-4 py-3 rounded-2xl border-2 border-[#1a1a1a] font-bold bg-white cursor-pointer"><option value="Google">Google (Gemini)</option><option value="OpenAI">OpenAI (GPT)</option></select>
                                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter API Key" className="w-full px-4 py-3 rounded-2xl border-2 border-[#1a1a1a] font-bold outline-none" required />
                            </div>
                            <textarea value={newAgentPrompt} onChange={(e) => setNewAgentPrompt(e.target.value)} placeholder="Define Trading Behavior..." className="w-full h-32 px-5 py-4 rounded-2xl border-2 border-[#1a1a1a] font-bold outline-none resize-none bg-[#fdfcf0]" required />
                            <button type="submit" className="w-full py-4 bg-[#1a1a1a] text-white rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_#FFD700] active:translate-x-[2px] transition-all uppercase">Hatch Agent</button>
                        </form>
                    </div>
                </div>
            )}

            <header className="h-20 bg-white border-b-4 border-[#1a1a1a] flex items-center justify-between px-8 shrink-0">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentMode('overview')}>
                    <div className="w-10 h-10 bg-[#1a1a1a] text-[#FFD700] rounded-full border-2 border-[#1a1a1a] flex items-center justify-center shadow-[2px_2px_0px_0px_#1a1a1a]"><Hexagon className="w-6 h-6 fill-current" /></div>
                    <span className="text-2xl font-black italic tracking-tighter">PROO BEE</span>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={() => handleRunSimulation(false)} disabled={isSimulating} className="px-6 py-2 bg-[#1a1a1a] text-[#FFD700] rounded-xl font-black text-sm shadow-[4px_4px_0px_0px_#FFD700] flex items-center gap-2 active:translate-y-1 transition-all disabled:opacity-50">
                        <Play size={16} fill="currentColor" /> {isSimulating ? 'ANALYZING...' : 'RUN SIMULATION'}
                    </button>
                    <button onClick={() => setCurrentMode(currentMode === 'overview' ? 'agent-detail' : 'overview')} className="px-6 py-2 rounded-xl border-2 border-[#1a1a1a] font-black shadow-[4px_4px_0px_0px_#1a1a1a] flex items-center gap-2 bg-[#FFD700]"><Bot size={18} /><span className="text-sm uppercase tracking-wider">{currentMode === 'overview' ? 'My Agent' : 'Back Home'}</span></button>
                    <div onClick={handleLogout} className="w-10 h-10 rounded-full bg-white border-2 border-[#1a1a1a] flex items-center justify-center cursor-pointer shadow-[2px_2px_0px_0px_#1a1a1a] hover:bg-red-50"><LogOut size={18} /></div>
                </div>
            </header>

            <main className="flex-1 p-6 overflow-hidden">
                {currentMode === 'overview' ? (
                    <div className="flex flex-col h-full gap-6">
                        <div className="grid grid-cols-3 gap-6 shrink-0">
                            <div className="bg-white rounded-3xl border-2 border-[#1a1a1a] p-5 shadow-[4px_4px_0px_0px_#1a1a1a]"><span className="text-[#1a1a1a]/40 text-xs font-black uppercase flex items-center gap-2"><Users size={12} /> Active Agents</span><span className="text-4xl font-black tracking-tighter">{activeAgentsCount}</span></div>
                            <div className="bg-white rounded-3xl border-2 border-[#1a1a1a] p-5 shadow-[4px_4px_0px_0px_#1a1a1a]"><span className="text-[#1a1a1a]/40 text-xs font-black uppercase flex items-center gap-2"><TrendingUp size={12} /> Avg Yield</span><span className={`text-4xl font-black tracking-tighter ${avgYield >= 0 ? 'text-green-500' : 'text-red-500'}`}>+{avgYield.toFixed(2)}%</span></div>
                            <div className="bg-white rounded-3xl border-2 border-[#1a1a1a] p-5 shadow-[4px_4px_0px_0px_#1a1a1a]"><span className="text-[#1a1a1a]/40 text-xs font-black uppercase flex items-center gap-2"><Bitcoin size={12} /> BTC Price</span><span className="text-4xl font-black tracking-tighter">{btcPrice}</span></div>
                        </div>
                        <div className="flex-1 flex gap-6 overflow-hidden">
                            <div className="flex-[2] bg-white rounded-3xl border-2 border-[#1a1a1a] flex flex-col shadow-[4px_4px_0px_0px_#1a1a1a] overflow-hidden">
                                <div className="p-4 border-b-2 border-[#1a1a1a] flex justify-between bg-[#fdfcf0] font-black uppercase text-xs"><span>Market Arena</span><div className="flex gap-2">{(['1h', '1d', '1w'] as TimeFilter[]).map(f => (<button key={f} onClick={() => setTimeFilter(f)} className={`px-3 py-1 rounded border-2 border-[#1a1a1a] text-[10px] font-black ${timeFilter === f ? 'bg-[#FFD700]' : 'bg-white'}`}>{f}</button>))}</div></div>
                                <div className="flex-1 p-4 relative">
                                    <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 300" preserveAspectRatio="none">
                                        {chartMetrics && [0, 0.5, 1].map(v => (<text key={v} x="75" y={300 - 40 - v * 220} textAnchor="end" className="text-[20px] font-black opacity-10 fill-black italic">${(chartMetrics.min + v * chartMetrics.range).toLocaleString()}</text>))}
                                        {marketData.length > 0 && [0, Math.floor(marketData.length / 2), marketData.length - 1].map(idx => (<text key={idx} x={getX(idx)} y="295" textAnchor="middle" className="text-[20px] font-black opacity-20 fill-black italic">{new Date(marketData[idx][0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</text>))}
                                        {chartType === 'line' && (<path d={marketData.length > 0 ? `M ${marketData.map((_, i) => `${getX(i)} ${getY(parseFloat(marketData[i][4]))}`).join(' L ')}` : ''} fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />)}
                                    </svg>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col gap-6">
                                <div className="flex-1 bg-white rounded-3xl border-2 border-[#1a1a1a] flex flex-col shadow-[4px_4px_0px_0px_#1a1a1a] overflow-hidden">
                                    <div className="p-3 bg-[#FFD700] border-b-2 border-[#1a1a1a] font-black text-xs uppercase flex items-center gap-2"><Radio size={12} /> Live Reasoning</div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fdfcf0]">
                                        {reasoningLogs.length > 0 ? reasoningLogs.map((log, i) => (
                                            <div key={i} className="bg-white p-3 rounded-xl border-2 border-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a] text-[10px] font-bold italic leading-tight animate-in fade-in slide-in-from-bottom-2">"{log.content}"</div>
                                        )) : <div className="text-[10px] font-bold opacity-30 text-center py-10 italic">Waiting for bee thoughts...</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center gap-6 overflow-y-auto p-4">
                        <div className="bg-white p-8 rounded-[3rem] border-4 border-[#1a1a1a] shadow-[8px_8px_0px_0px_#1a1a1a] text-center max-w-2xl w-full">
                            <div className="w-20 h-20 bg-[#FFD700] border-4 border-[#1a1a1a] rounded-full mx-auto flex items-center justify-center mb-4 shadow-[4px_4px_0px_0px_#1a1a1a]"><Bot size={40} /></div>
                            <h2 className="text-3xl font-black italic mb-2 uppercase tracking-tighter">My Agent Console</h2>
                            <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-6">Manage your trading fleet status and behaviors</p>
                            <button onClick={() => setIsCreateModalOpen(true)} className="px-10 py-4 bg-[#1a1a1a] text-white rounded-2xl font-black shadow-[4px_4px_0px_0px_#FFD700] hover:scale-105 transition-transform uppercase text-sm">Hatch New Bee Agent</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl pb-10">
                            {myAgents.map((agent) => (
                                <div key={agent.id} className={`bg-white p-6 rounded-[2rem] border-4 border-[#1a1a1a] shadow-[4px_4px_0px_0px_#1a1a1a] flex justify-between items-center transition-all ${agent.status !== 'alive' ? 'opacity-50 grayscale' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-full border-2 border-[#1a1a1a] ${agent.status === 'alive' ? 'bg-[#FFD700]' : 'bg-gray-200'}`}><Bot size={20} /></div>
                                        <div><h3 className="font-black text-lg italic leading-tight">{agent.name}</h3><p className="text-[10px] font-black opacity-40 uppercase tracking-tighter">{agent.provider} • Yield: {agent.yield?.toFixed(2) || '0.00'}%</p></div>
                                    </div>
                                    <button onClick={() => toggleAgentStatus(agent.id, agent.status)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[#1a1a1a] font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_#1a1a1a] active:translate-y-[1px] transition-all ${agent.status === 'alive' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}><Power size={12} strokeWidth={3} />{agent.status === 'alive' ? 'Stop Bee' : 'Start Bee'}</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}