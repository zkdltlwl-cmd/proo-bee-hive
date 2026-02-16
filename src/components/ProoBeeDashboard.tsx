'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
    Hexagon, Bot, User, Users, TrendingUp, Bitcoin, Activity,
    Radio, Trophy, ArrowLeft, Mail, Lock, LogOut, BarChart3 as CandlestickIcon, LineChart as LineIcon,
    Plus, X, ShieldAlert, Key, Play, Pause, CheckCircle2, AlertCircle
} from 'lucide-react';

type TimeFilter = '1h' | '1d' | '1w';
type ChartType = 'line' | 'candle';
type AIProvider = 'OpenAI' | 'Anthropic' | 'Google';

export default function ProoBeeDashboard() {
    // 1. Navigation & Auth State
    const [isLoginVisible, setIsLoginVisible] = useState(true);
    const [currentMode, setCurrentMode] = useState<'overview' | 'agent-detail'>('overview');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    // 2. Auth Input State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    // 3. Agent Creation State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newAgentName, setNewAgentName] = useState('');
    const [newAgentPrompt, setNewAgentPrompt] = useState('');
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('Google');
    const [apiKey, setApiKey] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'none' | 'success' | 'fail'>('none');

    // 4. Market & Hive Data State
    const [chartType, setChartType] = useState<ChartType>('line');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('1d');
    const [marketData, setMarketData] = useState<any[]>([]);
    const [btcPrice, setBtcPrice] = useState<string>('Loading...');
    const [activeAgentsCount, setActiveAgentsCount] = useState<number>(0);
    const [allAgents, setAllAgents] = useState<any[]>([]);
    const [avgYield, setAvgYield] = useState<number>(0);
    const [reasoningLogs, setReasoningLogs] = useState<any[]>([]);
    const [topYields, setTopYields] = useState<any[]>([]);

    // 5. Data Fetching (Binance & Supabase)
    const fetchData = async () => {
        let interval = '1h', limit = '24';
        if (timeFilter === '1h') { interval = '1m'; limit = '60'; }
        else if (timeFilter === '1w') { interval = '1d'; limit = '7'; }

        try {
            // Fetch Binance BTC Price
            const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`);
            const data = await res.json();
            setMarketData(data);
            setBtcPrice(`$${parseFloat(data[data.length - 1][4]).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

            // Fetch Agents from Supabase
            const { data: agentData } = await supabase.from('agents').select('*');
            if (agentData) {
                setAllAgents(agentData);
                const activeOnes = agentData.filter(a => a.status === 'active' || a.status === null);
                setActiveAgentsCount(activeOnes.length);

                const total = agentData.reduce((acc, curr) => acc + (curr.yield || 0), 0);
                const average = agentData.length > 0 ? total / agentData.length : 0;
                setAvgYield(average);
                setTopYields([...agentData].sort((a, b) => b.yield - a.yield).slice(0, 5));
            }

            // Fetch Reasoning Logs
            const { data: logs } = await supabase.from('reasoning_logs').select('*').order('created_at', { ascending: false }).limit(5);
            setReasoningLogs(logs || []);
        } catch (e) { console.error("Fetch Error:", e); }
    };

    // 6. Init Session
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) { setUser(session.user); setIsLoginVisible(false); }
            setLoading(false);
            fetchData();
        };
        init();

        const interval = setInterval(fetchData, 10000);
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
            if (s) { setUser(s.user); setIsLoginVisible(false); }
            else { setUser(null); setIsLoginVisible(true); }
        });
        return () => { subscription.unsubscribe(); clearInterval(interval); };
    }, [timeFilter]);

    // 7. Handlers: Create, Test, Toggle
    const testConnection = async () => {
        if (!apiKey) return alert("Enter API Key.");
        setIsTesting(true);
        setTestStatus('none');
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Respond with 'Success'." }] }] })
            });
            const data = await response.json();
            setTestStatus(data.candidates ? 'success' : 'fail');
        } catch { setTestStatus('fail'); } finally { setIsTesting(false); }
    };

    const handleCreateAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (testStatus !== 'success') return alert("Verify API first.");

        await supabase.from('user_api_keys').upsert({
            user_id: user.id, provider: selectedProvider.toLowerCase(), api_key: apiKey
        });

        const { error } = await supabase.from('agents').insert([{
            name: newAgentName, persona: newAgentPrompt, provider: selectedProvider.toLowerCase(),
            user_id: user.id, yield: 0.0, status: 'active', model: 'Gemini-Flash'
        }]);

        if (error) alert(error.message);
        else {
            setIsCreateModalOpen(false);
            setNewAgentName(''); setNewAgentPrompt(''); setApiKey(''); setTestStatus('none');
            fetchData();
        }
    };

    const handleToggleStatus = async (agentId: string, currentStatus: string) => {
        const newStatus = (currentStatus === 'active' || !currentStatus) ? 'paused' : 'active';
        const { error } = await supabase.from('agents').update({ status: newStatus }).eq('id', agentId);
        if (error) alert(error.message);
        else fetchData();
    };

    const chartMetrics = useMemo(() => {
        if (marketData.length === 0) return null;
        const lows = marketData.map(d => parseFloat(d[3])), highs = marketData.map(d => parseFloat(d[2]));
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
    const toggleMode = () => setCurrentMode(prev => prev === 'overview' ? 'agent-detail' : 'overview');

    if (loading) return null;

    return (
        <div className="text-[#1a1a1a] h-screen flex flex-col overflow-hidden font-sans bg-[#f8f9fa]">

            {/* 1. Login Screen */}
            <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FFD700] transition-transform duration-500 ${!isLoginVisible ? '-translate-y-full' : ''}`}>
                <div className="bg-white p-10 rounded-[3rem] border-4 border-[#1a1a1a] shadow-[8px_8px_0px_0px_#1a1a1a] text-center max-w-md w-full mx-4">
                    <div className="w-20 h-20 bg-[#1a1a1a] text-[#FFD700] rounded-full mx-auto flex items-center justify-center mb-6 border-4 border-white shadow-lg"><Hexagon className="w-10 h-10 fill-current" /></div>
                    <h1 className="text-4xl font-black mb-2 italic tracking-tighter uppercase">Proo bee</h1>
                    <form onSubmit={handleAuth} className="space-y-4 text-left">
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase ml-4 tracking-widest">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-3 rounded-2xl border-2 border-[#1a1a1a] font-bold" required /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase ml-4 tracking-widest">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-5 py-3 rounded-2xl border-2 border-[#1a1a1a] font-bold" required /></div>
                        <button type="submit" className="w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_#1a1a1a] active:translate-x-[2px] transition-all mt-2 uppercase">{isSignUp ? 'Sign Up' : 'Connect'}</button>
                    </form>
                    <button onClick={() => setIsSignUp(!isSignUp)} className="mt-6 text-xs font-black uppercase tracking-widest hover:underline">{isSignUp ? 'Log In' : 'Sign Up'}</button>
                </div>
            </div>

            {/* 2. Creation Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1a1a1a]/40 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] border-4 border-[#1a1a1a] shadow-[8px_8px_0px_0px_#1a1a1a] overflow-hidden">
                        <div className="p-6 bg-[#FFD700] border-b-4 border-[#1a1a1a] flex justify-between items-center"><h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2"><Plus size={20} strokeWidth={3} /> Hatch New Bee</h3><button onClick={() => setIsCreateModalOpen(false)}><X size={24} strokeWidth={3} /></button></div>
                        <form onSubmit={handleCreateAgent} className="p-8 space-y-4 overflow-y-auto max-h-[80vh]">
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase tracking-widest ml-1">Bee Name</label><input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="Honey Hunter" className="w-full px-5 py-3 rounded-2xl border-2 border-[#1a1a1a] font-bold outline-none" required /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="text-[10px] font-black uppercase tracking-widest ml-1">Provider</label><select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value as AIProvider)} className="w-full px-4 py-3 rounded-2xl border-2 border-[#1a1a1a] font-bold bg-white outline-none cursor-pointer"><option>Google</option><option>OpenAI</option></select></div>
                                <div className="space-y-1"><label className="text-[10px] font-black uppercase tracking-widest ml-1">API Key</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste Key..." className="w-full px-4 py-3 rounded-2xl border-2 border-[#1a1a1a] font-bold outline-none" required /></div>
                            </div>
                            <button type="button" onClick={testConnection} disabled={isTesting} className={`w-full py-2 rounded-xl border-2 border-[#1a1a1a] font-black text-[10px] transition-all flex items-center justify-center gap-2 ${testStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-50'}`}>{isTesting ? 'Testing...' : testStatus === 'success' ? 'CONNECTION VERIFIED' : 'TEST API CONNECTION'}</button>
                            <div className="space-y-1"><div className="flex justify-between items-end mb-1"><label className="text-[10px] font-black uppercase tracking-widest ml-1">Behavior Prompt</label><span className="text-[9px] font-black text-red-500 flex items-center gap-1"><ShieldAlert size={10} /> Bee Law Applied</span></div><textarea value={newAgentPrompt} onChange={(e) => setNewAgentPrompt(e.target.value)} placeholder="Define strategy..." className="w-full h-32 px-5 py-4 rounded-2xl border-2 border-[#1a1a1a] font-bold outline-none resize-none bg-[#fdfcf0]" required /></div>
                            <button type="submit" disabled={testStatus !== 'success'} className="w-full py-4 bg-[#1a1a1a] text-white rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_#FFD700] disabled:opacity-30 transition-all uppercase">HATCH AGENT</button>
                        </form>
                    </div>
                </div>
            )}

            {/* 3. Main App Container */}
            <div className={`flex-1 flex flex-col h-full transition-opacity duration-300 ${isLoginVisible ? 'opacity-0' : 'opacity-100'}`}>
                <header className="h-20 bg-white border-b-4 border-[#1a1a1a] flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentMode('overview')}><div className="w-10 h-10 bg-[#1a1a1a] text-[#FFD700] rounded-full border-2 border-[#1a1a1a] flex items-center justify-center shadow-[2px_2px_0px_0px_#1a1a1a]"><Hexagon className="w-6 h-6 fill-current" /></div><span className="text-2xl font-black italic tracking-tighter uppercase">Proo bee</span></div>
                    <div className="flex items-center gap-4">
                        <button onClick={toggleMode} className={`px-6 py-2 rounded-xl border-2 border-[#1a1a1a] font-black shadow-[4px_4px_0px_0px_#1a1a1a] flex items-center gap-2 transition-all ${currentMode === 'agent-detail' ? 'bg-[#1a1a1a] text-white' : 'bg-[#FFD700]'}`}>{currentMode === 'agent-detail' ? <ArrowLeft size={18} /> : <Bot size={18} />}<span className="text-sm uppercase tracking-wider">{currentMode === 'agent-detail' ? 'Back' : 'My Agent'}</span></button>
                        <div onClick={handleLogout} className="w-10 h-10 rounded-full bg-white border-2 border-[#1a1a1a] flex items-center justify-center cursor-pointer hover:bg-red-50 transition-colors shadow-[2px_2px_0px_0px_#1a1a1a]"><LogOut size={18} /></div>
                    </div>
                </header>

                <main className="flex-1 p-6 overflow-hidden">
                    {currentMode === 'overview' ? (
                        <div className="flex flex-col h-full gap-6">
                            <div className="grid grid-cols-3 gap-6 shrink-0">
                                <div className="bg-white rounded-3xl border-2 border-[#1a1a1a] p-5 shadow-[4px_4px_0px_0px_#1a1a1a]"><span className="text-[#1a1a1a]/40 text-xs font-black uppercase flex items-center gap-2"><Users size={12} /> Active Agents</span><span className="text-4xl font-black tracking-tighter">{activeAgentsCount}</span></div>
                                <div className="bg-white rounded-3xl border-2 border-[#1a1a1a] p-5 shadow-[4px_4px_0px_0px_#1a1a1a]"><span className="text-[#1a1a1a]/40 text-xs font-black uppercase flex items-center gap-2"><TrendingUp size={12} /> Daily Yield</span><span className={`text-4xl font-black tracking-tighter ${avgYield >= 0 ? 'text-green-500' : 'text-red-500'}`}>{avgYield >= 0 ? '+' : ''}{avgYield.toFixed(2)}%</span></div>
                                <div className="bg-white rounded-3xl border-2 border-[#1a1a1a] p-5 shadow-[4px_4px_0px_0px_#1a1a1a]"><span className="text-[#1a1a1a]/40 text-xs font-black uppercase flex items-center gap-2"><Bitcoin size={12} className="text-[#FFD700]" /> BTC Price</span><span className="text-4xl font-black tracking-tighter">{btcPrice}</span></div>
                            </div>

                            <div className="flex-1 flex gap-6 overflow-hidden">
                                <div className="flex-[2] bg-white rounded-3xl border-2 border-[#1a1a1a] flex flex-col overflow-hidden shadow-[4px_4px_0px_0px_#1a1a1a]">
                                    <div className="p-4 border-b-2 border-[#1a1a1a] flex justify-between bg-[#fdfcf0] items-center">
                                        <div className="flex gap-4 items-center"><h2 className="font-black text-sm uppercase flex items-center gap-2"><Activity size={16} className="text-[#FFD700]" /> Market Arena</h2>
                                            <div className="flex border-2 border-[#1a1a1a] rounded-lg overflow-hidden shadow-[2px_2px_0px_0px_#1a1a1a]"><button onClick={() => setChartType('line')} className={`p-1.5 ${chartType === 'line' ? 'bg-[#FFD700]' : 'bg-white'} border-r-2 border-[#1a1a1a]`}><LineIcon size={16} /></button><button onClick={() => setChartType('candle')} className={`p-1.5 ${chartType === 'candle' ? 'bg-[#FFD700]' : 'bg-white'}`}><CandlestickIcon size={16} /></button></div></div>
                                        <div className="flex gap-2">{(['1h', '1d', '1w'] as TimeFilter[]).map(f => (<button key={f} onClick={() => setTimeFilter(f)} className={`px-3 py-1 rounded-lg border-2 border-[#1a1a1a] text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_#1a1a1a] ${timeFilter === f ? 'bg-[#FFD700]' : 'bg-white'}`}>{f}</button>))}</div>
                                    </div>
                                    <div className="flex-1 relative bg-white flex items-center justify-center p-4 pt-10">
                                        <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 300" preserveAspectRatio="none">
                                            {chartMetrics && [0, 0.5, 1].map(v => (<text key={v} x="75" y={300 - 40 - v * 220} textAnchor="end" className="text-[20px] font-black opacity-20 fill-black italic">${(chartMetrics.min + v * chartMetrics.range).toLocaleString(undefined, { maximumFractionDigits: 0 })}</text>))}
                                            {marketData.length > 0 && [0, Math.floor(marketData.length / 2), marketData.length - 1].map(idx => (<text key={idx} x={getX(idx)} y="295" textAnchor="middle" className="text-[20px] font-black opacity-20 fill-black italic">{new Date(marketData[idx][0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</text>))}
                                            {chartType === 'line' ? (<path d={marketData.length > 0 ? `M ${marketData.map((_, i) => `${getX(i)} ${getY(parseFloat(marketData[i][4]))}`).join(' L ')}` : ''} fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />) : (marketData.map((d, i) => { const o = parseFloat(d[1]), h = parseFloat(d[2]), l = parseFloat(d[3]), c = parseFloat(d[4]), isUp = c >= o, x = getX(i), cw = (800 / marketData.length) * 0.6; return (<g key={i}><line x1={x} y1={getY(h)} x2={x} y2={getY(l)} stroke="#1a1a1a" strokeWidth="2" /><rect x={x - cw / 2} y={getY(isUp ? c : o)} width={cw} height={Math.max(2, Math.abs(getY(c) - getY(o)))} fill={isUp ? '#22c55e' : '#ef4444'} stroke="#1a1a1a" strokeWidth="2" rx="2" /></g>); }))}
                                        </svg>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col gap-6">
                                    <div className="flex-1 bg-white rounded-3xl border-2 border-[#1a1a1a] flex flex-col overflow-hidden shadow-[4px_4px_0px_0px_#1a1a1a]"><div className="p-3 bg-[#FFD700] border-b-2 border-[#1a1a1a] font-black text-xs uppercase flex items-center gap-2"><Radio size={12} /> Live Reasoning</div><div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fdfcf0]">{reasoningLogs.length > 0 ? reasoningLogs.map((l, i) => (<div key={i} className="bg-white p-3 rounded-2xl border-2 border-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a]"><p className="text-[11px] font-bold italic leading-tight">"{l.content}"</p><p className="text-[8px] mt-1 opacity-40 text-right">{new Date(l.created_at).toLocaleTimeString()}</p></div>)) : <p className="text-[11px] opacity-40 italic text-center py-10">Waiting for bee thoughts...</p>}</div></div>
                                    <div className="h-48 bg-white rounded-3xl border-2 border-[#1a1a1a] overflow-hidden shadow-[4px_4px_0px_0px_#1a1a1a]"><div className="p-3 bg-[#FFD700] border-b-2 border-[#1a1a1a] font-black text-xs uppercase flex justify-between items-center"><span><Trophy size={12} className="inline mr-1" /> Top Yield</span></div><div className="overflow-y-auto h-full px-3 py-2">{topYields.map((r, i) => (<div key={i} className="flex justify-between items-center py-2 border-b border-[#1a1a1a]/5 transition-colors"><span className="text-[11px] font-black italic">{i + 1 < 10 ? `0${i + 1}` : i + 1}. {r.name}</span><span className="text-[11px] font-black text-green-600">+{r.yield}%</span></div>))}</div></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* MY AGENT CONSOLE */
                        <div className="h-full flex flex-col items-center justify-center gap-6 overflow-y-auto py-10 px-4">
                            <div className="bg-white p-10 rounded-[3rem] border-4 border-[#1a1a1a] shadow-[8px_8px_0px_0px_#1a1a1a] text-center max-w-2xl w-full">
                                <Bot size={48} className="mx-auto mb-4" />
                                <h2 className="text-4xl font-black italic tracking-tighter mb-8 uppercase">My Agent Console</h2>
                                <div className="space-y-4 mb-10 text-left">
                                    <label className="text-[10px] font-black uppercase tracking-widest ml-4">Hive Status & Controls</label>
                                    <div className="space-y-3 max-h-72 overflow-y-auto p-2 scrollbar-hide">
                                        {allAgents.length > 0 ? allAgents.map((agent) => {
                                            const isActive = agent.status === 'active' || agent.status === null;
                                            return (
                                                <div key={agent.id} className="bg-[#fdfcf0] p-5 rounded-2xl border-2 border-[#1a1a1a] flex justify-between items-center shadow-[4px_4px_0px_0px_#1a1a1a]">
                                                    <div className="flex items-center gap-4"><div className={`w-3 h-3 rounded-full border border-[#1a1a1a] ${isActive ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} /><div><div className="text-[8px] font-black uppercase opacity-40">Agent Name</div><div className="text-lg font-black italic uppercase tracking-tighter leading-tight">{agent.name}</div></div></div>
                                                    <div className="flex items-center gap-3"><span className={`text-[10px] font-black px-2 py-1 rounded-md border-2 border-[#1a1a1a] ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isActive ? 'ACTIVE' : 'PAUSED'}</span><button onClick={() => handleToggleStatus(agent.id, agent.status)} className={`p-3 rounded-xl border-2 border-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a] active:shadow-none transition-all ${isActive ? 'bg-white text-[#1a1a1a]' : 'bg-[#1a1a1a] text-white'}`}>{isActive ? <Pause size={18} /> : <Play size={18} />}</button></div>
                                                </div>
                                            );
                                        }) : <div className="text-center py-10 border-2 border-dashed border-[#1a1a1a]/20 rounded-3xl text-[12px] font-bold opacity-40 italic">Hive is currently empty.</div>}
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => setIsCreateModalOpen(true)} className="flex-1 py-4 bg-[#FFD700] text-[#1a1a1a] border-4 border-[#1a1a1a] rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_#1a1a1a] hover:scale-[1.02] transition-transform uppercase">Hatch New Bee</button>
                                    <button onClick={() => alert("Hive safety protocols engaged.")} className="px-6 py-4 bg-white text-red-500 border-4 border-red-500 rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_#ef4444] hover:bg-red-50 transition-colors uppercase">SOS</button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}