import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, DollarSign,
  ChevronDown, ChevronUp, Loader2, RefreshCw, Sparkles, Shield,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ForecastData {
  forecast: {
    estimatedCostAtCompletion: number;
    confidenceLevel: string;
    projectedSavings: number;
    cashFlowNext30Days: number;
    cashFlowNext60Days: number;
    cashFlowNext90Days: number;
    summary: string;
  };
  alerts: {
    type: string;
    severity: string;
    project: string;
    message: string;
    metric: string;
  }[];
  bonusProjection: {
    currentSavings: number;
    projectedSavings: number;
    currentBonus: number;
    projectedBonus: number;
    trend: string;
    insight: string;
  };
}

const severityStyles: Record<string, string> = {
  critical: 'bg-destructive/10 border-destructive/30 text-destructive',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  info: 'bg-info/10 border-info/30 text-info',
};

const severityBadge: Record<string, string> = {
  critical: 'destructive',
  warning: 'secondary',
  info: 'outline',
};

const trendIcon = (trend: string) => {
  if (trend === 'up') return <ArrowUpRight className="w-4 h-4 text-success" />;
  if (trend === 'down') return <ArrowDownRight className="w-4 h-4 text-destructive" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
};

export default function AIForecastWidget() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('budget-forecast');
      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);
      setData(fnData);
      setExpanded(true);
    } catch (e: any) {
      const msg = e?.message || 'Failed to generate forecast';
      setError(msg);
      toast({ title: 'Forecast Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="card-elevated overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg flex items-center gap-2">
              AI Budget Forecast
              <Sparkles className="w-4 h-4 text-primary" />
            </h3>
            <p className="text-xs text-muted-foreground font-body">
              Predictive analytics &amp; profitability alerts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
          <Button
            size="sm"
            variant={data ? 'outline' : 'default'}
            onClick={fetchForecast}
            disabled={loading}
            className="font-display"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing...</>
            ) : data ? (
              <><RefreshCw className="w-4 h-4 mr-1" /> Refresh</>
            ) : (
              <><Brain className="w-4 h-4 mr-1" /> Generate Forecast</>
            )}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="px-5 pb-4">
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        </div>
      )}

      {/* Content */}
      <AnimatePresence>
        {data && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Forecast Summary */}
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <p className="text-sm font-body text-foreground leading-relaxed">
                  {data.forecast.summary}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Shield className="w-3 h-3 mr-1" />
                    Confidence: {data.forecast.confidenceLevel}
                  </Badge>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">Est. Cost at Completion</p>
                  <p className="text-lg font-display font-bold">{fmt(data.forecast.estimatedCostAtCompletion)}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">Projected Savings</p>
                  <p className="text-lg font-display font-bold text-success">{fmt(data.forecast.projectedSavings)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">Cash Flow 30d</p>
                  <p className="text-lg font-display font-bold">{fmt(data.forecast.cashFlowNext30Days)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">Cash Flow 90d</p>
                  <p className="text-lg font-display font-bold">{fmt(data.forecast.cashFlowNext90Days)}</p>
                </div>
              </div>

              {/* Bonus Projection */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <h4 className="font-display font-semibold text-sm">PM Bonus Projection</h4>
                  {trendIcon(data.bonusProjection.trend)}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">Current Savings</p>
                    <p className="text-base font-display font-bold">{fmt(data.bonusProjection.currentSavings)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">Projected Savings</p>
                    <p className="text-base font-display font-bold text-success">{fmt(data.bonusProjection.projectedSavings)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">Current Bonus</p>
                    <p className="text-base font-display font-bold">{fmt(data.bonusProjection.currentBonus)}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">Projected Bonus</p>
                    <p className="text-lg font-display font-bold text-primary">{fmt(data.bonusProjection.projectedBonus)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground font-body italic">{data.bonusProjection.insight}</p>
              </div>

              {/* Alerts */}
              {data.alerts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-display font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    Profitability Alerts ({data.alerts.length})
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {data.alerts.map((alert, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`p-3 rounded-lg border text-sm ${severityStyles[alert.severity] || severityStyles.info}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={severityBadge[alert.severity] as any || 'outline'} className="text-[10px]">
                                {alert.severity}
                              </Badge>
                              <span className="text-xs font-display font-semibold">{alert.project}</span>
                            </div>
                            <p className="text-xs font-body">{alert.message}</p>
                          </div>
                          {alert.metric && (
                            <span className="text-xs font-mono font-bold whitespace-nowrap">{alert.metric}</span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
