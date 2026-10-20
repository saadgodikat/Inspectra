import { Layers, Clock } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  phase: string;
  description: string;
  features: string[];
}

export const PlaceholderPage: React.FC<PlaceholderProps> = ({
  title,
  phase,
  description,
  features,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm relative overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold w-fit mb-4">
          <Clock className="w-3.5 h-3.5" /> Scheduled for {phase}
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-300 text-sm leading-relaxed max-w-2xl mb-6">
          {description}
        </p>

        <div className="p-5 rounded-xl bg-slate-950/50 border border-slate-800/80">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Planned Phase Deliverables
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
