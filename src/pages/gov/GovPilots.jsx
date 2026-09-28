import { useState } from 'react';
import {
  getPilots,
  toggleMilestone,
  disburseMilestonePayment
} from '../../services/pilotService';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  CreditCard,
  X
} from 'lucide-react';

export default function GovPilots() {
  const [pilots, setPilots] = useState(() => getPilots());
  const [activePilotId, setActivePilotId] = useState(() => {
    const loaded = getPilots();
    return loaded.length > 0 ? loaded[0].id : '';
  });
  const [paymentModal, setPaymentModal] = useState(null);

  const activePilot = pilots.find((p) => p.id === activePilotId) || pilots[0];

  const handleMilestoneToggle = (mId) => {
    const updated = toggleMilestone(activePilot.id, mId);
    setPilots([...updated]);
  };

  const handleConfirmDisbursement = () => {
    if (!paymentModal) return;
    const updated = disburseMilestonePayment(activePilot.id, paymentModal.id);
    setPilots([...updated]);
    setPaymentModal(null);
  };

  if (!activePilot) {
    return <div style={{ color: '#fff', padding: '2rem' }}>Loading Pilots...</div>;
  }

  const verifiedCount = activePilot.milestones.filter((m) => m.verified).length;
  const budgetPercentage = Math.round((activePilot.budgetSpent / activePilot.totalBudget) * 100);

  return (
    <div style={{ padding: '2rem', color: '#fff', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            PROJECTS & KPI MONITORING
          </h1>
          <p style={{ color: '#a1a1aa', margin: '0.35rem 0 0 0', fontSize: '0.875rem' }}>
            Milestone verification, sensor telemetry, and performance-linked disbursements.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 700 }}>ACTIVE PILOT:</span>
          <select
            value={activePilot.id}
            onChange={(e) => setActivePilotId(e.target.value)}
            style={{
              backgroundColor: '#18181b',
              color: '#fff',
              border: '1px solid #27272a',
              borderRadius: '8px',
              padding: '0.5rem 1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {pilots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.startupName} ({p.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Deployment Progress</span>
            <TrendingUp size={16} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{activePilot.deploymentProgress}%</div>
        </div>

        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Health Status</span>
            <AlertTriangle size={16} color={activePilot.status === 'On Track' ? '#22c55e' : '#f59e0b'} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: activePilot.status === 'On Track' ? '#22c55e' : '#f59e0b' }}>
            {activePilot.status}
          </div>
        </div>

        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Milestones Verified</span>
            <CheckCircle size={16} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {verifiedCount} / {activePilot.milestones.length}
          </div>
        </div>

        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Funds Disbursed</span>
            <DollarSign size={16} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {budgetPercentage}% <span style={{ fontSize: '0.8rem', color: '#71717a' }}>(₹{(activePilot.budgetSpent / 100000).toFixed(1)}L / ₹{(activePilot.totalBudget / 100000).toFixed(1)}L)</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Milestone Verification & Payment List */}
        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#eab308" /> Delivery Milestones & Payouts
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>ESCROW PROTECTED</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {activePilot.milestones.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: m.verified ? '#14291f' : '#27272a',
                  border: m.verified ? '1px solid #15803d' : '1px solid #3f3f46',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={m.verified}
                    onChange={() => handleMilestoneToggle(m.id)}
                    style={{ marginTop: '0.25rem', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: m.verified ? '#4ade80' : '#fff' }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '0.2rem' }}>
                      Due: {m.dueDate} • Tranche: <strong style={{ color: '#fff' }}>₹{(m.amount).toLocaleString('en-IN')}</strong>
                    </div>
                    {m.txHash && (
                      <div style={{ fontSize: '0.7rem', color: '#22c55e', marginTop: '0.2rem' }}>
                        Ref: {m.txHash}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {m.paymentStatus === 'Disbursed' ? (
                    <span style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', borderRadius: '4px', backgroundColor: '#15803d', color: '#fff', fontWeight: 600 }}>
                      Disbursed
                    </span>
                  ) : m.verified ? (
                    <button
                      onClick={() => setPaymentModal(m)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        backgroundColor: '#eab308',
                        color: '#000',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <CreditCard size={14} /> Disburse
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', borderRadius: '4px', backgroundColor: '#3f3f46', color: '#a1a1aa' }}>
                      Awaiting Sign-off
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry & KPIs */}
        <div style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Field Performance Benchmarks</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {activePilot.kpis.map((kpi, idx) => (
              <div key={idx} style={{ backgroundColor: '#27272a', padding: '0.85rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{kpi.name}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.2rem' }}>
                  {kpi.current} <span style={{ fontSize: '0.7rem', color: '#71717a' }}>/ {kpi.goal}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: '180px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activePilot.telemetry}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="week" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a' }} />
                <Line type="monotone" dataKey="actual" stroke="#eab308" strokeWidth={2} dot={{ fill: '#eab308' }} />
                <Line type="monotone" dataKey="target" stroke="#71717a" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Simulated PFMS Payment Modal */}
      {paymentModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '480px',
              width: '90%'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard color="#eab308" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Release Milestone Payment</h3>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: '#a1a1aa' }} onClick={() => setPaymentModal(null)} />
            </div>

            <p style={{ fontSize: '0.85rem', color: '#d4d4d8', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              This action authorizes the direct release of public funds from the departmental escrow account via the Public Financial Management System (PFMS).
            </p>

            <div style={{ backgroundColor: '#27272a', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div><strong>Recipient Startup:</strong> {activePilot.startupName}</div>
              <div><strong>Milestone:</strong> {paymentModal.title}</div>
              <div><strong>Tranche Amount:</strong> ₹{paymentModal.amount.toLocaleString('en-IN')}</div>
              <div><strong>Validation Status:</strong> <span style={{ color: '#4ade80' }}>Field Delivery Verified</span></div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPaymentModal(null)}
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: '6px',
                  backgroundColor: '#27272a',
                  color: '#fff',
                  border: '1px solid #3f3f46',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisbursement}
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: '6px',
                  backgroundColor: '#eab308',
                  color: '#000',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Confirm PFMS Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}