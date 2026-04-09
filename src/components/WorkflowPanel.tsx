"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Plus,
  Play,
  Pause,
  RotateCcw,
  GripVertical,
  Workflow as WorkflowIcon,
  Zap,
  Document,
  Copy,
  Globe,
  Edit,
  Check,
  Clock,
  BarChart,
  ExternalLink,
  Refresh,
  AlertCircle,
  Paperclip,
  ChevronDown,
  ChevronRight,
  Trash,
  Loader,
  ArrowRight,
} from "./icons";

// --- Types (client-side mirrors) ---

interface WorkflowStep {
  id: string;
  type: string;
  label: string;
  description: string;
  config: Record<string, any>;
  usesAI: boolean;
  prompt?: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  icon: string;
  steps: WorkflowStep[];
  createdAt: string;
  lastRunAt?: string;
  runCount: number;
  isTemplate?: boolean;
}

interface StepResult {
  stepId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: any;
  error?: string;
  aiContent?: string;
}

// --- Icon resolver ---

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Zap,
  Document,
  Copy,
  Globe,
  Edit,
  Check,
  Clock,
  BarChart,
  ExternalLink,
  Refresh,
  AlertCircle,
  Paperclip,
  Workflow: WorkflowIcon,
};

function IconByName({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] || WorkflowIcon;
  return <Icon size={size} className={className} />;
}

// --- Step types data ---

const STEP_TYPES = [
  { type: "create_page", label: "Create Page", icon: "Document" },
  { type: "update_page", label: "Update Page", icon: "Edit" },
  { type: "duplicate_page", label: "Duplicate Page", icon: "Copy" },
  { type: "update_seo", label: "Update SEO", icon: "Globe" },
  { type: "set_featured_image", label: "Set Featured Image", icon: "Paperclip" },
  { type: "publish_page", label: "Publish Page", icon: "Check" },
  { type: "schedule_page", label: "Schedule Page", icon: "Clock" },
  { type: "create_post", label: "Create Post", icon: "Document" },
  { type: "update_product", label: "Update Product", icon: "BarChart" },
  { type: "create_redirect", label: "Create Redirect", icon: "ExternalLink" },
  { type: "clear_cache", label: "Clear Cache", icon: "Refresh" },
  { type: "send_notification", label: "Send Notification", icon: "AlertCircle" },
];

// --- Helper: extract variables from workflow ---

function extractVariables(workflow: Workflow): string[] {
  const vars = new Set<string>();
  const regex = /\{\{(\w+)\}\}/g;
  for (const step of workflow.steps) {
    const fields = [step.label, step.description, step.prompt || "", ...Object.values(step.config).map(String)];
    for (const field of fields) {
      let match;
      while ((match = regex.exec(field)) !== null) {
        vars.add(match[1]);
      }
    }
  }
  return Array.from(vars);
}

// --- Main Component ---

interface WorkflowPanelProps {
  show: boolean;
  onClose: () => void;
  selectedPageId?: number | null;
  initialWorkflowId?: string | null;
}

export default function WorkflowPanel({ show, onClose, selectedPageId, initialWorkflowId }: WorkflowPanelProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "editor" | "runner">("list");
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [runningWorkflow, setRunningWorkflow] = useState<Workflow | null>(null);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showStepDropdown, setShowStepDropdown] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load workflows
  useEffect(() => {
    if (show) {
      loadWorkflows();
    }
  }, [show]);

  // Open specific workflow if requested
  useEffect(() => {
    if (initialWorkflowId && workflows.length > 0) {
      const wf = workflows.find((w) => w.id === initialWorkflowId);
      if (wf) {
        openRunner(wf);
      }
    }
  }, [initialWorkflowId, workflows]);

  const loadWorkflows = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
      } else {
        setLoadError("Could not load workflows.");
      }
    } catch {
      setLoadError("Could not load workflows.");
    } finally {
      setLoading(false);
    }
  };

  const saveWorkflow = async (workflow: Workflow) => {
    const isNew = !workflows.find((w) => w.id === workflow.id);
    const method = isNew ? "POST" : "PUT";
    const url = isNew ? "/api/workflows" : `/api/workflows/${workflow.id}`;

    setSaveError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workflow),
      });
      if (res.ok) {
        await loadWorkflows();
        setView("list");
        setEditingWorkflow(null);
      } else {
        setSaveError("Failed to save workflow. Please try again.");
      }
    } catch {
      setSaveError("Failed to save workflow. Please try again.");
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setDeleteError("Failed to delete workflow.");
      } else {
        await loadWorkflows();
      }
    } catch {
      setDeleteError("Failed to delete workflow.");
    }
  };

  const openEditor = (workflow?: Workflow) => {
    if (workflow) {
      setEditingWorkflow({ ...workflow });
    } else {
      setEditingWorkflow({
        id: `wf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: "",
        description: "",
        icon: "Workflow",
        steps: [],
        createdAt: new Date().toISOString(),
        runCount: 0,
      });
    }
    setView("editor");
  };

  const openRunner = (workflow: Workflow) => {
    setRunningWorkflow(workflow);
    setRunStatus("idle");
    setStepResults(workflow.steps.map((s) => ({ stepId: s.id, status: "pending" })));
    setCurrentStepIndex(-1);
    const vars = extractVariables(workflow);
    const defaults: Record<string, string> = {};
    for (const v of vars) defaults[v] = "";
    setVariableValues(defaults);
    setView("runner");
  };

  const runWorkflow = useCallback(async () => {
    if (!runningWorkflow) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setRunStatus("running");
    setStepResults(runningWorkflow.steps.map((s) => ({ stepId: s.id, status: "pending" })));
    setCurrentStepIndex(0);

    try {
      const res = await fetch(`/api/workflows/${runningWorkflow.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: selectedPageId,
          variables: variableValues,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setRunStatus("failed");
        setStepResults((prev) =>
          prev.map((r, i) =>
            i === 0 ? { ...r, status: "failed", error: "Workflow run failed. The server returned an error." } : r
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            switch (event.type) {
              case "step_start":
                setCurrentStepIndex(event.stepIndex);
                setStepResults((prev) =>
                  prev.map((r, i) => (i === event.stepIndex ? { ...r, status: "running", aiContent: "" } : r))
                );
                break;

              case "step_ai_token":
                setStepResults((prev) =>
                  prev.map((r, i) =>
                    i === event.stepIndex ? { ...r, aiContent: (r.aiContent || "") + event.token } : r
                  )
                );
                break;

              case "step_ai_complete":
                setStepResults((prev) =>
                  prev.map((r, i) => (i === event.stepIndex ? { ...r, aiContent: event.content } : r))
                );
                break;

              case "step_complete":
                setStepResults((prev) =>
                  prev.map((r, i) =>
                    i === event.stepIndex ? { ...r, status: "completed", result: event.result } : r
                  )
                );
                break;

              case "step_error":
                setStepResults((prev) =>
                  prev.map((r, i) =>
                    i === event.stepIndex ? { ...r, status: "failed", error: event.error } : r
                  )
                );
                break;

              case "workflow_complete":
                setRunStatus("completed");
                break;
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }

      if (runStatus !== "completed") {
        setRunStatus("completed");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setRunStatus("failed");
      }
    }
  }, [runningWorkflow, selectedPageId, variableValues, runStatus]);

  const cancelRun = () => {
    abortRef.current?.abort();
    setRunStatus("failed");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-3xl max-h-[95vh] md:max-h-[85vh] mx-2 md:mx-4 bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <WorkflowIcon size={20} className="text-brand-blue" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {view === "list" ? "Workflows" : view === "editor" ? (editingWorkflow?.name || "New Workflow") : (runningWorkflow?.name || "Run Workflow")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {view !== "list" && (
              <button
                onClick={() => { setView("list"); setEditingWorkflow(null); setRunningWorkflow(null); }}
                className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={onClose}
              className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors touch-target"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === "list" && (
            <WorkflowList
              workflows={workflows}
              loading={loading}
              loadError={loadError}
              deleteError={deleteError}
              onRun={openRunner}
              onEdit={openEditor}
              onDelete={handleDeleteWorkflow}
              onCreate={() => openEditor()}
            />
          )}
          {view === "editor" && editingWorkflow && (
            <WorkflowEditor
              workflow={editingWorkflow}
              onChange={setEditingWorkflow}
              onSave={() => saveWorkflow(editingWorkflow)}
              onCancel={() => { setView("list"); setEditingWorkflow(null); }}
              showStepDropdown={showStepDropdown}
              setShowStepDropdown={setShowStepDropdown}
              saveError={saveError}
            />
          )}
          {view === "runner" && runningWorkflow && (
            <WorkflowRunner
              workflow={runningWorkflow}
              status={runStatus}
              stepResults={stepResults}
              currentStepIndex={currentStepIndex}
              variableValues={variableValues}
              onVariableChange={(key, value) => setVariableValues((prev) => ({ ...prev, [key]: value }))}
              onRun={runWorkflow}
              onCancel={cancelRun}
              onRetry={runWorkflow}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Workflow List ---

function WorkflowList({
  workflows,
  loading,
  loadError,
  deleteError,
  onRun,
  onEdit,
  onDelete,
  onCreate,
}: {
  workflows: Workflow[];
  loading: boolean;
  loadError: string | null;
  deleteError: string | null;
  onRun: (w: Workflow) => void;
  onEdit: (w?: Workflow) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={24} className="text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {loadError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        </div>
      )}
      {deleteError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {workflows.map((wf) => (
          <WorkflowCard
            key={wf.id}
            workflow={wf}
            onRun={() => onRun(wf)}
            onEdit={() => onEdit(wf)}
            onDelete={() => onDelete(wf.id)}
          />
        ))}

        {/* Create new workflow card */}
        <button
          onClick={onCreate}
          className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-brand-blue dark:hover:border-brand-blue hover:bg-brand-blue/5 transition-all duration-200 min-h-[160px] group"
        >
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-brand-blue/10 transition-colors">
            <Plus size={20} className="text-gray-400 group-hover:text-brand-blue transition-colors" />
          </div>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-brand-blue transition-colors">
            Create Workflow
          </span>
        </button>
      </div>
    </div>
  );
}

function WorkflowCard({
  workflow,
  onRun,
  onEdit,
  onDelete,
}: {
  workflow: Workflow;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="relative flex flex-col p-5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#2c2c2e] hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Template badge */}
      {workflow.isTemplate && (
        <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-blue bg-brand-blue/10 rounded-full">
          Template
        </span>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
          <IconByName name={workflow.icon} size={18} className="text-brand-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{workflow.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{workflow.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500 mt-auto">
        <span>{workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}</span>
        {workflow.lastRunAt && (
          <>
            <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span>Run {workflow.runCount}x</span>
          </>
        )}
      </div>

      {/* Action buttons -- always visible on mobile, hover on desktop */}
      <div
        className={`flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700/50 transition-opacity duration-150 ${
          showActions ? "opacity-100" : "max-md:opacity-100 md:opacity-0"
        }`}
      >
        <button
          onClick={onRun}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand-blue rounded-lg hover:bg-brand-blue/90 active:bg-brand-blue/80 transition-colors touch-target min-h-[36px]"
        >
          <Play size={12} />
          Run
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 transition-colors touch-target min-h-[36px]"
        >
          <Edit size={12} />
          Edit
        </button>
        {!workflow.isTemplate && (
          <button
            onClick={onDelete}
            className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// --- Workflow Editor ---

function WorkflowEditor({
  workflow,
  onChange,
  onSave,
  onCancel,
  showStepDropdown,
  setShowStepDropdown,
  saveError,
}: {
  workflow: Workflow;
  onChange: (w: Workflow) => void;
  onSave: () => void;
  onCancel: () => void;
  showStepDropdown: boolean;
  setShowStepDropdown: (v: boolean) => void;
  saveError: string | null;
}) {
  const updateField = (field: string, value: any) => {
    onChange({ ...workflow, [field]: value });
  };

  const addStep = (type: string) => {
    const stepType = STEP_TYPES.find((s) => s.type === type);
    if (!stepType) return;
    const step: WorkflowStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type,
      label: stepType.label,
      description: "",
      config: {},
      usesAI: ["create_page", "update_page", "create_post", "update_seo", "update_product"].includes(type),
      prompt: "",
    };
    onChange({ ...workflow, steps: [...workflow.steps, step] });
    setShowStepDropdown(false);
  };

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    const steps = [...workflow.steps];
    steps[index] = { ...steps[index], ...updates };
    onChange({ ...workflow, steps });
  };

  const removeStep = (index: number) => {
    const steps = workflow.steps.filter((_, i) => i !== index);
    onChange({ ...workflow, steps });
  };

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= workflow.steps.length) return;
    const steps = [...workflow.steps];
    const [moved] = steps.splice(from, 1);
    steps.splice(to, 0, moved);
    onChange({ ...workflow, steps });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Name and description */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Workflow Name
          </label>
          <input
            type="text"
            value={workflow.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g. Launch Landing Page"
            className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/20 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={workflow.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="What does this workflow do?"
            className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/20 transition-colors"
          />
        </div>
      </div>

      {/* Steps */}
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Steps ({workflow.steps.length})
        </label>

        <div className="space-y-3">
          {workflow.steps.map((step, index) => (
            <StepEditor
              key={step.id}
              step={step}
              index={index}
              totalSteps={workflow.steps.length}
              onUpdate={(updates) => updateStep(index, updates)}
              onRemove={() => removeStep(index)}
              onMoveUp={() => moveStep(index, index - 1)}
              onMoveDown={() => moveStep(index, index + 1)}
            />
          ))}
        </div>

        {/* Add step */}
        <div className="relative mt-3">
          <button
            onClick={() => setShowStepDropdown(!showStepDropdown)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#2c2c2e] border border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-brand-blue hover:text-brand-blue transition-colors w-full"
          >
            <Plus size={16} />
            Add step
            <ChevronDown size={14} className="ml-auto" />
          </button>

          {showStepDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowStepDropdown(false)} />
              <div className="absolute left-0 right-0 mt-1 z-20 bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                {STEP_TYPES.map((st) => (
                  <button
                    key={st.type}
                    onClick={() => addStep(st.type)}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <IconByName name={st.icon} size={16} className="text-gray-400" />
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
        {saveError && (
          <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={!workflow.name.trim() || workflow.steps.length === 0}
            className="px-5 py-2.5 text-sm font-medium text-white bg-brand-blue rounded-xl hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save Workflow
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function StepEditor({
  step,
  index,
  totalSteps,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: WorkflowStep;
  index: number;
  totalSteps: number;
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const stepType = STEP_TYPES.find((s) => s.type === step.type);

  return (
    <div className="border border-gray-150 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-[#232325]">
      {/* Step header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-5 h-3 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 disabled:opacity-30 transition-colors"
          >
            <ChevronDown size={12} className="rotate-180" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalSteps - 1}
            className="w-5 h-3 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 disabled:opacity-30 transition-colors"
          >
            <ChevronDown size={12} />
          </button>
        </div>

        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
          {index + 1}
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <IconByName name={stepType?.icon || "Workflow"} size={14} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {step.label || stepType?.label || step.type}
          </span>
          {step.usesAI && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-blue bg-brand-blue/10 rounded flex-shrink-0">
              AI
            </span>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <ChevronRight size={14} className={`transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} />
        </button>

        <button
          onClick={onRemove}
          className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700/50 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Label</label>
            <input
              type="text"
              value={step.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white outline-none focus:border-brand-blue transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Description</label>
            <input
              type="text"
              value={step.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="What does this step do?"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-brand-blue transition-colors"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={step.usesAI}
                onChange={(e) => onUpdate({ usesAI: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
              />
              <span className="text-xs text-gray-600 dark:text-gray-300">Uses AI generation</span>
            </label>
          </div>
          {step.usesAI && (
            <div>
              <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                AI Prompt
              </label>
              <textarea
                value={step.prompt || ""}
                onChange={(e) => onUpdate({ prompt: e.target.value })}
                placeholder="Describe what the AI should generate for this step. Use {{variables}} for dynamic values."
                rows={4}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#1c1c1e] border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-brand-blue transition-colors resize-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Use {"{{variable}}"} syntax for values filled in at runtime.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Workflow Runner ---

function WorkflowRunner({
  workflow,
  status,
  stepResults,
  currentStepIndex,
  variableValues,
  onVariableChange,
  onRun,
  onCancel,
  onRetry,
}: {
  workflow: Workflow;
  status: "idle" | "running" | "completed" | "failed";
  stepResults: StepResult[];
  currentStepIndex: number;
  variableValues: Record<string, string>;
  onVariableChange: (key: string, value: string) => void;
  onRun: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const variables = extractVariables(workflow);
  const hasUnfilledVars = variables.some((v) => !variableValues[v]?.trim());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current step
  useEffect(() => {
    if (scrollRef.current && currentStepIndex >= 0) {
      const stepEl = scrollRef.current.querySelector(`[data-step="${currentStepIndex}"]`);
      stepEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentStepIndex]);

  return (
    <div className="p-6 space-y-6">
      {/* Workflow description */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
          <IconByName name={workflow.icon} size={20} className="text-brand-blue" />
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{workflow.description}</p>
          <p className="text-xs text-gray-400 mt-1">
            {workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}
            {workflow.steps.filter((s) => s.usesAI).length > 0 &&
              ` -- ${workflow.steps.filter((s) => s.usesAI).length} using AI`}
          </p>
        </div>
      </div>

      {/* Variables */}
      {variables.length > 0 && status === "idle" && (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Variables
          </label>
          {variables.map((v) => (
            <div key={v}>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 capitalize">{v}</label>
              <input
                type="text"
                value={variableValues[v] || ""}
                onChange={(e) => onVariableChange(v, e.target.value)}
                placeholder={`Enter ${v}...`}
                className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-[#2c2c2e] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/20 transition-colors"
              />
            </div>
          ))}
        </div>
      )}

      {/* Run / Cancel controls */}
      <div className="flex items-center gap-3">
        {status === "idle" && (
          <button
            onClick={onRun}
            disabled={hasUnfilledVars}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-brand-blue rounded-xl hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={14} />
            Run Workflow
          </button>
        )}
        {status === "running" && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors"
          >
            <Pause size={14} />
            Cancel
          </button>
        )}
        {(status === "completed" || status === "failed") && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-brand-blue rounded-xl hover:bg-brand-blue/90 transition-colors"
          >
            <RotateCcw size={14} />
            Run Again
          </button>
        )}

        {status === "completed" && (
          <span className="text-sm font-medium text-green-600 dark:text-green-400">Workflow completed</span>
        )}
        {status === "failed" && (
          <span className="text-sm font-medium text-red-500">Workflow stopped</span>
        )}
      </div>

      {/* Stepper */}
      <div ref={scrollRef} className="space-y-0">
        {workflow.steps.map((step, index) => {
          const result = stepResults[index];
          return (
            <StepProgress
              key={step.id}
              step={step}
              index={index}
              result={result}
              isLast={index === workflow.steps.length - 1}
            />
          );
        })}
      </div>
    </div>
  );
}

function StepProgress({
  step,
  index,
  result,
  isLast,
}: {
  step: WorkflowStep;
  index: number;
  result: StepResult;
  isLast: boolean;
}) {
  const stepType = STEP_TYPES.find((s) => s.type === step.type);
  const [showAiContent, setShowAiContent] = useState(false);

  const statusColor = {
    pending: "bg-gray-200 dark:bg-gray-700",
    running: "bg-brand-blue",
    completed: "bg-green-500",
    failed: "bg-red-500",
    skipped: "bg-gray-300 dark:bg-gray-600",
  }[result?.status || "pending"];

  const statusIcon = {
    pending: null,
    running: <Loader size={12} className="text-white animate-spin" />,
    completed: <Check size={12} className="text-white" />,
    failed: <X size={12} className="text-white" />,
    skipped: <ArrowRight size={12} className="text-white" />,
  }[result?.status || "pending"];

  return (
    <div data-step={index} className="flex gap-4">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${statusColor} ${
            result?.status === "running" ? "ring-4 ring-brand-blue/20" : ""
          }`}
        >
          {statusIcon || (
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">{index + 1}</span>
          )}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-[24px] transition-colors duration-300 ${
              result?.status === "completed" ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
        <div className="flex items-center gap-2">
          <IconByName name={stepType?.icon || "Workflow"} size={14} className="text-gray-400" />
          <h4
            className={`text-sm font-medium transition-colors duration-200 ${
              result?.status === "running"
                ? "text-brand-blue"
                : result?.status === "completed"
                ? "text-gray-900 dark:text-white"
                : result?.status === "failed"
                ? "text-red-600 dark:text-red-400"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {step.label}
          </h4>
          {step.usesAI && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-blue bg-brand-blue/10 rounded">
              AI
            </span>
          )}
        </div>

        {step.description && (
          <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
        )}

        {/* AI streaming content */}
        {result?.status === "running" && result.aiContent && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-[#2c2c2e] rounded-lg border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-pre-wrap line-clamp-6">
              {result.aiContent.slice(-500)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span className="w-1 h-1 rounded-full bg-brand-blue animate-pulse" />
              <span className="text-[10px] text-gray-400">Generating...</span>
            </div>
          </div>
        )}

        {/* Completed result */}
        {result?.status === "completed" && result.result && (
          <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-800/30">
            <p className="text-xs text-green-700 dark:text-green-400">
              {result.result.link
                ? `Created: ${result.result.link}`
                : result.result.message
                ? result.result.message
                : result.result.updated
                ? "Updated successfully"
                : "Completed"}
            </p>
          </div>
        )}

        {/* Completed AI content (collapsible) */}
        {result?.status === "completed" && result.aiContent && (
          <button
            onClick={() => setShowAiContent(!showAiContent)}
            className="mt-1 text-[11px] text-brand-blue hover:underline flex items-center gap-1"
          >
            <ChevronRight size={10} className={`transition-transform ${showAiContent ? "rotate-90" : ""}`} />
            {showAiContent ? "Hide" : "Show"} AI output
          </button>
        )}
        {showAiContent && result?.aiContent && (
          <div className="mt-1 p-3 bg-gray-50 dark:bg-[#2c2c2e] rounded-lg border border-gray-100 dark:border-gray-700 max-h-40 overflow-y-auto">
            <p className="text-xs text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap">{result.aiContent}</p>
          </div>
        )}

        {/* Error */}
        {result?.status === "failed" && result.error && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-800/30">
            <p className="text-xs text-red-600 dark:text-red-400">{result.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
