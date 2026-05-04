import Link from "next/link";
import { Logo } from "@/components/Logo";

interface Props {
  children?: React.ReactNode;
}

export function AppHeader({ children }: Props) {
  return (
    <header className="shrink-0 border-b border-zinc-800 px-4 h-12 flex items-center gap-3">
      <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors">
        <Logo size={16} />
        <span className="text-sm font-semibold tracking-tight hidden sm:inline">Agent Patterns</span>
      </Link>
      {children}
    </header>
  );
}
