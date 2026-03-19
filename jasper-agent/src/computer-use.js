import { randomUUID } from "node:crypto";
import { createEventStore } from "../../jasper-memory/src/event-store.js";

const PLAN_EVENT_TYPE = "computer-use.plan";
const STEP_EVENT_TYPE = "computer-use.step";
const APPROVAL_EVENT_TYPE = "computer-use.approval";
const EXECUTION_EVENT_TYPE = "computer-use.execution";

function defaultEventStore(options = {}) {
  return createEventStore({
    root: options.memoryRoot,
    jasperHome: options.jasperHome,
    source: "jasper-computer-use",
  });
}

function normalizeLimit(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function mapPlan(event, relatedEvents) {
  if (!event) {
    return null;
  }

  const payload = event.payload || {};
  const steps = (payload.steps || []).map((step) => ({
    stepId: step.stepId,
    description: step.description,
    requiresApproval: Boolean(step.requiresApproval),
    status: "pending",
    updatedAt: null,
  }));

  let approvedAt = null;
  const approvalEvents = relatedEvents.filter(
    (entry) =>
      entry.type === APPROVAL_EVENT_TYPE &&
      entry.payload?.planId === payload.planId,
  );
  if (approvalEvents.length > 0) {
    approvedAt = approvalEvents[approvalEvents.length - 1].ts;
  }

  const executionEvents = relatedEvents.filter(
    (entry) =>
      entry.type === EXECUTION_EVENT_TYPE &&
      entry.payload?.planId === payload.planId,
  );

  const stepEvents = relatedEvents.filter(
    (entry) =>
      entry.type === STEP_EVENT_TYPE &&
      entry.payload?.planId === payload.planId,
  );

  for (const entry of stepEvents) {
    const match = steps.find((step) => step.stepId === entry.payload.stepId);
    if (match) {
      match.status = entry.payload.status || match.status;
      match.updatedAt = entry.ts;
    }
  }

  let status = "open";
  if (payload.requiresApproval && !approvedAt) {
    status = "approval_required";
  } else if (executionEvents.length === 0) {
    status = status === "approval_required" ? status : "ready";
  } else {
    status = "completed";
  }

  return {
    planId: payload.planId,
    title: payload.title,
    description: payload.description,
    context: payload.context,
    requiresApproval: Boolean(payload.requiresApproval),
    status,
    createdAt: event.ts,
    approvedAt,
    steps,
    executionCount: executionEvents.length,
    lastExecutionAt:
      executionEvents.length > 0
        ? executionEvents[executionEvents.length - 1].ts
        : null,
    stepEvents,
  };
}

export function createComputerUseManager(options = {}) {
  const memory = options.memory || defaultEventStore(options);

  function buildPlanEvent(input = {}) {
    const steps = (input.steps || []).map((description, index) => ({
      stepId: input.steps[index]?.stepId || `step_${index + 1}`,
      description,
      requiresApproval: input.steps[index]?.requiresApproval ?? false,
    }));
    const planId = input.planId || `plan_${randomUUID()}`;
    return memory.appendEvent({
      type: PLAN_EVENT_TYPE,
      source: input.source || "jasper-computer-use",
      tags: ["computer-use", "plan"],
      payload: {
        planId,
        title: String(input.title || "computer action plan").trim(),
        description: input.description || "",
        context: input.context || {},
        requiresApproval: Boolean(input.requiresApproval),
        steps,
      },
    });
  }

  function listPlans(listOptions = {}) {
    const limit = normalizeLimit(listOptions.limit, 20);
    const events = memory
      .listRecentEvents({ limit: Math.max(200, limit) })
      .filter((event) => event.type === PLAN_EVENT_TYPE);
    return events.map((event) =>
      mapPlan(event, memory.listRecentEvents({ limit: 200 })),
    );
  }

  function getPlan(planId) {
    const limit = 200;
    const events = memory
      .listRecentEvents({ limit })
      .filter(
        (event) =>
          event.payload?.planId === planId ||
          event.payload?.planId === planId,
      );
    const planEvent = events.find((event) => event.type === PLAN_EVENT_TYPE);
    if (!planEvent) {
      return null;
    }
    return mapPlan(planEvent, events);
  }

  function requireApproval(planId, note) {
    memory.appendEvent({
      type: APPROVAL_EVENT_TYPE,
      source: "jasper-computer-use",
      tags: ["computer-use", "approval"],
      payload: {
        planId,
        approved: false,
        note: note || null,
      },
    });
    return getPlan(planId);
  }

  function approvePlan(planId, note) {
    const plan = getPlan(planId);
    if (!plan) {
      throw new Error(`Unknown plan: ${planId}`);
    }
    memory.appendEvent({
      type: APPROVAL_EVENT_TYPE,
      source: "jasper-computer-use",
      tags: ["computer-use", "approval"],
      payload: {
        planId,
        approved: true,
        note: note || null,
      },
    });
    return getPlan(planId);
  }

  function runPlan(runOptions = {}) {
    const plan = getPlan(runOptions.planId);
    if (!plan) {
      throw new Error(`Unknown plan: ${runOptions.planId}`);
    }
    if (plan.requiresApproval && !plan.approvedAt) {
      return {
        status: "approval_required",
        planId: plan.planId,
        steps: plan.steps,
      };
    }
    const stepEvents = [];
    for (const step of plan.steps) {
      const stepEvent = memory.appendEvent({
        type: STEP_EVENT_TYPE,
        source: "jasper-computer-use",
        tags: ["computer-use", "step"],
        payload: {
          planId: plan.planId,
          stepId: step.stepId,
          description: step.description,
          status: "completed",
        },
      });
      stepEvents.push(stepEvent);
    }

    memory.appendEvent({
      type: EXECUTION_EVENT_TYPE,
      source: "jasper-computer-use",
      tags: ["computer-use", "execution"],
      payload: {
        planId: plan.planId,
        stage: runOptions.stage || "manual",
        steps: stepEvents.map((event) => ({
          stepId: event.payload.stepId,
          status: event.payload.status,
        })),
      },
    });

    return getPlan(plan.planId);
  }

  function listPendingApprovals(listOptions = {}) {
    const limit = normalizeLimit(listOptions.limit, 20);
    return listPlans({ limit }).filter((plan) => plan.status === "approval_required");
  }

  return {
    createPlan(planOptions = {}) {
      const planEvent = buildPlanEvent(planOptions);
      return mapPlan(planEvent, [planEvent]);
    },
    listPlans,
    getPlan,
    requireApproval,
    approvePlan,
    runPlan,
    listPendingApprovals,
  };
}
