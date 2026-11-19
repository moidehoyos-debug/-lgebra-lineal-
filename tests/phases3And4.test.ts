// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TeamCredits } from '../src/components/TeamCredits';
import { SmartIrrigationLabView } from '../src/components/SmartIrrigationLabView';
import { VisualBuilderView } from '../src/components/builder/VisualBuilderView';
import { OFFICIAL_TEAM_MEMBERS } from '../src/config/team';
import { BuilderProvider } from '../src/context/BuilderContext';
import { StudioProvider, useStudio } from '../src/context/StudioContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { buildJarvisDemoSequence, detectJarvisDemoKind } from '../src/engines/jarvisDemoEngine';
import { createInitialNeuralSuite } from '../src/engines/neuralEngine';
import { createSmartIrrigationModel } from '../src/engines/smartIrrigationEngine';
import { geminiService } from '../src/services/geminiService';

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof window.matchMedia === 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
});

afterEach(() => {
  cleanup();
});

describe('Phase 3 & 4 Engines — Smart Irrigation MLP & Jarvis Guided Demos', () => {
  it('converges on synthetic Smart Irrigation dataset and passes finite-difference gradient check', () => {
    const model = createSmartIrrigationModel(202604);
    const before = model.getSummary();

    // Analytical vs centered finite-difference gradient check on W2[0] and W1[0][0]
    const probe = { m: 24, s: 780, y: 1 as const };
    const snap = model.forward(probe.m, probe.s);
    const eps = 1e-5;

    const w2Orig = model.W2[0];
    model.W2[0] = w2Orig + eps;
    const fPlus = model.evaluateDataset([{ id: 'p', moisturePct: probe.m, sunlightWm2: probe.s, target: probe.y, label: 'p' }]).loss;
    model.W2[0] = w2Orig - eps;
    const fMinus = model.evaluateDataset([{ id: 'p', moisturePct: probe.m, sunlightWm2: probe.s, target: probe.y, label: 'p' }]).loss;
    model.W2[0] = w2Orig;
    const fdGradW2 = (fPlus - fMinus) / (2 * eps);

    const step = model.stepSample(probe.m, probe.s, probe.y, 0.25);
    expect(Math.abs(step.gradW2[0] - fdGradW2)).toBeLessThan(1e-5);
    expect(snap.yHat).toBeGreaterThan(0);

    // Train 35 epochs -> loss decreases and validation accuracy reaches high convergence
    model.reset(202604);
    model.trainEpochs(35, 0.3);
    const after = model.getSummary();

    expect(after.epochsTrained).toBe(35);
    expect(after.finalLoss).toBeLessThan(before.finalLoss);
    expect(after.valAccuracy).toBeGreaterThanOrEqual(0.875);
    expect(after.trainAccuracy).toBeGreaterThanOrEqual(0.875);
  });

  it('maintains strict model isolation between Smart Irrigation MLP and VectorIA classifiers', () => {
    const suite = createInitialNeuralSuite();
    const digitsWeightSnapshot = [...suite.digitsModel.layers[0].W[0]];
    const alphaWeightSnapshot = [...suite.alphanumericModel.layers[0].W[0]];
    const irrigation = createSmartIrrigationModel(202604);
    irrigation.trainEpochs(25, 0.3);

    expect(suite.digitsModel.layers[0].W[0]).toEqual(digitsWeightSnapshot);
    expect(suite.alphanumericModel.layers[0].W[0]).toEqual(alphaWeightSnapshot);
  }, 15000);

  it('detects Jarvis demo prompts and generates real engine-calculated frame sequences', () => {
    expect(detectJarvisDemoKind('Modo Jarvis: muestra cómo aprende la red de riego')).toBe(
      'smart-irrigation'
    );
    expect(detectJarvisDemoKind('Modo Jarvis: multiplicación de matrices C=A*B')).toBe(
      'matrix-multiply'
    );
    expect(detectJarvisDemoKind('Modo Jarvis: cómo aprende esta red paso a paso')).toBe(
      'neural-learning'
    );

    const irrigationSeq = buildJarvisDemoSequence('smart-irrigation');
    expect(irrigationSeq.frames.length).toBeGreaterThanOrEqual(4);
    expect(irrigationSeq.sourceVerified).toContain('smartIrrigationEngine');
    const lastCurve = irrigationSeq.frames[irrigationSeq.frames.length - 1].curvePoints;
    expect(lastCurve.length).toBeGreaterThan(10);

    const matSeq = buildJarvisDemoSequence('matrix-multiply');
    expect(matSeq.frames).toHaveLength(3);
    expect(matSeq.frames[0].metrics[0].value).toBe('12'); // 2*5 + 1*2 = 12
  });
});

describe('Phase 5 UI Verification (jsdom + @testing-library/react)', () => {
  it('renders official development team strictly in exact order 01-03 without abbreviations', () => {
    render(React.createElement(TeamCredits));
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Moisés de Hoyos', 'Isaías Alvarado', 'Rivaldo Calvo']);
    expect(OFFICIAL_TEAM_MEMBERS.map((m) => m.orderNumber)).toEqual(['01', '02', '03']);
  });

  it('renders SmartIrrigationLabView interactively and executes backpropagation step + epochs', () => {
    render(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(SmartIrrigationLabView)
      )
    );

    expect(
      screen.getByText(/Laboratorio Neuronal de Riego Inteligente/i)
    ).toBeTruthy();
    expect(screen.getByText(/Modelo aislado \(17 parámetros/i)).toBeTruthy();

    const stepBtn = screen.getByRole('button', { name: /1 Paso Backprop/i });
    fireEvent.click(stepBtn);
    expect(screen.getByText(/Error y Pérdida BCE/i)).toBeTruthy();
    expect(screen.getByText(/Loss antes:/i)).toBeTruthy();

    const trainBtn = screen.getByRole('button', { name: /Entrenar \+15 Épocas/i });
    fireEvent.click(trainBtn);
    const epochsLabel = screen.getByText('Épocas');
    expect(epochsLabel.parentElement?.textContent).toContain('15');
  });

  it('renders VisualBuilderView setup with mandatory setupToken and requires viewer password on login', async () => {
    let initializedState = false;
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/builder/published')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            published: {
              version: 1,
              pages: [],
              themePresets: [],
              activeThemePresetId: null,
              hiddenSystemModules: [],
              modules: [],
              connections: [],
              componentOverrides: {},
              updatedAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          }),
        };
      }
      if (url.includes('/api/builder/auth/status')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            initialized: initializedState,
            setupTokenRequired: !initializedState,
            authenticated: false,
            session: null,
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const first = render(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(
            StudioProvider,
            null,
            React.createElement(
              BuilderProvider,
              null,
              React.createElement(VisualBuilderView)
            )
          )
        )
      );

      // Setup form must show bootstrap setupToken & viewer passcode inputs
      expect(
        await screen.findByLabelText(/Token de inicialización del servidor/i)
      ).toBeTruthy();
      expect(
        screen.getByLabelText(/Contraseña de Revisor \/ Viewer/i)
      ).toBeTruthy();
      first.unmount();

      // When initialized, login form must enforce a required password input even for viewer role
      initializedState = true;
      render(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(
            StudioProvider,
            null,
            React.createElement(
              BuilderProvider,
              null,
              React.createElement(VisualBuilderView)
            )
          )
        )
      );

      const roleSelect = await screen.findByRole('combobox');
      fireEvent.change(roleSelect, { target: { value: 'viewer' } });
      const passInput = screen.getByLabelText(/^Contraseña$/i) as HTMLInputElement;
      expect(passInput.required).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  }, 20000);

  it('wires StudioContext.logEvent into geminiService so assistant API failures enter systemEvents', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/omni/chat')) {
        return new Response(
          JSON.stringify({
            code: 'INVALID_API_KEY',
            message: 'La clave GEMINI_API_KEY fue rechazada.',
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const Probe: React.FC = () => {
      const { systemEvents } = useStudio();
      return React.createElement(
        'div',
        { 'data-testid': 'omni-events' },
        systemEvents
          .filter((e) => e.category === 'omni')
          .map((e) => `${e.status}:${e.title}:${e.detail}`)
          .join('|')
      );
    };

    try {
      render(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(
            StudioProvider,
            null,
            React.createElement(Probe)
          )
        )
      );

      await expect(
        geminiService.chat({
          messages: [{ role: 'user', content: 'Verifica estabilidad' }],
        })
      ).rejects.toMatchObject({ code: 'INVALID_API_KEY' });

      const out = await screen.findByTestId('omni-events');
      expect(out.textContent).toContain('error:Error de asistente Gemini (INVALID_API_KEY)');
    } finally {
      vi.unstubAllGlobals();
    }
  }, 15000);

  it('switches cleanly across all 6 global themes and renders App navigation shell without errors', async () => {
    const { THEME_OPTIONS, useTheme } = await import('../src/context/ThemeContext');
    const ThemeHarness: React.FC = () => {
      const { theme, setTheme } = useTheme();
      return React.createElement(
        'div',
        null,
        React.createElement('span', { 'data-testid': 'active-theme' }, theme),
        ...THEME_OPTIONS.map((opt) =>
          React.createElement(
            'button',
            { key: opt.id, type: 'button', onClick: () => setTheme(opt.id) },
            opt.name
          )
        )
      );
    };

    render(React.createElement(ThemeProvider, null, React.createElement(ThemeHarness)));
    for (const opt of THEME_OPTIONS) {
      fireEvent.click(screen.getByRole('button', { name: opt.name }));
      expect(screen.getByTestId('active-theme').textContent).toBe(opt.id);
      expect(document.documentElement.getAttribute('data-theme')).toBe(opt.id);
      expect(document.documentElement.style.colorScheme).toBe(opt.isDark ? 'dark' : 'light');
    }
  });
});

