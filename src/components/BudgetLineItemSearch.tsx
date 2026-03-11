import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { DbBudgetLineItem } from '@/hooks/useProjects';

interface BudgetLineItemSearchProps {
  budgetItems: DbBudgetLineItem[];
  onSelect: (item: DbBudgetLineItem) => void;
  placeholder?: string;
}

export default function BudgetLineItemSearch({ budgetItems, onSelect, placeholder = 'Search budget items...' }: BudgetLineItemSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim().length > 0
    ? budgetItems.filter(item => {
        const q = query.toLowerCase();
        return (
          item.cost_item_name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.cost_code.toLowerCase().includes(q) ||
          item.cost_group.toLowerCase().includes(q) ||
          String(item.line_item_no).includes(q)
        );
      }).slice(0, 10)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          className="pl-8 text-sm"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(item => (
            <button
              key={item.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border/50 last:border-0"
              onClick={() => {
                onSelect(item);
                setQuery('');
                setOpen(false);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-medium text-sm">
                  <span className="text-muted-foreground mr-1.5">#{item.line_item_no}</span>
                  {item.cost_item_name}
                </span>
                <span className="text-xs font-display font-semibold text-muted-foreground">
                  ${Number(item.extended_cost).toLocaleString()}
                </span>
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
              )}
              {item.cost_group && (
                <span className="text-xs text-muted-foreground/60">{item.cost_group}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {open && query.trim().length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg p-3 text-center">
          <p className="text-sm text-muted-foreground">No matching budget items</p>
        </div>
      )}
    </div>
  );
}
