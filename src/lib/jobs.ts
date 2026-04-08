export interface Job {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: 'queued' | 'running' | 'streaming' | 'confirming' | 'executing' | 'completed' | 'failed' | 'cancelled';
  steps: JobStep[];
  currentStep: number;
  result?: {
    pageId?: number;
    pageUrl?: string;
    message?: string;
  };
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface JobStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  detail?: string;
  duration?: number;
}

let stepCounter = 0;

function stepId(): string {
  return `step-${Date.now()}-${++stepCounter}`;
}

export function createJob(
  type: string,
  title: string,
  steps?: Partial<JobStep>[]
): Job {
  const defaultSteps: JobStep[] = (steps || []).map((s, i) => ({
    id: s.id || stepId(),
    label: s.label || `Step ${i + 1}`,
    status: s.status || 'pending',
    detail: s.detail,
    duration: s.duration,
  }));

  // Mark first step as running if there are any
  if (defaultSteps.length > 0 && defaultSteps[0].status === 'pending') {
    defaultSteps[0].status = 'running';
  }

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    title,
    status: 'running',
    steps: defaultSteps,
    currentStep: 0,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
  };
}

export function updateJobStatus(job: Job, status: Job['status']): Job {
  return { ...job, status };
}

export function advanceJobStep(job: Job, detail?: string): Job {
  const steps = job.steps.map((s, i) => {
    if (i === job.currentStep) {
      return {
        ...s,
        status: 'completed' as const,
        detail: detail || s.detail,
        duration: job.startedAt
          ? Date.now() - new Date(job.startedAt).getTime()
          : undefined,
      };
    }
    if (i === job.currentStep + 1) {
      return { ...s, status: 'running' as const };
    }
    return s;
  });

  return {
    ...job,
    steps,
    currentStep: Math.min(job.currentStep + 1, job.steps.length - 1),
  };
}

export function addJobStep(job: Job, label: string, status: JobStep['status'] = 'pending'): Job {
  return {
    ...job,
    steps: [...job.steps, { id: stepId(), label, status }],
  };
}

export function completeJob(job: Job, result?: Job['result']): Job {
  const steps = job.steps.map((s) => {
    if (s.status === 'running' || s.status === 'pending') {
      return { ...s, status: 'completed' as const };
    }
    return s;
  });

  return {
    ...job,
    steps,
    status: 'completed',
    result,
    completedAt: new Date().toISOString(),
    currentStep: job.steps.length - 1,
  };
}

export function failJob(job: Job, error: string): Job {
  const steps = job.steps.map((s) => {
    if (s.status === 'running') {
      return { ...s, status: 'failed' as const };
    }
    if (s.status === 'pending') {
      return { ...s, status: 'skipped' as const };
    }
    return s;
  });

  return {
    ...job,
    steps,
    status: 'failed',
    error,
    completedAt: new Date().toISOString(),
  };
}

export function cancelJob(job: Job): Job {
  const steps = job.steps.map((s) => {
    if (s.status === 'running' || s.status === 'pending') {
      return { ...s, status: 'skipped' as const };
    }
    return s;
  });

  return {
    ...job,
    steps,
    status: 'cancelled',
    completedAt: new Date().toISOString(),
  };
}

export function getJobIcon(type: string): string {
  switch (type) {
    case 'create_page': return 'Document';
    case 'update_page': return 'Edit';
    case 'update_seo': return 'BarChart';
    case 'chat': return 'MessageSquare';
    case 'workflow': return 'Workflow';
    default: return 'Zap';
  }
}

export function getJobDuration(job: Job): string {
  const start = job.startedAt ? new Date(job.startedAt).getTime() : new Date(job.createdAt).getTime();
  const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
  const ms = end - start;

  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function isJobActive(job: Job): boolean {
  return ['queued', 'running', 'streaming', 'confirming', 'executing'].includes(job.status);
}

const MAX_HISTORY = 50;

export function trimJobHistory(jobs: Job[]): Job[] {
  const active = jobs.filter(isJobActive);
  const completed = jobs.filter((j) => !isJobActive(j));
  return [...active, ...completed.slice(0, MAX_HISTORY - active.length)];
}
