import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Eye, RotateCcw } from 'lucide-react';

export interface TopologyLayerData {
  title: string;
  values: number[];
  zValues: number[];
  biases: number[];
  labels: string[];
}

export interface TopologyNodeData {
  layerIdx: number;
  nodeIdx: number;
  x: number;
  y: number;
  activation: number;
  zValue: number;
  label?: string;
}

export interface TopologyEdgeData {
  from: TopologyNodeData;
  to: TopologyNodeData;
  weight: number;
  signal: number;
}

interface NeuralTopology3DCanvasProps {
  layerConfigs: TopologyLayerData[];
  nodesByLayer: TopologyNodeData[][];
  edges: TopologyEdgeData[];
  selectedNode: { layerIdx: number; nodeIdx: number } | null;
  animatePulse: boolean;
  accentPrimary: string;
  accentSecondary: string;
  bgSurface: string;
  onSelectNode: (node: { layerIdx: number; nodeIdx: number } | null) => void;
  onHoverNode?: (node: TopologyNodeData | null) => void;
}

interface NodeMeshRecord {
  mesh: THREE.Mesh;
  node: TopologyNodeData;
  baseScale: number;
}

interface PulseRecord {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  phase: number;
  speed: number;
}

export const NeuralTopology3DCanvas: React.FC<NeuralTopology3DCanvasProps> = ({
  layerConfigs,
  nodesByLayer,
  edges,
  selectedNode,
  animatePulse,
  accentPrimary,
  accentSecondary,
  bgSurface,
  onSelectNode,
  onHoverNode,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [inspectedEdgeInfo, setInspectedEdgeInfo] = useState<string | null>(null);

  const presentationRef = useRef(presentationMode);
  presentationRef.current = presentationMode;
  const animatePulseRef = useRef(animatePulse);
  animatePulseRef.current = animatePulse;
  const onSelectRef = useRef(onSelectNode);
  onSelectRef.current = onSelectNode;
  const onHoverRef = useRef(onHoverNode);
  onHoverRef.current = onHoverNode;

  // Compute 3D coordinates for every neuron cleanly
  const positionsMap = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    const layerCount = nodesByLayer.length;
    const xSpan = layerCount <= 3 ? 13 : 16;

    nodesByLayer.forEach((layerNodes, lIdx) => {
      const x = -xSpan / 2 + (lIdx / Math.max(1, layerCount - 1)) * xSpan;
      // Arrange 16-node input layer as a true 4x4 spatial matrix in YZ!
      if (lIdx === 0 && layerNodes.length === 16) {
        layerNodes.forEach((n, idx) => {
          const r = Math.floor(idx / 4);
          const c = idx % 4;
          const y = (1.5 - r) * 1.65;
          const z = (c - 1.5) * 1.65;
          map.set(`${lIdx}:${n.nodeIdx}`, new THREE.Vector3(x, y, z));
        });
      } else {
        const cols = layerNodes.length > 10 ? 3 : layerNodes.length > 6 ? 2 : 1;
        const rows = Math.ceil(layerNodes.length / cols);
        layerNodes.forEach((n, idx) => {
          const r = Math.floor(idx / cols);
          const c = idx % cols;
          const y = ((rows - 1) / 2 - r) * (rows > 8 ? 0.92 : 1.15);
          const z = (c - (cols - 1) / 2) * 1.5;
          map.set(`${lIdx}:${n.nodeIdx}`, new THREE.Vector3(x, y, z));
        });
      }
    });
    return map;
  }, [nodesByLayer]);

  // Precompute top weights summary when a node is selected
  useEffect(() => {
    if (!selectedNode) {
      setInspectedEdgeInfo(null);
      return;
    }
    const related = edges
      .filter(
        (e) =>
          (e.to.layerIdx === selectedNode.layerIdx && e.to.nodeIdx === selectedNode.nodeIdx) ||
          (e.from.layerIdx === selectedNode.layerIdx && e.from.nodeIdx === selectedNode.nodeIdx)
      )
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 3);
    if (related.length === 0) {
      setInspectedEdgeInfo(null);
      return;
    }
    setInspectedEdgeInfo(
      related
        .map((e) => `${e.from.label ?? 'N'}→${e.to.label ?? 'N'}: w=${e.weight.toFixed(3)}`)
        .join(' · ')
    );
  }, [selectedNode, edges]);

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 4.5, 19);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = Math.max(320, container.clientWidth || 720);
    const height = 460;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: true,
      });
    } catch {
      setWebglError('WebGL no está disponible en este dispositivo o navegador. Usa Vista 2D.');
      return;
    }

    // Check software renderer hint for adaptive quality
    let isSoftwareGl = false;
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      isSoftwareGl = /swiftshader|llvmpipe|softpipe|mesa offscreen/i.test(gpuName);
    } catch {
      isSoftwareGl = false;
    }

    const dpr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgCol = new THREE.Color(bgSurface || '#101018');
    scene.background = bgCol;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    camera.position.set(0, 4.5, 19);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 38;
    controlsRef.current = controls;

    // Studio three-point lighting
    const ambient = new THREE.AmbientLight('#ffffff', 0.75);
    const keyLight = new THREE.DirectionalLight('#ffffff', 1.25);
    keyLight.position.set(10, 14, 14);
    const rimLight = new THREE.DirectionalLight(accentSecondary || '#22d3ee', 0.65);
    rimLight.position.set(-12, -6, -10);
    scene.add(ambient, keyLight, rimLight);

    // Subtle floor reference grid
    const grid = new THREE.GridHelper(24, 16, new THREE.Color('#3f3f46'), new THREE.Color('#27272a'));
    grid.position.y = -6.2;
    scene.add(grid);

    const disposableGeometries: THREE.BufferGeometry[] = [];
    const disposableMaterials: THREE.Material[] = [];

    const sphereGeo = new THREE.SphereGeometry(0.36, isSoftwareGl ? 12 : 20, isSoftwareGl ? 10 : 16);
    const pulseGeo = new THREE.SphereGeometry(0.11, 10, 8);
    disposableGeometries.push(sphereGeo, pulseGeo);

    const colPrimary = new THREE.Color(accentPrimary || '#8b5cf6');
    const colSecondary = new THREE.Color(accentSecondary || '#22d3ee');
    const colNeutral = new THREE.Color('#64748b');

    const nodeRecords: NodeMeshRecord[] = [];
    nodesByLayer.forEach((layerNodes, lIdx) => {
      layerNodes.forEach((node) => {
        const pos = positionsMap.get(`${lIdx}:${node.nodeIdx}`);
        if (!pos) return;
        const isSelected =
          selectedNode?.layerIdx === node.layerIdx && selectedNode?.nodeIdx === node.nodeIdx;
        const act = Math.max(0, Math.min(1, node.activation));
        const mat = new THREE.MeshStandardMaterial({
          color: isSelected
            ? new THREE.Color('#facc15')
            : colNeutral.clone().lerp(colSecondary, act),
          emissive: isSelected
            ? new THREE.Color('#facc15')
            : colPrimary.clone().multiplyScalar(act * 0.65),
          emissiveIntensity: isSelected ? 0.8 : 0.7,
          roughness: 0.35,
          metalness: 0.2,
        });
        disposableMaterials.push(mat);

        const mesh = new THREE.Mesh(sphereGeo, mat);
        const baseScale = 0.75 + act * 0.65 + (isSelected ? 0.25 : 0);
        mesh.position.copy(pos);
        mesh.scale.setScalar(baseScale);
        scene.add(mesh);
        nodeRecords.push({ mesh, node, baseScale });
      });
    });

    // Build synaptic connection lines & animated pulse particles
    const pulses: PulseRecord[] = [];
    const pulseMatPos = new THREE.MeshBasicMaterial({ color: colSecondary });
    const pulseMatNeg = new THREE.MeshBasicMaterial({ color: colPrimary });
    disposableMaterials.push(pulseMatPos, pulseMatNeg);

    edges.forEach((edge, idx) => {
      const p1 = positionsMap.get(`${edge.from.layerIdx}:${edge.from.nodeIdx}`);
      const p2 = positionsMap.get(`${edge.to.layerIdx}:${edge.to.nodeIdx}`);
      if (!p1 || !p2) return;

      const isConnectedToSelected =
        selectedNode !== null &&
        ((edge.from.layerIdx === selectedNode.layerIdx &&
          edge.from.nodeIdx === selectedNode.nodeIdx) ||
          (edge.to.layerIdx === selectedNode.layerIdx &&
            edge.to.nodeIdx === selectedNode.nodeIdx));

      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineBasicMaterial({
        color: edge.weight >= 0 ? colSecondary : colPrimary,
        transparent: true,
        opacity: isConnectedToSelected
          ? 0.92
          : selectedNode
            ? 0.14
            : Math.min(0.65, 0.16 + Math.abs(edge.weight) * 0.45),
      });
      disposableGeometries.push(lineGeo);
      disposableMaterials.push(lineMat);
      scene.add(new THREE.Line(lineGeo, lineMat));

      // Keep pulse count bounded so software WebGL stays responsive
      if (idx % (isSoftwareGl ? 3 : 2) === 0 && pulses.length < (isSoftwareGl ? 35 : 80)) {
        const pMesh = new THREE.Mesh(
          pulseGeo,
          edge.weight >= 0 ? pulseMatPos : pulseMatNeg
        );
        pMesh.position.copy(p1);
        scene.add(pMesh);
        pulses.push({
          mesh: pMesh,
          from: p1.clone(),
          to: p2.clone(),
          phase: (idx * 0.17) % 1,
          speed: 0.28 + Math.min(0.45, Math.abs(edge.weight) * 0.25),
        });
      }
    });

    // Raycaster interaction
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const handlePointerMove = (ev: PointerEvent) => {
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(
        nodeRecords.map((r) => r.mesh),
        false
      );
      if (hits.length > 0) {
        const hitMesh = hits[0].object;
        const found = nodeRecords.find((r) => r.mesh === hitMesh);
        renderer.domElement.style.cursor = 'pointer';
        onHoverRef.current?.(found ? found.node : null);
      } else {
        renderer.domElement.style.cursor = 'grab';
        onHoverRef.current?.(null);
      }
    };

    const handlePointerUp = (ev: PointerEvent) => {
      const moved = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
      if (moved > 5) return; // Dragging OrbitControls, not clicking a neuron
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(
        nodeRecords.map((r) => r.mesh),
        false
      );
      if (hits.length > 0) {
        const hitMesh = hits[0].object;
        const found = nodeRecords.find((r) => r.mesh === hitMesh);
        if (found) {
          onSelectRef.current({
            layerIdx: found.node.layerIdx,
            nodeIdx: found.node.nodeIdx,
          });
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const resizeObs = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    });
    resizeObs.observe(container);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastTime = performance.now();
    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (presentationRef.current && !prefersReducedMotion) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.2;
      } else {
        controls.autoRotate = false;
      }
      controls.update();

      const runPulses = animatePulseRef.current && !prefersReducedMotion;
      for (const p of pulses) {
        p.mesh.visible = runPulses;
        if (runPulses) {
          p.phase = (p.phase + dt * p.speed) % 1;
          p.mesh.position.lerpVectors(p.from, p.to, p.phase);
        }
      }

      renderer.render(scene, camera);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObs.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      disposableGeometries.forEach((g) => g.dispose());
      disposableMaterials.forEach((m) => m.dispose());
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [
    nodesByLayer,
    edges,
    positionsMap,
    selectedNode,
    accentPrimary,
    accentSecondary,
    bgSurface,
  ]);

  if (webglError) {
    return (
      <div className="rounded-xl p-6 border border-[var(--border-hairline)] surface-elevated text-xs text-[var(--status-warn)]">
        {webglError}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-2">
          <span>Arrastra para rotar · Rueda para zoom · Clic en esfera para inspeccionar neurona</span>
          {inspectedEdgeInfo && (
            <span className="font-mono text-[var(--text-primary)] px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-hairline)]">
              Sinapsis Top: {inspectedEdgeInfo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPresentationMode((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer ${
              presentationMode
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                : 'surface-elevated border-[var(--border-hairline)] text-[var(--text-secondary)]'
            }`}
          >
            <Eye className="w-3 h-3" />
            {presentationMode ? 'Presentación ON' : 'Modo presentación'}
          </button>
          <button
            type="button"
            onClick={handleResetCamera}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg surface-elevated border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Restablecer cámara
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        aria-label={`Topología 3D interactiva con ${layerConfigs.length} capas`}
        className="w-full h-[460px] rounded-xl overflow-hidden border border-[var(--border-hairline)]"
      />
    </div>
  );
};
