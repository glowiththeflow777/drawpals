import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, FileText, CheckCircle2, Wallet, TrendingUp, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface FinancialDashboardProps {
  projectId: string;
  project: {
    total_budget: number;
    amount_invoiced: number;
    amount_paid: number;
  };
}

const FinancialDashboard: React.FC<FinancialDashboardProps> = ({ projectId, project }) => {
  const navigate = useNavigate();

  const totalBudget = Number(project.total_budget);
  const invoiced = Number(project.amount_invoiced);
  const approved = Number(project.amount_paid);
  const remaining = totalBudget - invoiced;

  const stats = [
    { label: 'Total Budget', value: totalBudget, icon: Wallet, color: 'text-primary' },
    { label: 'Invoiced', value: invoiced, icon: FileText, color: 'text-amber-600' },
    { label: 'Approved', value: approved, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Remaining', value: remaining, icon: TrendingUp, color: 'text-sky-600' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Financial Dashboard
        </h3>
        <button
          onClick={() => navigate(`/admin/projects/${projectId}/financials`)}
          className="text-xs text-primary hover:underline font-display flex items-center gap-1"
        >
          View Full Dashboard <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(stat => (
          <button
            key={stat.label}
            onClick={() => navigate(`/admin/projects/${projectId}/financials`)}
            className="card-elevated p-4 text-left transition-all hover:shadow-md"
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <p className="text-xs text-muted-foreground font-body">{stat.label}</p>
            </div>
            <p className="text-xl font-display font-bold">${stat.value.toLocaleString()}</p>
            {stat.label !== 'Total Budget' && totalBudget > 0 && (
              <div className="mt-2">
                <Progress value={Math.min(100, (stat.value / totalBudget) * 100)} className="h-1.5" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FinancialDashboard;
