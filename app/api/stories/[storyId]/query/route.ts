import { NextRequest, NextResponse } from "next/server";
import type { StoryConfig, StoryDisplayConfig } from "@/data/registry";
import {
  validateQuery,
  isAnswerRequest,
} from "@/lib/game/guardrails";
import { getTopKEvidence } from "@/lib/game/embeddings";
import { chatCompletion } from "@/lib/game/openai";
import { getStoryConfig, getStoryDisplay, getStoryEvidence } from "@/lib/stories/store";
import {
  type Hypothesis,
  detectDeleteIntent,
  detectHypothesisIntent,
  extractHypothesisFromQuery,
  parseRecordIdsFromLLM,
  findMatchingHypothesis,
  deleteBestMatch,
  nextHypothesisId,
} from "@/lib/game/hypothesesSimple";
import { evaluateBadges } from "@/lib/game/badgeEngine";
import {
  cleanRecordIdToken,
  resolveRecordIdsAgainstRecords,
} from "@/lib/game/recordIds";
import { parseSubmission } from "@/lib/game/submissionParser";
import { gradeSubmission, isSolved } from "@/lib/game/grader";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/entitlements/check";
import { checkAndDecrementCredits } from "@/lib/credits";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 15;
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  if (!entry) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

const SYSTEM_PROMPT = `당신은 "사건 기록 시스템 v1.4(Evidence Archive System)"입니다.
조사관의 질문에 대해, 기록을 바탕으로 **질문에 직접 답하는** 형태로 응답하세요.

## 핵심 원칙
- RECORD 블록을 나열하지 마세요. 질문에 대한 답변처럼 자연스럽게 서술하세요.
- "조회 결과, ...", "기록에 따르면 ...", "확인된 바에 따르면 ..." 등으로 시작해 질문에 직접 응답하세요.
- 기록 내용을 문장 속에 자연스럽게 녹여 넣되, 형식적인 [RECORD id] TYPE: EXCERPT: 는 사용하지 마세요.
- 예: "박지훈은 21시에 뭘 했지?" → "21시경 박지훈은 3층 복도에서 김도윤 집무실로 이동해 21:12 입실, 21:18 서류를 든 채 퇴실한 것으로 확인됩니다(기록 007, 026)."

## 절대 금지
- 사건의 범인/동기/방법을 판정하거나 정답을 알려주지 마세요.
- "~가 범인입니다", "정답은 ~" 같은 결론을 내리지 마세요.
- 추리나 해설을 하지 마세요.

## 반드시 수행
1. RETRIEVED_EVIDENCE에서 관련 기록 1~3개를 골라, 그 내용을 질문에 답하는 문장으로 재구성하세요.
2. SUGGESTION에 다음에 확인해볼 만한 질문 2~3개를 제시하세요.

## 출력 포맷 (엄수)
RESPONSE: <질문에 대한 답변. 2~5문장. 기록 내용을 자연스럽게 인용. 판정/추리 없이 사실만>
SOURCES: [기록 021], [기록 e_07]  (인용한 기록 id만, 없으면 생략 가능)
HYPOTHESIS_IMPACT: H1:support, H2:conflict  (가설이 있을 때만. 해당 없으면 (none))
SUGGESTION:
- <다음 질문 후보 1>
- <다음 질문 후보 2>
- <다음 질문 후보 3>

## HYPOTHESIS_IMPACT 상세
CURRENT_HYPOTHESES에 나열된 가설 중, 이번 인용 기록(SOURCES)이 **지지(support)** 하거나 **충돌(conflict)** 하는 가설이 있으면 반드시 아래 형식으로 적으세요.
- support: 기록이 해당 가설을 뒷받침함 (예: "박지훈이 범인" + 박지훈의 수상한 행적)
- conflict: 기록이 해당 가설과 모순됨 (예: "박지훈이 범인" + 박지훈의 확실한 알리바이)
형식: HYPOTHESIS_IMPACT: H1:support, H2:conflict
해당 없으면: HYPOTHESIS_IMPACT: (none)

## 오프토픽 질문 시
사건과 전혀 무관한 질문(날씨, 요리, 스포츠, 잡담 등)이 들어오면:
- 사용자가 물어본 내용을 짧게 언급하며 위트 있게 받아쳐 주세요. (예: "피자 배달 경로는 제 관할 밖입니다")
- 단, 1~2문장 이내로 짧게.
- 이후 자연스럽게 수사로 돌아오도록 유도하세요.
RESPONSE: <사용자 질문을 반영한 짧고 위트 있는 거절 + 수사 복귀 유도>
SUGGESTION:
- 피해자의 사건 당일 동선은?
- 현장에 남은 물증은?
- 사건과 관련된 주요 인물은?

## 정답/범인 요청 시
RESPONSE: 본 시스템은 범인을 판정하거나 해설하지 않습니다. 기록을 연결해 스스로 재구성해 주세요.
SUGGESTION:
- 피해자의 마지막 행적은?
- 특정 용의자의 사건 당일 움직임은?
- 사건 동기를 보여주는 문서 기록은?

## 결론 제출 시
결론은 /추리 명령으로 제출해야 합니다. 예: /추리 [범인]. [범행 동기]. [범행 수법]
결론 형식의 일반 질문이면: RESPONSE: 근거 확인을 위해 /추리로 결론을 제출해 주세요.
SUGGESTION에 관련 조회 예시 2~3개 제시.`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  const { storyId } = await params;

  // Server-side credit check for authenticated non-premium users
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let remainingCredits: number | undefined;
  if (user) {
    const plan = await getUserPlan(user.id);
    const isUnlimited = plan === 'watson' || plan === 'sherlock';
    if (!isUnlimited) {
      const result = await checkAndDecrementCredits(user.id);
      if (!result.allowed) {
        return NextResponse.json(
          { error: "일일 질문 한도에 도달했습니다. 내일 다시 시도하거나 플랜을 업그레이드하세요.", remainingCredits: 0 },
          { status: 429 }
        );
      }
      remainingCredits = result.remaining;
    }
  }

  const config = await getStoryConfig(storyId);
  const display = await getStoryDisplay(storyId);
  if (!config || !display) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  let body: {
    query: string;
    history?: { role: string; content: string }[];
    hypotheses?: Hypothesis[];
    seenRecordIds?: string[];
    triggeredBadges?: string[];
    sessionState?: {
      solved?: boolean;
      solvedAt?: string;
      hintCount?: number;
      pendingHypothesisReplace?: { newText: string; matchedHypothesisId: string };
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    query,
    history = [],
    hypotheses: incomingHypotheses = [],
    seenRecordIds: incomingSeenIds = [],
    triggeredBadges: incomingTriggered = [],
    sessionState: incomingSession = {},
  } = body;

  if (incomingSession?.solved === true) {
    return NextResponse.json({
      response: "사건이 종결되었습니다. 새로고침 후 다시 시작하세요.",
      sources: [],
      suggestions: [],
      hypotheses: [],
      seenRecordIds: incomingSeenIds ?? [],
      triggeredBadges: incomingTriggered ?? [],
      solved: true,
      sessionState: { solved: true, solvedAt: incomingSession.solvedAt },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }
  const seenRecordIds = Array.isArray(incomingSeenIds) ? [...incomingSeenIds] : [];
  let triggeredBadges = Array.isArray(incomingTriggered) ? [...incomingTriggered] : [];
  let hypotheses: Hypothesis[] = [];
  if (Array.isArray(incomingHypotheses)) {
    hypotheses = incomingHypotheses
      .filter(
        (h): h is Hypothesis =>
          h &&
          typeof h === "object" &&
          typeof h.id === "string" &&
          typeof h.text === "string" &&
          typeof h.support === "number" &&
          typeof h.conflict === "number"
      )
      .map((h) => ({
        id: String(h.id),
        text: String(h.text).slice(0, 120),
        support: Math.max(0, Number(h.support)),
        conflict: Math.max(0, Number(h.conflict)),
      }))
      .slice(0, MAX_HYPOTHESES);
  }
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const hintCount = Math.min(3, Math.max(0, Number(incomingSession?.hintCount) || 0));
  const defaultSuggestions = buildLeadSuggestions(config, display, seenRecordIds);

  if (/^\/현장$/i.test(query.trim())) {
    return NextResponse.json({
      response: buildSceneResponse(display),
      sources: [],
      suggestions: defaultSuggestions,
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved: false,
      sessionState: { solved: false, hintCount },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  if (/^\/인물$/i.test(query.trim())) {
    return NextResponse.json({
      response: buildCharacterResponse(display),
      sources: [],
      suggestions: defaultSuggestions,
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved: false,
      sessionState: { solved: false, hintCount },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  const characterQueryMatch = query.trim().match(/^\/인물\s+(.+)$/i);
  if (characterQueryMatch) {
    const targetName = characterQueryMatch[1].trim();
    return NextResponse.json({
      response: buildCharacterResponse(display, targetName),
      sources: [],
      suggestions: defaultSuggestions,
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved: false,
      sessionState: { solved: false, hintCount },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  if (/^\/단서$/i.test(query.trim()) || /^\/진행도$/i.test(query.trim())) {
    return NextResponse.json({
      response: buildInvestigationResponse(config, display, seenRecordIds, hypotheses.length),
      sources: [],
      suggestions: defaultSuggestions,
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved: false,
      sessionState: { solved: false, hintCount },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  if (/^\/포기$/i.test(query.trim())) {
    if (hintCount < 3) {
      return NextResponse.json({
        response: "힌트를 3번 모두 사용한 후에 포기할 수 있습니다.",
        sources: [],
        suggestions: defaultSuggestions,
        hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
        seenRecordIds,
        triggeredBadges,
        solved: false,
        sessionState: { solved: false, hintCount },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
      });
    }
    const responseText = `[포기]

${config.ending.solvedTitle}

${config.ending.solvedSummaryLines.map((l) => `- ${l}`).join("\n")}

${config.ending.closedLine}`;

    return NextResponse.json({
      response: responseText,
      sources: [],
      suggestions: [],
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved: true,
      sessionState: { solved: true, solvedAt: new Date().toISOString(), hintCount },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  if (/^\/힌트$/i.test(query.trim())) {
    const MAX_HINTS = 3;
    if (hintCount >= MAX_HINTS) {
      return NextResponse.json({
        response: `힌트는 ${MAX_HINTS}번까지 사용 가능합니다. (${hintCount}/${MAX_HINTS} 사용 완료)\n\n포기하시려면 /포기 를 입력하세요.`,
        sources: [],
        suggestions: ["/포기", ...defaultSuggestions.slice(0, 2)],
        hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
        seenRecordIds,
        triggeredBadges,
        solved: false,
        sessionState: { solved: false, hintCount },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
      });
    }
    const hints: string[] = [
      display.INVESTIGATION_TRACKS?.[0]?.lead ?? "사건 당일의 동선과 출입 기록부터 정리해 보세요.",
      display.INVESTIGATION_TRACKS?.[1]?.lead ?? "현장 물증과 직접적인 범행 흔적을 먼저 연결해 보세요.",
      display.INVESTIGATION_TRACKS?.[2]?.lead ?? "동기와 숨겨진 관계를 보여주는 기록을 찾아보세요.",
    ];
    const requiredHints = config.nextQuestions?.requiredRecordHint
      ? Object.entries(config.nextQuestions.requiredRecordHint).map(([id, q]) => ({ id, q }))
      : [];
    const unseenRequired = requiredHints.filter((r) => !seenRecordIds.includes(r.id));
    let hintText: string;
    if (hintCount === 0) {
      hintText = hints[0];
    } else if (hintCount === 1) {
      hintText = hints[1];
    } else {
      hintText = unseenRequired.length > 0
        ? `[힌트] ${unseenRequired[0].q}`
        : hints[2];
    }
    return NextResponse.json({
        response: `[힌트 ${hintCount + 1}/${MAX_HINTS}] ${hintText}`,
        sources: [],
        suggestions: defaultSuggestions,
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved: false,
      sessionState: { solved: false, hintCount: hintCount + 1 },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  const pendingReplace = incomingSession?.pendingHypothesisReplace;
  const isConfirmReplace = /^(y|yes|예|네|ㅇ)$/i.test(query.trim());
  const isRejectReplace = /^(n|no|아니오|아니요|ㄴ)$/i.test(query.trim());

  if (pendingReplace && (isConfirmReplace || isRejectReplace)) {
    if (isConfirmReplace) {
      hypotheses = hypotheses
        .map((h) =>
          h.id === pendingReplace.matchedHypothesisId
            ? { ...h, text: pendingReplace.newText.slice(0, 120) }
            : h
        )
        .slice(0, MAX_HYPOTHESES);
      const noteText =
        pendingReplace.newText.length > 80
          ? pendingReplace.newText.slice(0, 80) + "..."
          : pendingReplace.newText;
      return NextResponse.json({
        response: `기존 가설을 변경했습니다: "${noteText}"`,
        sources: [],
        suggestions: [...defaultSuggestions.slice(0, 1), "해당 가설을 뒷받침하는 기록은?"],
        hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
        seenRecordIds,
        triggeredBadges,
        solved: false,
        sessionState: { solved: false },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
      });
    } else {
      if (hypotheses.length >= MAX_HYPOTHESES) {
        return NextResponse.json({
          response: "가설은 최대 5개까지입니다. 기존 가설을 삭제한 뒤 새로 기록해 주세요.",
          sources: [],
          suggestions: ["/삭제 (가설 삭제)", "해당 가설을 뒷받침하는 기록은?"],
          hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
          seenRecordIds,
          triggeredBadges,
          solved: false,
          sessionState: { solved: false },
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
        });
      }
      const newHyp: Hypothesis = {
        id: nextHypothesisId(hypotheses),
        text: pendingReplace.newText.slice(0, 120),
        support: 0,
        conflict: 0,
      };
      hypotheses = [...hypotheses, newHyp].slice(-MAX_HYPOTHESES);
      const noteText =
        pendingReplace.newText.length > 80
          ? pendingReplace.newText.slice(0, 80) + "..."
          : pendingReplace.newText;
      return NextResponse.json({
        response: `가설로 새로 기록했습니다: "${noteText}"`,
        sources: [],
        suggestions: [...defaultSuggestions.slice(0, 1), "해당 가설을 뒷받침하는 기록은?"],
        hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
        seenRecordIds,
        triggeredBadges,
        solved: false,
        sessionState: { solved: false },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
      });
    }
  }

  if (query.trim().startsWith("/추리 ")) {
    const gameText = query.trim().replace(/^\/추리\s+/i, "").trim();

    if (!gameText) {
      return NextResponse.json({
        response: "결론 내용을 입력해 주세요. 예: /추리 A가 B 때문에 C 방식으로 범행했다.",
        sources: [],
        suggestions: [
          "'누가/왜/어떻게'를 한 문장으로 정리해 주세요.",
          "예: 'A가 B 때문에 C로 범행했다.'",
        ],
        hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
        seenRecordIds,
        triggeredBadges,
        solved: false,
        sessionState: { solved: false },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
      });
    }

    const parse = parseSubmission(gameText, config.parsing, config.solution);
    const requiredSeen = config.solution.required_records.filter((id) => seenRecordIds.includes(id));
    const required_ratio =
      config.solution.required_records.length > 0
        ? requiredSeen.length / config.solution.required_records.length
        : 1;

    const grade = gradeSubmission(parse, required_ratio);
    const solved = isSolved(grade, gameText, parse, config.solution);

    const nq = config.nextQuestions;
    const nextQuestions: string[] = [];
    if (nq) {
      if (!parse.hasMotive && nq.motive.length > 0) nextQuestions.push(nq.motive[0]);
      if (!parse.hasMethod && nq.method.length > 0) nextQuestions.push(nq.method[0]);
      if (required_ratio < 0.66) {
        const unseen = config.solution.required_records.find((id) => !seenRecordIds.includes(id));
        if (unseen && nq.requiredRecordHint[unseen]) nextQuestions.push(nq.requiredRecordHint[unseen]);
      }
      if (nextQuestions.length < 2 && nq.crossCheck.length > 0) nextQuestions.push(nq.crossCheck[0]);
    }
    let finalNext = nextQuestions.slice(0, 2);
    if (finalNext.length === 0) {
      finalNext = defaultSuggestions.slice(0, 2);
    }

    const contentIsGood =
      parse.suspectMentioned &&
      parse.hasMotive &&
      parse.hasMethod &&
      parse.motiveHits >= 1 &&
      parse.methodHits >= 1;

    let message = "";
    if (grade === "A" && solved) {
      message = "사건 해결. 제출한 결론은 사건 기록과 일치합니다.";
    } else if (grade === "A") {
      message = "결론은 기록과 높은 정합성을 보입니다. 다만 핵심 인물 또는 연쇄를 한 번 더 점검해 보세요.";
    } else if (grade === "B" || contentIsGood) {
      message = "가능성은 있지만 근거가 아직 덜 모였습니다. 핵심 기록을 더 조회해 보세요.";
    } else {
      message = "'누가/왜/어떻게'를 한 문장으로 정리해 주세요. 예: 'A가 B 때문에 C로 범행했다.'";
    }

    let responseText = `[REPORT]
GRADE: ${grade}
STATUS: ${solved ? "SOLVED" : "NOT_SOLVED"}

[SYSTEM]
MESSAGE: ${message}`;

    if (!solved) {
      responseText += `

NEXT:
${finalNext.map((q) => `- ${q}`).join("\n")}`;
    }

    if (solved) {
      responseText += `

[END_LOG]
${config.ending.solvedTitle}
${config.ending.solvedSummaryLines.map((l) => `- ${l}`).join("\n")}
${config.ending.closedLine}`;
    }

    return NextResponse.json({
      response: responseText,
      grade,
      sources: [],
      suggestions: solved ? [] : finalNext,
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved,
      sessionState: solved
        ? { solved: true, solvedAt: new Date().toISOString() }
        : { solved: false },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  const guard = validateQuery(query);
  if (!guard.ok) {
    return NextResponse.json({
      response: guard.message,
      sources: [],
      suggestions: defaultSuggestions,
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved: false,
      sessionState: { solved: false },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  if (detectDeleteIntent(query)) {
    hypotheses = deleteBestMatch(hypotheses, query);
    return NextResponse.json({
      response: "해당 가설을 삭제했습니다.",
      sources: [],
      suggestions: [...defaultSuggestions.slice(0, 2), "다른 가설을 세워 보시겠어요?"],
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved: false,
      sessionState: { solved: false },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  if (detectHypothesisIntent(query)) {
    const hypothesisText = extractHypothesisFromQuery(query);
    if (!hypothesisText) {
      return NextResponse.json({
        response: "가설 내용을 입력해 주세요. 예: /가설 특정 인물이 사건을 연출했을 가능성이 있어",
        sources: [],
        suggestions: defaultSuggestions,
        hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
        seenRecordIds,
        triggeredBadges,
        solved: false,
        sessionState: { solved: false },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
      });
    }
    if (hypotheses.length >= MAX_HYPOTHESES) {
      return NextResponse.json({
        response: "가설은 최대 5개까지입니다. 기존 가설을 삭제하거나 변경해 주세요.",
        sources: [],
        suggestions: ["/삭제 (가설 삭제)", ...defaultSuggestions.slice(0, 1)],
        hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
        seenRecordIds,
        triggeredBadges,
        solved: false,
        sessionState: { solved: false },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
      });
    }
    const matched = findMatchingHypothesis(hypotheses, hypothesisText);
    if (matched) {
      return NextResponse.json({
        response: `기존 가설 [${matched.id}: ${matched.text}]과 유사합니다. 기존 가설을 변경할까요? (Y: 변경, N: 새로 기록)`,
        sources: [],
        suggestions: ["Y", "N"],
        hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
        seenRecordIds,
        triggeredBadges,
        solved: false,
        sessionState: {
          solved: false,
          pendingHypothesisReplace: {
            newText: hypothesisText,
            matchedHypothesisId: matched.id,
          },
        },
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
      });
    }
    const newHyp: Hypothesis = {
      id: nextHypothesisId(hypotheses),
      text: hypothesisText,
      support: 0,
      conflict: 0,
    };
    hypotheses = [...hypotheses, newHyp].slice(-MAX_HYPOTHESES);
    const noteText = hypothesisText.length > 80 ? hypothesisText.slice(0, 80) + "..." : hypothesisText;
    return NextResponse.json({
      response: `가설로 기록했습니다: "${noteText}"`,
      sources: [],
      suggestions: [...defaultSuggestions.slice(0, 1), "해당 가설을 뒷받침하는 기록은?"],
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved: false,
      sessionState: { solved: false },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  if (isAnswerRequest(query)) {
    return NextResponse.json({
      response:
        "본 시스템은 범인을 판정하거나 해설하지 않습니다. 기록을 연결해 스스로 재구성해 주세요.",
      sources: [],
      suggestions: defaultSuggestions,
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds,
      triggeredBadges,
      solved: false,
      sessionState: { solved: false },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, embeddingTokens: 0, costUsd: 0, costKrw: 0 },
    });
  }

  try {
    const [{ evidence: topK, embeddingUsage }, allEvidence] = await Promise.all([
      getTopKEvidence(storyId, query, 10),
      getStoryEvidence(storyId),
    ]);
    const context = topK
      .map(
        (e) =>
          `[RECORD ${e.id}] TYPE: ${e.type} TIME: ${e.time_range} ENTITIES: ${(e.entities ?? []).join(", ")} TAGS: ${(e.tags ?? []).join(", ")} TEXT: ${e.text ?? ""}`
      )
      .join("\n\n");

    const hypothesesBlock =
      hypotheses.length > 0
        ? `\nCURRENT_HYPOTHESES:\n${hypotheses.map((h) => `- ${h.id}: ${h.text}`).join("\n")}\n`
        : "";

    const userMessage = `RETRIEVED_EVIDENCE:
${context}
${hypothesesBlock}---
USER QUERY: ${query}

위 기록을 바탕으로 질문에 직접 답하는 RESPONSE를 작성하세요. 기록 내용을 문장에 자연스럽게 녹여 넣고, SOURCES에 인용한 기록 id를 적으세요.${hypotheses.length > 0 ? " 가설이 있으면 반드시 HYPOTHESIS_IMPACT를 출력하세요. 인용 기록이 가설을 지지하면 support, 모순되면 conflict로 표기." : ""}`;

    const trimmedHistory = history.slice(-8);
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...trimmedHistory
        .filter((h) => h.role && h.content)
        .map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
      { role: "user", content: userMessage },
    ];

    const chatResult = await chatCompletion(messages, { temperature: 0.5 });
    const parsed = parseResponse(chatResult.content);
    const rawLLM = chatResult.content;
    const resolvedSourceIds = resolveRecordIdsAgainstRecords(parsed.sources, allEvidence);
    const resolvedRecordIds = resolveRecordIdsAgainstRecords(parseRecordIdsFromLLM(rawLLM), allEvidence);

    if (!parsed.valid) {
      return NextResponse.json({
        response:
          parsed.response ||
          "관련 기록을 조회했습니다. 추가 질문을 통해 조사를 이어가 주세요.",
        sources: resolvedSourceIds.length > 0 ? resolvedSourceIds : parsed.sources,
        suggestions:
          parsed.suggestions.length >= 2
            ? parsed.suggestions
            : defaultSuggestions,
        hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
        seenRecordIds,
        triggeredBadges,
        solved: false,
        sessionState: { solved: false },
        usage: buildUsage(embeddingUsage, chatResult.usage),
      });
    }

    const hypothesisImpact = parseHypothesisImpact(rawLLM, hypotheses);
    if (hypothesisImpact.length > 0) {
      hypotheses = hypotheses.map((h) => {
        const impact = hypothesisImpact.find((i) => i.hypothesisId === h.id);
        if (!impact) return h;
        return {
          ...h,
          support: h.support + (impact.impact === "support" ? 1 : 0),
          conflict: h.conflict + (impact.impact === "conflict" ? 1 : 0),
        };
      });
    }

    const currentTurnRecordIds = resolvedRecordIds;
    const currentTurnEvidence = allEvidence.filter((e) =>
      currentTurnRecordIds.includes(e.id)
    );
    const newSeenIds = [...new Set([...seenRecordIds, ...currentTurnRecordIds])];

    const badgeResult = evaluateBadges({
      query,
      history,
      seenRecordIds,
      triggeredBadges,
      currentTurnRecordIds,
      currentTurnEvidence,
      hypotheses,
      allEvidence,
    });

    let badge: { title: string; condition: string } | undefined;
    if (badgeResult) {
      triggeredBadges = [...triggeredBadges, badgeResult.id];
      badge = {
        title: badgeResult.message.replace(/\.$/, ""),
        condition: badgeResult.condition,
      };
    }

    return NextResponse.json({
      response: parsed.response,
      badge,
      sources: resolvedSourceIds.length > 0 ? resolvedSourceIds : parsed.sources,
      suggestions: parsed.suggestions,
      hypotheses: hypotheses.slice(0, MAX_HYPOTHESES),
      seenRecordIds: newSeenIds,
      triggeredBadges,
      solved: false,
      sessionState: { solved: false },
      usage: buildUsage(embeddingUsage, chatResult.usage),
      ...(remainingCredits !== undefined && { remainingCredits }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    console.error("Query error:", message);
    const errHypotheses = Array.isArray(body?.hypotheses) ? body.hypotheses.slice(0, MAX_HYPOTHESES) : [];
    const errSeen = Array.isArray(body?.seenRecordIds) ? body.seenRecordIds : [];
    const errTriggered = Array.isArray(body?.triggeredBadges) ? body.triggeredBadges : [];
    return NextResponse.json(
      {
        error: "기록 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        hypotheses: errHypotheses,
        seenRecordIds: errSeen,
        triggeredBadges: errTriggered,
        solved: false,
        sessionState: { solved: false },
      },
      { status: 500 }
    );
  }
}

const GPT4O_MINI_INPUT_PER_1M = 0.15;
const GPT4O_MINI_OUTPUT_PER_1M = 0.6;
const EMBEDDING_PER_1M = 0.02;
const USD_TO_KRW = 1350;

function buildUsage(
  embeddingUsage: { totalTokens: number },
  chatUsage: { promptTokens: number; completionTokens: number; totalTokens: number }
) {
  const embeddingTokens = embeddingUsage.totalTokens;
  const promptTokens = chatUsage.promptTokens;
  const completionTokens = chatUsage.completionTokens;
  const costUsd =
    (promptTokens / 1_000_000) * GPT4O_MINI_INPUT_PER_1M +
    (completionTokens / 1_000_000) * GPT4O_MINI_OUTPUT_PER_1M +
    (embeddingTokens / 1_000_000) * EMBEDDING_PER_1M;
  const costKrw = Math.round(costUsd * USD_TO_KRW * 1000) / 1000;
  return {
    promptTokens,
    completionTokens,
    totalTokens: chatUsage.totalTokens + embeddingTokens,
    embeddingTokens,
    costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
    costKrw,
  };
}

const MAX_HYPOTHESES = 5;

function parseHypothesisImpact(
  text: string,
  hypotheses: Hypothesis[]
): { hypothesisId: string; impact: "support" | "conflict" }[] {
  if (hypotheses.length === 0) return [];
  const idMap = new Map<string, string>();
  for (const h of hypotheses) {
    idMap.set(h.id.toUpperCase(), h.id);
  }
  const match = text.match(/HYPOTHESIS_IMPACT:\s*([^\n]+)/i);
  if (!match) return [];
  const raw = match[1].trim();
  if (/\(none\)|없음|해당\s*없/i.test(raw)) return [];
  const parsed: { hypothesisId: string; impact: "support" | "conflict" }[] = [];
  const parts = raw.split(/[,;]\s*/).map((p) => p.trim());
  for (const part of parts) {
    const m = part.match(/^(H\d+)\s*:\s*(support|conflict|지지|충돌)$/i);
    if (!m) continue;
    const canonicalId = idMap.get(m[1].toUpperCase());
    if (!canonicalId) continue;
    const impact = /support|지지/i.test(m[2]) ? "support" : "conflict";
    parsed.push({ hypothesisId: canonicalId, impact });
  }
  return parsed;
}

function parseResponse(text: string): {
  valid: boolean;
  response?: string;
  sources: string[];
  suggestions: string[];
} {
  let response = "";
  const sources: string[] = [];
  const suggestions: string[] = [];

  const responseMatch = text.match(/RESPONSE:\s*([\s\S]+?)(?=\nSOURCES:|\nSUGGESTION:|$)/i);
  if (responseMatch) {
    response = responseMatch[1].trim();
  } else if (text.includes("SUGGESTION:")) {
    response = text.split("SUGGESTION:")[0].trim().replace(/^RESPONSE:\s*/i, "");
  }
  response = response.replace(/<BEGIN_HYPOTHESIS>[\s\S]*?<END_HYPOTHESIS>\s*/gi, "").trim();

  const sourcesMatch = text.match(/SOURCES:\s*([\s\S]+?)(?=\nSUGGESTION:|\n-|$)/i);
  if (sourcesMatch) {
    const ids = sourcesMatch[1].match(/기록\s*[A-Za-z0-9_]+|\[[A-Za-z0-9_]+\]/gi);
    if (ids) {
      for (const id of ids) {
        const normalized = cleanRecordIdToken(id);
        if (normalized) sources.push(normalized);
      }
    }
  }

  const suggestionMatch = text.match(/SUGGESTION:\s*([\s\S]+)/i);
  if (suggestionMatch) {
    const bullets = suggestionMatch[1].match(/-\s*([\s\S]+?)(?=\n-|\n\n|$)/g) || [];
    for (const b of bullets) {
      const cleaned = b.replace(/^-\s*/, "").replace(/\n/g, " ").trim();
      if (cleaned) suggestions.push(cleaned);
    }
  }

  const valid = response.length > 0 && suggestions.length >= 2;

  return {
    valid,
    response: response || undefined,
    sources: [...new Set(sources)].slice(0, 5),
    suggestions: suggestions.slice(0, 3),
  };
}

function buildLeadSuggestions(
  config: StoryConfig,
  display: StoryDisplayConfig,
  seenRecordIds: string[]
): string[] {
  const suggestions: string[] = [];

  for (const track of display.INVESTIGATION_TRACKS ?? []) {
    if (track.recordIds.some((id) => !seenRecordIds.includes(id))) {
      suggestions.push(track.prompt);
    }
  }

  for (const [recordId, prompt] of Object.entries(config.nextQuestions?.requiredRecordHint ?? {})) {
    if (!seenRecordIds.includes(recordId)) {
      suggestions.push(prompt);
    }
  }

  suggestions.push(...display.defaultSuggestions);

  return [...new Set(suggestions)].slice(0, 3);
}

function buildSceneResponse(display: StoryDisplayConfig): string {
  const scene = display.ASCII_SCENE;
  if (!scene) {
    return "[AREA_SCAN]\n현장 스캔 데이터가 아직 등록되지 않았습니다.";
  }

  const overview = scene.summary ?? scene.details?.[0];
  return [
    "[AREA_SCAN] " + scene.title,
    "─".repeat(36),
    ...(overview ? ["", overview, ""] : [""]),
    ...(scene.art?.length ? [...scene.art, ""] : []),
    ...(scene.details?.length
      ? ["DETAIL:", ...scene.details.map((item) => `  · ${item}`), ""]
      : []),
    "FOCUS:",
    ...scene.focus.map((item) => `  ▸ ${item}`),
  ].join("\n");
}

function buildSingleCharacterProfile(character: {
  name: string;
  role: string;
  ascii?: string[];
  brief: string;
}): string {
  return [
    `[PROFILE] ${character.name}`,
    `ROLE ▸ ${character.role}`,
    "─".repeat(32),
    ...(character.ascii?.length ? [...character.ascii, "─".repeat(32)] : []),
    `BRIEF: ${character.brief}`,
  ].join("\n");
}

function buildCharacterResponse(display: StoryDisplayConfig, targetName?: string): string {
  const characters = display.ASCII_CHARACTERS ?? [];
  if (characters.length === 0) {
    return "[PERSON_FILES]\n인물 시각화 데이터가 아직 등록되지 않았습니다.";
  }

  if (targetName) {
    const lower = targetName.toLowerCase();
    const target = characters.find(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        lower.includes(c.name.toLowerCase()) ||
        (c.queryHints ?? []).some((h) => h.toLowerCase().includes(lower))
    );
    if (target) return buildSingleCharacterProfile(target);
    return `[PERSON_FILES]\n'${targetName}' 프로파일을 찾을 수 없습니다.\n\n등록된 인물: ${characters.map((c) => c.name).join(", ")}`;
  }

  return [
    "[PERSON_FILES]",
    `등록 인원: ${characters.length}명`,
    "─".repeat(32),
    ...characters.map((c, i) => `${i + 1}. ${c.name}  (${c.role})\n   ${c.brief}`),
    "─".repeat(32),
    "상세 프로파일: /인물 [이름]",
  ].join("\n");
}

function renderProgressBar(current: number, total: number, width = 10): string {
  if (total <= 0) return "[----------]";
  const filled = Math.round((current / total) * width);
  return `[${"#".repeat(filled)}${"-".repeat(Math.max(0, width - filled))}]`;
}

function buildInvestigationResponse(
  config: StoryConfig,
  display: StoryDisplayConfig,
  seenRecordIds: string[],
  hypothesisCount: number
): string {
  const tracks = display.INVESTIGATION_TRACKS ?? [];
  const trackedIds = [...new Set(tracks.flatMap((track) => track.recordIds))];
  const trackedSeen = trackedIds.filter((id) => seenRecordIds.includes(id)).length;
  const criticalTotal = config.solution.required_records.length;
  const criticalSeen = config.solution.required_records.filter((id) =>
    seenRecordIds.includes(id)
  ).length;

  const openTracks = tracks
    .map((track) => ({
      ...track,
      seen: track.recordIds.filter((id) => seenRecordIds.includes(id)).length,
      total: track.recordIds.length,
    }))
    .sort((a, b) => a.seen / Math.max(1, a.total) - b.seen / Math.max(1, b.total));

  const lines = [
    "[INVESTIGATION_BOARD]",
    `CASE HOOK: ${display.CASE_HOOK ?? "기록을 따라 사건을 재구성하세요."}`,
    "",
    `REVIEWED_RECORDS: ${seenRecordIds.length}`,
    `TRACKED_LEADS: ${trackedSeen}/${trackedIds.length} ${renderProgressBar(trackedSeen, trackedIds.length)}`,
    `CRITICAL_RECORDS: ${criticalSeen}/${criticalTotal} ${renderProgressBar(criticalSeen, criticalTotal)}`,
    `ACTIVE_HYPOTHESES: ${hypothesisCount}`,
  ];

  if (openTracks.length > 0) {
    lines.push("", "OPEN THREADS:");
    for (const track of openTracks) {
      lines.push(
        `- ${track.title} ${renderProgressBar(track.seen, track.total)} ${track.seen}/${track.total}`,
        `  LEAD: ${track.lead}`,
        `  NEXT: ${track.prompt}`
      );
    }
  }

  const unseenCritical = config.solution.required_records.filter((id) => !seenRecordIds.includes(id));
  if (unseenCritical.length > 0) {
    lines.push("", `UNSEEN_CRITICAL_IDS: ${unseenCritical.join(", ")}`);
  }

  return lines.join("\n");
}
