import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bot, 
  Server, 
  Activity, 
  Clock, 
  MessageSquare, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  Settings,
  UserCheck,
  Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';

interface BotStatus {
  status: 'online' | 'offline';
  configStatus?: {
    hasToken: boolean;
    hasClientId: boolean;
  };
  user: string | null;
  guilds: number;
  ping: number;
  uptime: number | null;
}

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

interface Channel {
  id: string;
  name: string;
}

interface Ticket {
  id: string;
  name: string;
  guildName: string;
  createdAt: string;
}

interface Log {
  id: string;
  user: string;
  guild: string;
  timestamp: string;
  transcript: string;
  category: string;
}

// --- AI Summary Component ---
function AISummary({ transcript }: { transcript: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY || '' }), []);

  const generateSummary = async () => {
    if (!transcript) {
      setSummary('No user messages to summarize.');
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Summarize this support ticket briefly (max 2 sentences). Focus on the user's problem and the resolution:\n\n${transcript}`
      });
      setSummary(response.text || 'No summary available.');
    } catch (err) {
      console.error('AI Error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateSummary();
  }, [transcript]);

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-500 text-[10px] animate-pulse">
      <Loader2 className="w-3 h-3 animate-spin" /> Analyzing conversation...
    </div>
  );

  if (error) return (
    <div className="text-red-400 text-[10px] flex items-center gap-1">
      <AlertCircle className="w-3 h-3" /> Failed to generate summary. <button onClick={generateSummary} className="underline cursor-pointer">Retry</button>
    </div>
  );

  return (
    <div className="flex gap-2">
      <Sparkles className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
      <p className="text-xs text-slate-300 leading-relaxed italic border-l border-indigo-500/30 pl-3">
        "{summary}"
      </p>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'panels' | 'permissions' | 'forms'>('dashboard');
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [embedTitle, setEmbedTitle] = useState('🎫 ʀᴇᴀʟᴢʏᴠᴏᴋ ᴀʀᴍʏ | ꜱᴜᴘᴘᴏʀᴛ ᴄᴇɴᴛᴇʀ');
  const [embedDesc, setEmbedDesc] = useState('Welcome to the **Realzyvok Army Support Center**.\nTo provide you with the best experience, please select a category below.\n\n┃ 🛠️ **Support** - General questions.\n┃ 🛡️ **Reports** - Report a user.\n┃ 🤝 **Partners** - Collaborations.\n\n╰ *Please avoid opening multiple tickets.*');
  const [customMessage, setCustomMessage] = useState('');
  const [categories, setCategories] = useState([
    { label: 'General Support', value: 'support', description: 'General questions or help', emoji: '🛠️' },
    { label: 'User Report', value: 'report', description: 'Report a user for any reason', emoji: '🛡️' },
    { label: 'Partnerships', value: 'partner', description: 'Collaboration inquiries', emoji: '🤝' },
    { label: 'Army Inquiries', value: 'army', description: 'Army related questions', emoji: '🏆' },
  ]);

  // Form state
  const [formTitle, setFormTitle] = useState('📝 Staff Application');
  const [formDesc, setFormDesc] = useState('Click the button below to start your application.');
  const [formButton, setFormButton] = useState('Apply Now');
  const [formQuestions, setFormQuestions] = useState([
    'What is your Discord username and age?',
    'Why do you want to become a staff member on this server?',
    'How would you handle a member breaking the rules?',
    'How active can you be on the server each day?',
    'Why should we choose you for the staff team?'
  ]);
  const [staffRoles, setStaffRoles] = useState<string[]>([]);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error('Failed to fetch status');
        const data = await response.json();
        setStatus(data);
        
        if (data.status === 'offline') {
          if (!data.configStatus.hasToken) {
            setError('DISCORD_TOKEN is missing in Secrets.');
          } else {
            setError('Bot is configured but not logged in. Check token validity.');
          }
        } else {
          setError(null);
        }
      } catch (err) {
        setError('Connection to bot server failed.');
      } finally {
        setLoading(false);
      }
    };

    const fetchGuilds = async () => {
      try {
        const response = await fetch('/api/guilds');
        if (response.ok) {
          const data = await response.json();
          setGuilds(data);
          if (data.length > 0) setSelectedGuild(data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch guilds');
      }
    };

    const fetchTickets = async () => {
      try {
        const response = await fetch('/api/tickets');
        if (response.ok) {
          const data = await response.json();
          setTickets(data);
        }
      } catch (err) {
        console.error('Failed to fetch tickets');
      }
    };

    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/logs');
        if (response.ok) {
          const data = await response.json();
          setLogs(data);
        }
      } catch (err) {
        console.error('Failed to fetch logs');
      }
    };

    const fetchPermissions = async () => {
      try {
        const response = await fetch('/api/permissions');
        if (response.ok) {
          const data = await response.json();
          setStaffRoles(data.staffRoleIds || []);
        }
      } catch (err) {
        console.error('Failed to fetch permissions');
      }
    };

    const fetchFormConfig = async () => {
      try {
        const response = await fetch('/api/form_config');
        if (response.ok) {
          const data = await response.json();
          setFormTitle(data.title);
          setFormDesc(data.description);
          setFormButton(data.buttonLabel);
          setFormQuestions(data.questions || []);
        }
      } catch (err) {
        console.error('Failed to fetch form config');
      }
    };

    fetchStatus();
    fetchGuilds();
    fetchTickets();
    fetchLogs();
    fetchPermissions();
    fetchFormConfig();
    const interval = setInterval(() => {
      fetchStatus();
      fetchTickets();
      fetchLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedGuild) return;
    const fetchChannels = async () => {
      try {
        const response = await fetch(`/api/channels/${selectedGuild}`);
        if (response.ok) {
          const data = await response.json();
          setChannels(data);
          if (data.length > 0) setSelectedChannel(data[0].id);
          else setSelectedChannel('');
        }
      } catch (err) {
        console.error('Failed to fetch channels');
      }
    };
    fetchChannels();
  }, [selectedGuild]);

  const handleSendMessage = async () => {
    if (!selectedChannel || !customMessage) return;
    setDeploying(true);
    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannel,
          content: customMessage
        }),
      });
      if (response.ok) {
        alert('✅ Message sent successfully!');
        setCustomMessage('');
      } else {
        throw new Error('Message failed');
      }
    } catch (err) {
      alert('❌ Failed to send message.');
    } finally {
      setDeploying(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedChannel) return;
    setDeploying(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannel,
          title: embedTitle,
          description: embedDesc,
          categories
        }),
      });
      if (response.ok) {
        alert('✅ Panel deployed successfully!');
      } else {
        throw new Error('Deployment failed');
      }
    } catch (err) {
      alert('❌ Failed to deploy panel. Check bot permissions.');
    } finally {
      setDeploying(false);
    }
  };

  const handleDeployForm = async () => {
    if (!selectedChannel) {
      alert('Please select a target channel first.');
      return;
    }
    setDeploying(true);
    try {
      const response = await fetch('/api/setup_form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannel,
          title: formTitle,
          description: formDesc,
          buttonLabel: formButton,
          questions: formQuestions
        }),
      });
      if (response.ok) {
        alert('✅ Application Form deployed successfully!');
      } else {
        throw new Error('Deployment failed');
      }
    } catch (err) {
      alert('❌ Failed to deploy form. Check bot permissions.');
    } finally {
      setDeploying(false);
    }
  };

  const handleSavePermissions = async () => {
    try {
      const response = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: staffRoles })
      });
      if (response.ok) {
        alert('✅ Permissions saved!');
      } else {
        alert('❌ Failed to save permissions.');
      }
    } catch (err) {
      alert('❌ Failed to save permissions.');
    }
  };

  const formatUptime = (ms: number | null) => {
    if (!ms) return '0s';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
  };

  return (
    <div className="flex h-screen w-full bg-[#0F172A] text-slate-200 overflow-hidden font-sans select-none">
      {/* Left Sidebar */}
      <div className="w-64 bg-[#0A0F1E] flex flex-col border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">R</div>
          <span className="font-bold text-lg tracking-tight text-white">ʀᴇᴀʟᴢʏᴠᴏᴋ</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 px-2 tracking-widest">Management</div>
          <SidebarItem label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem label="Active Tickets" active={false} />
          <SidebarItem label="Transcript Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          
          <div className="mt-6 text-[10px] uppercase font-bold text-slate-500 mb-2 px-2 tracking-widest">Bot Configuration</div>
          <SidebarItem label="Dropdown Panels" active={activeTab === 'panels'} onClick={() => setActiveTab('panels')} />
          <SidebarItem label="Application Forms" active={activeTab === 'forms'} onClick={() => setActiveTab('forms')} />
          <SidebarItem label="Permissions" active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} />
        </nav>
        <div className="p-4 bg-slate-900/50 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
              <Bot className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">{status?.user?.split('#')[0] || 'Bot Offline'}</div>
              <div className="text-[10px] text-slate-500">System Instance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">Project: Dashboard Central</h1>
            <span className={`px-2 py-0.5 rounded text-[10px] border font-mono ${
              status?.status === 'online' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {status?.status === 'online' ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-1.5 bg-slate-800 rounded text-xs font-semibold hover:bg-slate-700 transition-colors border border-slate-700">Discard</button>
            <button 
              onClick={handleDeploy}
              disabled={deploying || !selectedChannel}
              className="px-4 py-1.5 bg-indigo-600 rounded text-xs font-semibold hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20 text-white disabled:opacity-50"
            >
              {deploying ? 'Deploying...' : 'Publish Changes'}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto scrollbar-hide">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {error && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center gap-3 text-amber-200 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {activeTab === 'dashboard' ? (
              <>
                {/* Analytics Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <AnalyticsCard label="Guild Count" value={status?.guilds ?? 0} />
                  <AnalyticsCard label="API Latency" value={status?.ping ? `${status.ping}ms` : '--'} color="text-indigo-400" />
                  <AnalyticsCard label="Active Tickets" value={(status as any)?.activeTickets ?? 0} color="text-emerald-400" />
                  <AnalyticsCard label="System Uptime" value={formatUptime(status?.uptime ?? 0)} />
                </div>

                <div className="grid grid-cols-12 gap-6">
                  {/* Left Column: Config */}
                  <div className="col-span-12 lg:col-span-5 space-y-6">
                    <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50 backdrop-blur-sm">
                      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">1. Target Information</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block mb-1">Select Server</label>
                          <select 
                            value={selectedGuild}
                            onChange={(e) => setSelectedGuild(e.target.value)}
                            className="w-full bg-[#0A0F1E] border border-slate-700 rounded p-2 text-sm text-slate-200"
                          >
                            {guilds.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block mb-1">Target Channel</label>
                          <select 
                            value={selectedChannel}
                            onChange={(e) => setSelectedChannel(e.target.value)}
                            className="w-full bg-[#0A0F1E] border border-slate-700 rounded p-2 text-sm text-slate-200"
                          >
                            <option value="">Select a channel...</option>
                            {channels.map(c => (
                              <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <button 
                          onClick={activeTab === 'forms' ? handleDeployForm : handleDeploy}
                          disabled={deploying || !selectedChannel}
                          className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 text-white disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> {activeTab === 'forms' ? 'Send App Form' : 'Send Ticket Panel'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50 backdrop-blur-sm">
                      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
                        {activeTab === 'forms' ? '2. Form Visuals' : '2. Embed Visuals'}
                      </h2>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block mb-1">Embed Title</label>
                          <input 
                            type="text" 
                            value={activeTab === 'forms' ? formTitle : embedTitle}
                            onChange={(e) => activeTab === 'forms' ? setFormTitle(e.target.value) : setEmbedTitle(e.target.value)}
                            className="w-full bg-[#0A0F1E] border border-slate-700 rounded p-2 text-sm text-slate-200" 
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block mb-1">Description Text</label>
                          <textarea 
                            value={activeTab === 'forms' ? formDesc : embedDesc}
                            onChange={(e) => activeTab === 'forms' ? setFormDesc(e.target.value) : setEmbedDesc(e.target.value)}
                            className="w-full bg-[#0A0F1E] border border-slate-700 rounded p-2 text-sm h-16 resize-none text-slate-200" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50 backdrop-blur-sm">
                      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">3. Quick Send</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block mb-1">Raw Message Content</label>
                          <textarea 
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            placeholder="Type a message to send as the bot..."
                            className="w-full bg-[#0A0F1E] border border-slate-700 rounded p-2 text-sm h-20 resize-none text-slate-200 focus:border-indigo-500/50 outline-none transition-all" 
                          />
                        </div>
                        <button 
                          onClick={handleSendMessage}
                          disabled={deploying || !customMessage || !selectedChannel}
                          className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 text-white disabled:opacity-50 shadow-lg shadow-black/20"
                        >
                          <Send className="w-3.5 h-3.5" /> Send Message
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Tickets</h2>
                        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{tickets.length} TOTAL</span>
                      </div>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                        {tickets.length > 0 ? tickets.map(ticket => (
                          <div key={ticket.id} className="bg-[#0A0F1E] p-3 rounded border border-slate-700 flex items-center justify-between group hover:border-slate-600 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${ticket.name.startsWith('bug') ? 'bg-red-400' : ticket.name.startsWith('billing') ? 'bg-amber-400' : 'bg-blue-400'}`} />
                              <div>
                                <div className="text-xs font-bold text-slate-200">{ticket.name}</div>
                                <div className="text-[10px] text-slate-500">{ticket.guildName}</div>
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-600 font-mono">
                              {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-8 text-slate-500 text-xs">No active tickets found.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Preview Area */}
                  <div className="col-span-12 lg:col-span-7">
                    <div className="bg-[#313338] rounded-2xl border border-black/20 shadow-2xl p-8 relative min-h-[400px]">
                      <div className="absolute top-4 left-6 text-[10px] text-slate-500 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                        #{channels.find(c => c.id === selectedChannel)?.name || 'support-setup'}
                      </div>
                      
                      <div className="mt-8 flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center font-bold text-white">R</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-white text-sm">ʀᴇᴀʟᴢʏᴠᴏᴋ</span>
                            <span className="bg-[#5865F2] text-[9px] px-1 rounded text-white font-bold">BOT</span>
                            <span className="text-[10px] text-slate-400">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          
                          <div className="bg-[#2B2D31] border-l-4 border-indigo-500 p-4 rounded max-w-lg shadow-sm">
                            <h3 className="font-bold text-white mb-2 text-sm">{activeTab === 'forms' ? formTitle : embedTitle}</h3>
                            <div className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {(activeTab === 'forms' ? formDesc : embedDesc).split('\n').map((line, i) => (
                                <React.Fragment key={i}>
                                  {line.startsWith('┃') ? (
                                    <span className="text-indigo-400 font-bold">{line.substring(0, 1)}</span>
                                  ) : null}
                                  {line.startsWith('┃') ? line.substring(1) : line}
                                  <br />
                                </React.Fragment>
                              ))}
                            </div>
                          </div>

                          <div className="mt-3 max-w-lg">
                            {activeTab === 'forms' ? (
                              <button className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] rounded text-white text-sm font-medium transition-colors">
                                {formButton}
                              </button>
                            ) : (
                              <>
                                <div className="bg-[#1E1F22] border border-[#111214] rounded p-2.5 flex items-center justify-between text-xs text-slate-300 cursor-default">
                                  <span>Select a ticket category...</span>
                                  <ChevronRight className="w-4 h-4 text-slate-500 rotate-90" />
                                </div>
                                <div className="mt-4 flex gap-2">
                                  {categories.slice(0, 3).map(cat => (
                                    <div key={cat.value} className="px-3 py-1.5 bg-[#4E5058] hover:bg-[#6D6F78] rounded text-white text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5">
                                      <span>{cat.emoji}</span>
                                      {cat.label}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : activeTab === 'logs' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Transcript Logs</h2>
                    <p className="text-slate-500 text-sm">AI-powered summaries of closed ticket conversations.</p>
                  </div>
                  <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                    {logs.length} Recent Logs
                  </div>
                </div>

                <div className="grid gap-4">
                  {logs.length > 0 ? logs.map(log => (
                    <div key={log.id} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm group hover:border-indigo-500/30 transition-all">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold">
                            {log.user.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              {log.user}
                              <span className="px-2 py-0.5 bg-slate-700 rounded text-[9px] text-slate-400 uppercase">{log.category}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">{log.guild} • {new Date(log.timestamp).toLocaleString()}</div>
                          </div>
                        </div>
                        <button className="text-xs font-semibold text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                          Full Transcript <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="p-4 bg-black/20 rounded-xl border border-white/5 relative">
                        <div className="absolute top-[-8px] left-4 px-2 bg-slate-900 text-[9px] font-bold text-indigo-400 uppercase tracking-widest border border-slate-800 rounded">
                          AI Summary
                        </div>
                        <AISummary transcript={log.transcript} />
                      </div>
                    </div>
                  )) : (
                    <div className="p-20 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                      <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                        <MessageSquare className="w-8 h-8" />
                      </div>
                      <h3 className="text-white font-bold mb-1">No logs available</h3>
                      <p className="text-slate-500 text-sm">Summaries will appear here automatically when tickets are closed.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'panels' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Dropdown Panels</h2>
                    <p className="text-slate-500 text-sm">Configure categories and descriptions for your ticket selection menu.</p>
                  </div>
                  <button 
                    onClick={() => setCategories([...categories, { label: 'New Category', value: 'new', description: 'Brief description', emoji: '🎫' }])}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
                  >
                    <Plus className="w-4 h-4" /> Add Category
                  </button>
                </div>

                <div className="grid gap-4">
                  {categories.map((cat, idx) => (
                    <div key={idx} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm flex gap-6 items-start">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl">
                        <input 
                          type="text" 
                          value={cat.emoji} 
                          onChange={(e) => {
                            const newCats = [...categories];
                            newCats[idx].emoji = e.target.value;
                            setCategories(newCats);
                          }}
                          className="bg-transparent w-full text-center focus:outline-none" 
                        />
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pl-1">Label</label>
                          <input 
                            type="text" 
                            value={cat.label}
                            onChange={(e) => {
                              const newCats = [...categories];
                              newCats[idx].label = e.target.value;
                              setCategories(newCats);
                            }}
                            className="w-full bg-[#0A0F1E] border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-indigo-500/50 transition-colors" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pl-1">Value (ID)</label>
                          <input 
                            type="text" 
                            value={cat.value}
                            onChange={(e) => {
                              const newCats = [...categories];
                              newCats[idx].value = e.target.value;
                              setCategories(newCats);
                            }}
                            className="w-full bg-[#0A0F1E] border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-indigo-500/50 transition-colors" 
                          />
                        </div>
                        <div className="col-span-full space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pl-1">Short Description</label>
                          <input 
                            type="text" 
                            value={cat.description}
                            onChange={(e) => {
                              const newCats = [...categories];
                              newCats[idx].description = e.target.value;
                              setCategories(newCats);
                            }}
                            className="w-full bg-[#0A0F1E] border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-indigo-500/50 transition-colors" 
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => setCategories(categories.filter((_, i) => i !== idx))}
                        className="p-2 text-slate-500 hover:text-red-400 transition-colors mt-6"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === 'forms' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Application Forms Builder</h2>
                    <p className="text-slate-500 text-sm">Create forms where the bot asks standard questions in a modal.</p>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-6">
                  {/* Left Column: Form Settings */}
                  <div className="col-span-12 lg:col-span-8 space-y-6">
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm space-y-4">
                      <h3 className="font-bold text-white">Form Button Setting</h3>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest pl-1 mb-1 block">Button Label</label>
                        <input 
                          type="text" 
                          value={formButton}
                          onChange={(e) => setFormButton(e.target.value)}
                          className="w-full max-w-md bg-[#0A0F1E] border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200" 
                        />
                      </div>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-white">Form Questions <span className="text-xs font-normal text-slate-500">(Unlimited Supported)</span></h3>
                        <button 
                          onClick={() => setFormQuestions([...formQuestions, 'New Question'])}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white transition-colors flex items-center gap-2"
                        >
                          <Plus className="w-3 h-3" /> Add Question
                        </button>
                      </div>
                      <div className="space-y-3">
                        {formQuestions.map((q, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                            <span className="text-indigo-400 font-bold w-6 text-center">{idx + 1}.</span>
                            <input 
                              type="text" 
                              value={q}
                              onChange={(e) => {
                                const newQ = [...formQuestions];
                                newQ[idx] = e.target.value;
                                setFormQuestions(newQ);
                              }}
                              className="flex-1 bg-[#0A0F1E] border border-slate-700 rounded p-2 text-sm text-slate-200" 
                            />
                            <button 
                              onClick={() => setFormQuestions(formQuestions.filter((_, i) => i !== idx))}
                              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/save_form', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                title: formTitle,
                                description: formDesc,
                                buttonLabel: formButton,
                                questions: formQuestions
                              })
                            });
                            if (res.ok) alert('✅ Form configuration saved!');
                            else alert('❌ Failed to save form.');
                          } catch (err) {
                            alert('❌ Failed to save form.');
                          }
                        }}
                        className="w-full mt-6 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold text-white transition-all shadow-lg"
                      >
                        Save Form Configuration
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Deployment */}
                  <div className="col-span-12 lg:col-span-4 space-y-6">
                    <div className="bg-slate-800/40 rounded-xl p-6 border border-slate-700/50 backdrop-blur-sm">
                      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Target Information</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block mb-1">Select Server</label>
                          <select 
                            value={selectedGuild}
                            onChange={(e) => setSelectedGuild(e.target.value)}
                            className="w-full bg-[#0A0F1E] border border-slate-700 rounded p-2 text-sm text-slate-200"
                          >
                            {guilds.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500 font-medium block mb-1">Target Channel</label>
                          <select 
                            value={selectedChannel}
                            onChange={(e) => setSelectedChannel(e.target.value)}
                            className="w-full bg-[#0A0F1E] border border-slate-700 rounded p-2 text-sm text-slate-200"
                          >
                            <option value="">Select a channel...</option>
                            {channels.map(c => (
                              <option key={c.id} value={c.id}>#{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <button 
                          onClick={handleDeployForm}
                          disabled={deploying || !selectedChannel}
                          className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 text-white disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Send App Form
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Permissions</h2>
                    <p className="text-slate-500 text-sm">Control who can manage and respond to tickets.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-white">Staff Roles</h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Members with these roles will be able to see and respond to ticket channels. Enter a Role ID or leave blank for server owners only.
                    </p>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="e.g. 123456789012345678"
                          value={newRoleInput}
                          onChange={(e) => setNewRoleInput(e.target.value)}
                          className="flex-1 bg-[#0A0F1E] border border-slate-700 rounded-lg p-2.5 text-sm text-slate-200 focus:border-indigo-500/50 outline-none transition-all"
                        />
                        <button 
                          onClick={() => {
                            if (newRoleInput && !staffRoles.includes(newRoleInput)) {
                              setStaffRoles([...staffRoles, newRoleInput]);
                              setNewRoleInput('');
                            }
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-bold transition-all"
                        >
                          Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {staffRoles.map(role => (
                          <div key={role} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                            <span className="text-sm text-slate-300 font-mono">{role}</span>
                            <button 
                              onClick={() => setStaffRoles(staffRoles.filter(r => r !== role))}
                              className="text-slate-500 hover:text-red-400 transition-colors p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button 
                        onClick={handleSavePermissions}
                        className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold text-white transition-all shadow-lg shadow-indigo-600/20"
                      >
                        Save Settings
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <Settings className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-white">Global Settings</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                        <div>
                          <div className="text-[13px] font-bold text-white">Close Confirmation</div>
                          <div className="text-[11px] text-slate-500">Ask users before deleting channel</div>
                        </div>
                        <div className="w-10 h-5 bg-indigo-600 rounded-full relative cursor-pointer">
                          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 opacity-50 cursor-not-allowed">
                        <div>
                          <div className="text-[13px] font-bold text-white">Transcript Archiving</div>
                          <div className="text-[11px] text-slate-500">Enable AI-powered ticket summaries</div>
                        </div>
                        <div className="w-10 h-5 bg-slate-700 rounded-full relative">
                          <div className="absolute right-1 top-1 w-3 h-3 bg-white/50 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, active = false, onClick }: { label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`px-3 py-2 rounded flex items-center justify-between text-sm cursor-pointer transition-colors ${
      active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
    }`}>
      <span>{label}</span>
      {active && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]"></div>}
    </div>
  );
}

function AnalyticsCard({ label, value, color = "text-white" }: { label: string, value: string | number, color?: string }) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-center">
      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{label}</span>
      <span className={`text-xl font-bold tracking-tight mt-1 ${color}`}>{value}</span>
    </div>
  );
}

function GuideStep({ num, title, desc }: { num: string, title: string, desc: string }) {
  return (
    <div className="flex gap-4 group">
      <div className="text-[11px] font-mono text-indigo-500 font-bold bg-indigo-500/5 border border-indigo-500/20 w-8 h-8 rounded flex items-center justify-center shrink-0">
        {num}
      </div>
      <div>
        <div className="text-[13px] font-bold text-slate-200">{title}</div>
        <div className="text-[11px] text-slate-500 mt-0.5 leading-normal">{desc}</div>
      </div>
    </div>
  );
}
