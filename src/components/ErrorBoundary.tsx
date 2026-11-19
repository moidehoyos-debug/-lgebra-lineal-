import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface ModuleErrorBoundaryProps {
  moduleName: string;
  onReturnHome?: () => void;
  onErrorCaptured?: (moduleName: string, message: string) => void;
  children: React.ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  safeMessage: string;
}

export class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      safeMessage: '',
    };
  }

  public static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    const raw = error?.message || 'Error de ejecución en el módulo.';
    // Sanitize internal paths or stack fragments from user-facing fallback text
    const clean = raw
      .replace(/\/[^\s]+/g, '[ruta]')
      .replace(/at\s+[^\n]+/g, '')
      .trim()
      .slice(0, 180);
    return {
      hasError: true,
      safeMessage: clean || 'Se detectó una condición inesperada en este módulo.',
    };
  }

  public componentDidCatch(error: Error): void {
    if (this.props.onErrorCaptured) {
      const msg = (error?.message || 'Error inesperado').slice(0, 160);
      this.props.onErrorCaptured(this.props.moduleName, msg);
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, safeMessage: '' });
  };

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="surface-card rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto my-6 space-y-4 border border-[var(--status-err)]/40"
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--bg-elevated)] text-[var(--status-err)] shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Recuperación controlada · {this.props.moduleName}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Este módulo encontró una excepción aislada. El resto de VectorIA Studio, tus modelos entrenados y el historial de sesión permanecen intactos.
            </p>
            <div className="mt-2 p-3 rounded-xl surface-elevated font-mono text-[11px] text-[var(--text-muted)] break-words">
              {this.state.safeMessage}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reintentar módulo
          </button>
          {this.props.onReturnHome && (
            <button
              type="button"
              onClick={() => {
                this.handleRetry();
                this.props.onReturnHome?.();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[var(--border-strong)] surface-elevated text-[var(--text-primary)] cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              Volver al Panel Principal
            </button>
          )}
        </div>
      </div>
    );
  }
}
