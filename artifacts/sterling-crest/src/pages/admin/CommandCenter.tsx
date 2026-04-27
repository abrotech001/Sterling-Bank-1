import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, AlertCircle, CheckCircle, XCircle, 
  Wallet, ShieldAlert, CreditCard, Activity, Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Mock types until we connect the backend
type PendingTask = { id: number; type: "kyc" | "transaction" | "card" | "swap"; title: string; subtitle: string; amount?: string; date: string };
type UserStats = { id: number; username: string; email: string; balance: string; status: "active" | "frozen" };

export default function AdminCommandCenter() {
  const [activeTab, setActiveTab] = useState<"approvals" | "users" | "logs">("approvals");
  
  // These will be fetched from your backend in Step 2
  const [tasks, setTasks] = useState<PendingTask[]>([
    { id: 1, type: "transaction", title: "Transfer Request", subtitle: "User #4 to Account 0987654321", amount: "$500.00", date: "10 mins ago" },
    { id: 2, type: "kyc", title: "KYC Tier 3 Upload", subtitle: "Proof of Address - User @abro", date: "1 hour ago" },
    { id: 3, type: "card", title: "Virtual Card Activation", subtitle: "User #12", fee: "$5.00", date: "2 hours ago" } as any
  ]);

  const [users, setUsers] = useState<UserStats[]>([
    { id: 4, username: "abro", email: "abro@example.com", balance: "$12,450.00", status: "active" },
    { id: 5, username: "john_doe", email: "john@test.com", balance: "$0.00", status: "frozen" }
  ]);

  const handleAction = async (taskId: number, action: "approve" | "reject") => {
    // Optimistic UI removal
    setTasks(prev => prev.filter(t => t.id !== taskId));
    
    // In Step 2, we will add the real API call here:
    // await fetch(`/api/admin/tasks/${taskId}/${action}`, { method: 'POST', ... })
    alert(`Task #${taskId} ${action}d successfully!`);
  };

  const handleUserAction = (userId: number, action: "freeze" | "unfreeze" | "fund") => {
    alert(`Action [${action}] triggered for User #${userId}. We will wire this to the backend next!`);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 md:flex-row font-sans">
      
      {/* --- DESKTOP SIDEBAR (Hidden on Mobile) --- */}
      <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white p-4 shrink-0">
        <div className="font-bold text-xl mb-8 tracking-tight">Crestfield Admin</div>
        <div className="space-y-2">
          <NavItem icon={<AlertCircle/>} label="Approvals" active={activeTab === "approvals"} onClick={() => setActiveTab("approvals")} badge={tasks.length} />
          <NavItem icon={<Users/>} label="User Management" active={activeTab === "users"} onClick={() => setActiveTab("users")} />
          <NavItem icon={<Activity/>} label="System Logs" active={activeTab === "logs"} onClick={() => setActiveTab("logs")} />
        </div>
      </div>

      {/* --- MOBILE TOP HEADER --- */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="font-bold tracking-tight">Admin Center</div>
        {activeTab === "approvals" && tasks.length > 0 && (
          <span className="bg-rose-500 text-white text-[10px] px-2 py-1 rounded-full font-bold">
            {tasks.length} Pending
          </span>
        )}
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
        
        {/* APPROVALS TAB */}
        {activeTab === "approvals" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-xl font-bold text-slate-800 mb-6 hidden md:block">Pending Action Queue</h2>
            
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <CheckCircle className="w-16 h-16 mb-4 opacity-20" />
                <p>All caught up! No pending requests.</p>
              </div>
            ) : (
              <AnimatePresence>
                {tasks.map(task => (
                  <motion.div 
                    key={task.id}
                    exit={{ opacity: 0, x: -50 }}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-3 rounded-xl shrink-0 ${
                        task.type === 'kyc' ? 'bg-blue-100 text-blue-600' :
                        task.type === 'transaction' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        {task.type === 'kyc' ? <ShieldAlert className="w-6 h-6"/> :
                         task.type === 'transaction' ? <Wallet className="w-6 h-6"/> :
                         <CreditCard className="w-6 h-6"/>}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{task.title}</h3>
                        <p className="text-sm text-slate-500">{task.subtitle}</p>
                        {task.amount && <p className="font-bold text-emerald-600 mt-1">{task.amount}</p>}
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{task.date}</p>
                      </div>
                    </div>
                    
                    <div className="flex sm:flex-col gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-4 mt-2 sm:mt-0">
                      <Button onClick={() => handleAction(task.id, "approve")} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-9">
                        <CheckCircle className="w-4 h-4"/> Accept
                      </Button>
                      <Button onClick={() => handleAction(task.id, "reject")} variant="outline" className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1 h-9">
                        <XCircle className="w-4 h-4"/> Decline
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search user ID, email, or username..." className="pl-9 bg-white" />
              </div>
            </div>

            {users.map(user => (
              <div key={user.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800">@{user.username}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {user.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{user.email} • ID: #{user.id}</p>
                  <p className="font-mono text-sm mt-1 text-slate-600">Bal: {user.balance}</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button onClick={() => handleUserAction(user.id, "fund")} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    Fund
                  </Button>
                  {user.status === 'active' ? (
                    <Button onClick={() => handleUserAction(user.id, "freeze")} size="sm" variant="outline" className="flex-1 border-rose-200 text-rose-600">
                      Freeze
                    </Button>
                  ) : (
                    <Button onClick={() => handleUserAction(user.id, "unfreeze")} size="sm" variant="outline" className="flex-1 border-emerald-200 text-emerald-600">
                      Unfreeze
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MOBILE BOTTOM NAVIGATION (Hidden on Desktop) --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-safe z-20">
        <MobileTab icon={<AlertCircle/>} label="Approvals" active={activeTab === "approvals"} onClick={() => setActiveTab("approvals")} badge={tasks.length}/>
        <MobileTab icon={<Users/>} label="Users" active={activeTab === "users"} onClick={() => setActiveTab("users")} />
        <MobileTab icon={<Activity/>} label="Logs" active={activeTab === "logs"} onClick={() => setActiveTab("logs")} />
      </div>
    </div>
  );

  function NavItem({ icon, label, active, onClick, badge }: any) {
    return (
      <button onClick={onClick} className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
        <div className="flex items-center gap-3">{icon} <span className="font-medium">{label}</span></div>
        {badge > 0 && <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{badge}</span>}
      </button>
    );
  }

  function MobileTab({ icon, label, active, onClick, badge }: any) {
    return (
      <button onClick={onClick} className={`relative flex flex-col items-center p-2 min-w-[70px] ${active ? 'text-slate-900' : 'text-slate-400'}`}>
        {badge > 0 && <span className="absolute top-1 right-2 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold border-2 border-white">{badge}</span>}
        <div className={`mb-1 transition-transform ${active ? 'scale-110' : ''}`}>{icon}</div>
        <span className="text-[10px] font-medium">{label}</span>
      </button>
    );
  }
}
