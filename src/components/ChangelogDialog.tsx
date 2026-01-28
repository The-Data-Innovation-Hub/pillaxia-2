import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CHANGELOG, ChangelogEntry } from "@/lib/changelog";
import { Sparkles, Wrench, Bug, Shield } from "lucide-react";

interface ChangelogDialogProps {
  children: React.ReactNode;
}

const typeConfig = {
  feature: {
    icon: Sparkles,
    label: "New",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  improvement: {
    icon: Wrench,
    label: "Improved",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  fix: {
    icon: Bug,
    label: "Fixed",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  security: {
    icon: Shield,
    label: "Security",
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
};

function ChangelogEntryCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <div className="border-b border-border/50 pb-6 last:border-0 last:pb-0">
      <div className="flex items-center gap-3 mb-3">
        <Badge variant="outline" className="font-mono text-xs">
          v{entry.version}
        </Badge>
        <span className="text-xs text-muted-foreground">{entry.date}</span>
      </div>
      <h3 className="font-semibold text-foreground mb-3">{entry.title}</h3>
      <ul className="space-y-2">
        {entry.changes.map((change, idx) => {
          const config = typeConfig[change.type];
          const Icon = config.icon;
          return (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <Badge 
                variant="outline" 
                className={`text-[10px] px-1.5 py-0 shrink-0 ${config.className}`}
              >
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              <span className="text-muted-foreground">{change.description}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChangelogDialog({ children }: ChangelogDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What's New in Pillaxia
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {CHANGELOG.map((entry, idx) => (
              <ChangelogEntryCard key={idx} entry={entry} />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
