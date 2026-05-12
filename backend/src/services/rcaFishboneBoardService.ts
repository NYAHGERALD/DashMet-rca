import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';

const MANAGED_BY = 'dashmet-rca-fishbone';
const LEGACY_DESCRIPTION_PREFIX = 'DASHMET_RCA_FISHBONE_BOARD:';

type FishboneCause = {
  id?: string;
  text?: string;
  fiveWhysAnalysis?: unknown;
};

type FishboneCategory = {
  id?: string;
  name?: string;
  causes?: FishboneCause[];
};

type FishboneData = {
  problem?: string;
  categories?: FishboneCategory[];
};

type ExcalidrawSnapshot = {
  elements?: any[];
  appState?: Record<string, any>;
  files?: Record<string, any>;
};

type SyncEventType =
  | 'FISHBONE_SAVE'
  | 'FISHBONE_WHITEBOARD_OPEN'
  | 'FISHBONE_REALTIME_UPDATE'
  | 'FISHBONE_SYNC_REQUESTED';

type RcaContext = Awaited<ReturnType<typeof loadRcaContext>>;

const COLOR_PALETTE = [
  { stroke: '#1565C0', bg: '#BBDEFB', text: '#0D47A1' },
  { stroke: '#0F766E', bg: '#CCFBF1', text: '#134E4A' },
  { stroke: '#C2410C', bg: '#FFEDD5', text: '#7C2D12' },
  { stroke: '#BE123C', bg: '#FFE4E6', text: '#881337' },
  { stroke: '#7C3AED', bg: '#EDE9FE', text: '#4C1D95' },
  { stroke: '#CA8A04', bg: '#FEF3C7', text: '#713F12' },
];

const CATEGORY_CARD_WIDTH = 470;
const CATEGORY_HEADER_HEIGHT = 62;
const CATEGORY_META_HEIGHT = 42;
const CATEGORY_CAUSE_TOP_OFFSET = CATEGORY_HEADER_HEIGHT + CATEGORY_META_HEIGHT + 14;
const CATEGORY_BOTTOM_PADDING = 34;
const CAUSE_CARD_GAP = 14;
const CAUSE_CARD_HORIZONTAL_PADDING = 30;
const CAUSE_TEXT_FONT_SIZE = 17;
const CAUSE_TEXT_LINE_HEIGHT = 1.28;
const CAUSE_TEXT_VERTICAL_PADDING = 36;
const CAUSE_WRAP_CHARS = 32;
const EFFECT_WRAP_CHARS = 42;

function safeId(value: string | undefined, fallback: string) {
  return (value || fallback).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}

function buildBoardDescription(incidentNumber?: string | null) {
  return [
    'Managed RCA fishbone whiteboard.',
    'Generated diagram elements are synchronized from structured RCA cause analysis.',
    'User annotations and collaboration items are preserved.',
    incidentNumber ? `Incident: ${incidentNumber}.` : '',
  ].filter(Boolean).join(' ');
}

function isGeneratedFishboneElement(element: any, rcaId: string) {
  return element?.customData?.managedBy === MANAGED_BY && element?.customData?.rcaId === rcaId;
}

function baseElement(rcaId: string, id: string, overrides: Record<string, any>) {
  const now = Date.now();
  const { customData, ...elementOverrides } = overrides;

  return {
    id: `rca-fishbone-${safeId(rcaId, 'rca')}-${id}`,
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    angle: 0,
    strokeColor: '#1F2937',
    backgroundColor: 'transparent',
    width: 0,
    height: 0,
    seed: Math.floor(Math.random() * 1_000_000),
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: now,
    link: null,
    locked: true,
    isDeleted: false,
    version: 1,
    versionNonce: Math.floor(Math.random() * 1_000_000),
    ...elementOverrides,
    customData: {
      managedBy: MANAGED_BY,
      rcaId,
      sourceLayer: 'RCA_GENERATED',
      ...(customData || {}),
    },
  };
}

function textElement(
  rcaId: string,
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize = 18,
  strokeColor = '#111827',
  align: 'left' | 'center' | 'right' = 'left',
  customData: Record<string, any> = {},
) {
  const approximateCharsPerLine = Math.max(12, Math.floor(width / Math.max(fontSize * 0.56, 1)));
  const estimatedLines = String(text || '')
    .split('\n')
    .reduce((count, line) => count + Math.max(1, Math.ceil(line.length / approximateCharsPerLine)), 0);

  return baseElement(rcaId, id, {
    type: 'text',
    x,
    y,
    width,
    height: Math.max(fontSize + 8, Math.ceil(estimatedLines * fontSize * 1.25) + 8),
    text,
    originalText: text,
    fontSize,
    fontFamily: 2,
    textAlign: align,
    verticalAlign: 'top',
    strokeColor,
    autoResize: false,
    lineHeight: 1.25,
    customData,
  });
}

function normalizeText(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text || fallback;
}

function wrapText(value: string, maxChars: number) {
  const words = normalizeText(value, '').split(' ').filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const chunks: string[] = [];
    let remaining = word;

    while (remaining.length > maxChars) {
      chunks.push(remaining.slice(0, maxChars - 1));
      remaining = remaining.slice(maxChars - 1);
    }

    chunks.push(remaining);

    chunks.forEach((chunk) => {
      if (!chunk) return;

      if (!current) {
        current = chunk;
        return;
      }

      if (`${current} ${chunk}`.length <= maxChars) {
        current = `${current} ${chunk}`;
        return;
      }

      lines.push(current);
      current = chunk;
    });
  });

  if (current) lines.push(current);
  return lines;
}

function buildWrappedParagraph(value: string, maxChars: number) {
  return wrapText(value, maxChars).join('\n');
}

function buildCauseBlock(cause: FishboneCause, maxChars: number) {
  const lines = wrapText(normalizeText(cause.text, 'Cause not defined'), maxChars);
  const status = cause.fiveWhysAnalysis ? ['  Analysis complete'] : [];
  return [`- ${lines[0] || 'Cause not defined'}`, ...lines.slice(1).map((line) => `  ${line}`), ...status].join('\n');
}

function countTextLines(text: string) {
  return Math.max(1, text.split('\n').length);
}

function causeBlockHeight(text: string) {
  return Math.max(
    72,
    Math.ceil(countTextLines(text) * CAUSE_TEXT_FONT_SIZE * CAUSE_TEXT_LINE_HEIGHT) + CAUSE_TEXT_VERTICAL_PADDING,
  );
}

function lineElement(
  rcaId: string,
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeColor = '#334155',
  strokeWidth = 2,
  customData: Record<string, any> = {},
) {
  return baseElement(rcaId, id, {
    type: 'line',
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    strokeColor,
    strokeWidth,
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    customData,
  });
}

function rectangleElement(
  rcaId: string,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  strokeColor: string,
  backgroundColor: string,
  customData: Record<string, any> = {},
) {
  return baseElement(rcaId, id, {
    type: 'rectangle',
    x,
    y,
    width,
    height,
    strokeColor,
    backgroundColor,
    roundness: { type: 3 },
    customData,
  });
}

function arrowElement(rcaId: string, id: string, x1: number, y1: number, x2: number, y2: number) {
  return baseElement(rcaId, id, {
    type: 'arrow',
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    strokeColor: '#334155',
    strokeWidth: 3,
    startArrowhead: null,
    endArrowhead: 'triangle',
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    customData: { sourceType: 'SPINE' },
  });
}

const CATEGORY_LAYOUT_HINTS = [
  { column: 0, side: 'top' as const, terms: ['man', 'people'] },
  { column: 0, side: 'bottom' as const, terms: ['machine', 'equipment'] },
  { column: 1, side: 'top' as const, terms: ['method', 'process'] },
  { column: 1, side: 'bottom' as const, terms: ['material', 'ingredient'] },
  { column: 2, side: 'top' as const, terms: ['measurement', 'measure'] },
  { column: 2, side: 'bottom' as const, terms: ['environment'] },
];

function getCategoryLayoutHint(categoryName: string) {
  const normalized = categoryName.toLowerCase();
  return CATEGORY_LAYOUT_HINTS.find((hint) => hint.terms.some((term) => normalized.includes(term)));
}

function positionCategories(categories: FishboneCategory[]) {
  const usedPositions = new Set<string>();
  let overflowColumn = 3;

  return categories.map((category, index) => {
    const name = normalizeText(category.name, `Category ${index + 1}`);
    const hint = getCategoryLayoutHint(name);
    let column = hint?.column ?? overflowColumn;
    const side = hint?.side ?? (index % 2 === 0 ? 'top' : 'bottom');

    while (usedPositions.has(`${column}:${side}`)) {
      column += 1;
    }

    if (!hint) {
      overflowColumn = Math.max(overflowColumn, column + (side === 'bottom' ? 1 : 0));
    }

    usedPositions.add(`${column}:${side}`);

    const causes = category.causes || [];
    const causeBlocks = causes.length > 0
      ? causes.map((cause) => buildCauseBlock(cause, CAUSE_WRAP_CHARS))
      : ['- No causes added yet'];
    const causeHeights = causeBlocks.map(causeBlockHeight);
    const bodyHeight = causeHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, causeHeights.length - 1) * CAUSE_CARD_GAP;

    return {
      category,
      name,
      side,
      column,
      causeBlocks,
      causeHeights,
      cardHeight: Math.max(210, CATEGORY_CAUSE_TOP_OFFSET + bodyHeight + CATEGORY_BOTTOM_PADDING),
    };
  }).sort((a, b) => a.column - b.column || (a.side === 'top' ? -1 : 1));
}

function buildGeneratedFishboneElements(rcaId: string, fishboneData: FishboneData) {
  const categories = (fishboneData.categories || []).filter((category) => category?.name);
  const visibleCategories = categories.length > 0 ? categories : [{ id: 'empty', name: 'Causes', causes: [] }];
  const positionedCategories = positionCategories(visibleCategories);
  const categorySpacing = 560;
  const spineStartX = 150;
  const firstAttachX = 460;
  const maxColumn = positionedCategories.reduce((max, item) => Math.max(max, item.column), 0);
  const lastAttachX = firstAttachX + maxColumn * categorySpacing;
  const headX = lastAttachX + 360;
  const effectX = headX + 95;
  const effectWidth = 500;
  const frameX = 80;
  const frameY = 70;
  const topCardTopY = frameY + 170;
  const maxTopCardHeight = positionedCategories
    .filter((item) => item.side === 'top')
    .reduce((max, item) => Math.max(max, item.cardHeight), 210);
  const topCardBottomY = topCardTopY + maxTopCardHeight;
  const spineY = topCardBottomY + 160;
  const bottomCardTopY = spineY + 160;
  const maxBottomY = positionedCategories
    .filter((item) => item.side === 'bottom')
    .reduce((max, item) => Math.max(max, bottomCardTopY + item.cardHeight), bottomCardTopY + 190);
  const frameWidth = effectX + effectWidth + 80 - frameX;
  const frameHeight = Math.max(1000, maxBottomY + 120 - frameY);
  const elements: any[] = [];

  elements.push(rectangleElement(rcaId, 'enterprise-frame', frameX, frameY, frameWidth, frameHeight, '#CBD5E1', '#F8FAFC', { sourceType: 'FRAME' }));
  elements.push(textElement(rcaId, 'title', 'RCA Fishbone (Ishikawa) Diagram', frameX + 44, frameY + 38, 700, 34, '#0F172A', 'left', { sourceType: 'TITLE' }));
  elements.push(textElement(rcaId, 'subtitle', 'Managed diagram synchronized from RCA Cause Analysis. Generated elements are locked; team annotations stay editable.', frameX + 46, frameY + 84, 920, 17, '#64748B', 'left', { sourceType: 'TITLE' }));
  elements.push(rectangleElement(rcaId, 'cause-count-badge', effectX + effectWidth - 230, frameY + 35, 190, 42, '#BFDBFE', '#EFF6FF', { sourceType: 'TITLE' }));
  elements.push(textElement(rcaId, 'cause-count-text', `${categories.reduce((sum, category) => sum + (category.causes?.length || 0), 0)} causes identified`, effectX + effectWidth - 210, frameY + 47, 150, 16, '#1D4ED8', 'center', { sourceType: 'TITLE' }));

  elements.push(arrowElement(rcaId, 'spine', spineStartX, spineY, headX, spineY));
  elements.push(lineElement(rcaId, 'effect-connector', headX, spineY, effectX, spineY, '#334155', 3, { sourceType: 'SPINE' }));

  const effectText = buildWrappedParagraph(fishboneData.problem || 'Problem statement not defined', EFFECT_WRAP_CHARS);
  const effectHeight = Math.max(190, 92 + countTextLines(effectText) * 24);
  elements.push(rectangleElement(rcaId, 'effect-box', effectX, spineY - effectHeight / 2, effectWidth, effectHeight, '#DC2626', '#FEF2F2', { sourceType: 'EFFECT' }));
  elements.push(rectangleElement(rcaId, 'effect-header', effectX, spineY - effectHeight / 2, effectWidth, 58, '#DC2626', '#FEE2E2', { sourceType: 'EFFECT' }));
  elements.push(textElement(rcaId, 'effect-title', 'EFFECT / PROBLEM STATEMENT', effectX + 26, spineY - effectHeight / 2 + 18, effectWidth - 52, 18, '#991B1B', 'center', { sourceType: 'EFFECT' }));
  elements.push(textElement(
    rcaId,
    'effect-text',
    effectText,
    effectX + 30,
    spineY - effectHeight / 2 + 82,
    effectWidth - 60,
    19,
    '#111827',
    'left',
    { sourceType: 'EFFECT' },
  ));

  positionedCategories.forEach((layoutItem, categoryIndex) => {
    const { category, side, column, cardHeight, causeBlocks, causeHeights, name } = layoutItem;
    const attachX = firstAttachX + column * categorySpacing;
    const cardWidth = CATEGORY_CARD_WIDTH;
    const cardX = attachX - cardWidth / 2;
    const cardY = side === 'top' ? topCardBottomY - cardHeight : bottomCardTopY;
    const connectorX = cardX + cardWidth / 2;
    const connectorY = side === 'top' ? cardY + cardHeight : cardY;
    const categoryId = safeId(category.id, `category-${categoryIndex}`);
    const colors = COLOR_PALETTE[categoryIndex % COLOR_PALETTE.length];
    const categoryMetadata = {
      sourceType: 'CATEGORY',
      categoryId: category.id || categoryId,
      categoryName: name,
    };

    elements.push(lineElement(rcaId, `rib-${categoryId}`, connectorX, connectorY, attachX, spineY, colors.stroke, 4, categoryMetadata));
    elements.push(rectangleElement(rcaId, `category-card-${categoryId}`, cardX, cardY, cardWidth, cardHeight, colors.stroke, colors.bg, categoryMetadata));
    elements.push(rectangleElement(rcaId, `category-header-${categoryId}`, cardX, cardY, cardWidth, CATEGORY_HEADER_HEIGHT, colors.stroke, colors.stroke, categoryMetadata));
    elements.push(textElement(rcaId, `category-label-${categoryId}`, name.toUpperCase(), cardX + 24, cardY + 20, cardWidth - 48, 19, '#FFFFFF', 'center', categoryMetadata));
    elements.push(textElement(
      rcaId,
      `category-count-${categoryId}`,
      `${category.causes?.length || 0} cause${(category.causes?.length || 0) === 1 ? '' : 's'}`,
      cardX + cardWidth - 150,
      cardY + CATEGORY_HEADER_HEIGHT + 15,
      118,
      14,
      colors.text,
      'right',
      categoryMetadata,
    ));

    let causeY = cardY + CATEGORY_CAUSE_TOP_OFFSET;
    causeBlocks.forEach((causeBlock, causeIndex) => {
      const cause = category.causes?.[causeIndex] || {};
      const causeId = safeId(cause.id, `cause-${categoryIndex}-${causeIndex}`);
      const causeHeight = causeHeights[causeIndex] || causeBlockHeight(causeBlock);
      const causeMetadata = {
        sourceType: 'CAUSE',
        categoryId: category.id || categoryId,
        categoryName: name,
        causeId: cause.id || causeId,
        causeText: cause.text || 'Cause',
      };

      elements.push(rectangleElement(
        rcaId,
        `cause-box-${causeId}`,
        cardX + CAUSE_CARD_HORIZONTAL_PADDING,
        causeY,
        cardWidth - CAUSE_CARD_HORIZONTAL_PADDING * 2,
        causeHeight,
        colors.stroke,
        '#FFFFFF',
        causeMetadata,
      ));
      elements.push(textElement(
        rcaId,
        `cause-text-${causeId}`,
        causeBlock,
        cardX + CAUSE_CARD_HORIZONTAL_PADDING + 18,
        causeY + 16,
        cardWidth - CAUSE_CARD_HORIZONTAL_PADDING * 2 - 36,
        CAUSE_TEXT_FONT_SIZE,
        cause.fiveWhysAnalysis ? '#166534' : '#0F172A',
        'left',
        causeMetadata,
      ));
      causeY += causeHeight + CAUSE_CARD_GAP;
    });
  });

  return elements;
}

function parseSnapshot(buffer: Buffer | Uint8Array | null): ExcalidrawSnapshot {
  if (!buffer) return {};
  try {
    return JSON.parse(Buffer.from(buffer).toString('utf-8'));
  } catch {
    return {};
  }
}

function buildSyncedSnapshot(rcaId: string, fishboneData: FishboneData, existingSnapshot: ExcalidrawSnapshot) {
  const existingElements = Array.isArray(existingSnapshot.elements) ? existingSnapshot.elements : [];
  const preservedElements = existingElements.filter((element) => !isGeneratedFishboneElement(element, rcaId));
  const generatedElements = buildGeneratedFishboneElements(rcaId, fishboneData);

  return {
    elements: [...generatedElements, ...preservedElements],
    appState: {
      viewBackgroundColor: existingSnapshot.appState?.viewBackgroundColor || '#ffffff',
      gridSize: existingSnapshot.appState?.gridSize || 20,
      scrollX: existingSnapshot.appState?.scrollX ?? -40,
      scrollY: existingSnapshot.appState?.scrollY ?? -40,
      zoom: existingSnapshot.appState?.zoom || { value: 0.45 },
    },
    files: existingSnapshot.files || {},
  };
}

function countGeneratedElements(snapshot: ExcalidrawSnapshot, rcaId: string) {
  const elements = Array.isArray(snapshot.elements) ? snapshot.elements : [];
  return elements.filter((element) => isGeneratedFishboneElement(element, rcaId) && !element.isDeleted).length;
}

function countAnnotationElements(snapshot: ExcalidrawSnapshot, rcaId: string) {
  const elements = Array.isArray(snapshot.elements) ? snapshot.elements : [];
  return elements.filter((element) => !isGeneratedFishboneElement(element, rcaId) && !element.isDeleted).length;
}

function elementRecords(linkId: string, rcaId: string, boardId: string, snapshot: ExcalidrawSnapshot) {
  const elements = Array.isArray(snapshot.elements) ? snapshot.elements : [];
  return elements
    .filter((element) => isGeneratedFishboneElement(element, rcaId) && !element.isDeleted)
    .map((element) => ({
      id: uuidv4(),
      linkId,
      rcaAnalysisId: rcaId,
      boardId,
      categoryId: element.customData?.categoryId || null,
      causeId: element.customData?.causeId || null,
      elementId: element.id,
      elementType: String(element.type || 'unknown'),
      sourceType: String(element.customData?.sourceType || 'GENERATED'),
      isGenerated: true,
      metadata: element.customData || {},
    }));
}

async function loadRcaContext(rcaId: string) {
  const rca = await prisma.rCAAnalysis.findUnique({
    where: { id: rcaId },
    include: {
      Incident: {
        select: {
          id: true,
          incidentNumber: true,
          customTitle: true,
          organizationId: true,
        },
      },
    },
  });

  if (!rca) {
    throw new Error('RCA analysis not found');
  }

  return rca;
}

async function findLegacyBoard(rca: RcaContext) {
  return prisma.board.findFirst({
    where: {
      organizationId: rca.Incident.organizationId,
      isArchived: false,
      AND: [
        { description: { contains: LEGACY_DESCRIPTION_PREFIX } },
        { description: { contains: `"managedBy":"${MANAGED_BY}"` } },
        { description: { contains: `"rcaId":"${rca.id}"` } },
      ],
    },
  });
}

async function ensureBoardLink(rca: RcaContext, userId: string) {
  const existingLink = await prisma.rCAFishboneBoardLink.findUnique({
    where: { rcaAnalysisId: rca.id },
    include: { board: true },
  });

  const titleBase = rca.Incident.incidentNumber || rca.Incident.customTitle || 'RCA';
  const title = `${titleBase} Fishbone Whiteboard`;
  const description = buildBoardDescription(rca.Incident.incidentNumber);

  if (existingLink) {
    const board = await prisma.board.update({
      where: { id: existingLink.boardId },
      data: { title, description, visibility: 'TEAM' },
    });

    return prisma.rCAFishboneBoardLink.update({
      where: { id: existingLink.id },
      data: {
        incidentId: rca.incidentId,
        organizationId: rca.Incident.organizationId,
        boardId: board.id,
      },
    });
  }

  const legacyBoard = await findLegacyBoard(rca);
  const board = legacyBoard
    ? await prisma.board.update({
        where: { id: legacyBoard.id },
        data: { title, description, visibility: 'TEAM' },
      })
    : await prisma.board.create({
        data: {
          type: 'WHITEBOARD',
          title,
          description,
          ownerId: userId || rca.analystId,
          organizationId: rca.Incident.organizationId,
          visibility: 'TEAM',
          collaborators: {
            create: { userId: userId || rca.analystId, role: 'OWNER' },
          },
        },
      });

  return prisma.rCAFishboneBoardLink.create({
    data: {
      rcaAnalysisId: rca.id,
      incidentId: rca.incidentId,
      organizationId: rca.Incident.organizationId,
      boardId: board.id,
      syncStatus: 'PENDING',
      createdById: userId || rca.analystId,
    },
  });
}

async function ensureCollaborator(boardId: string, boardOwnerId: string, userId: string) {
  if (!userId || boardOwnerId === userId) return;

  await prisma.boardCollaborator.upsert({
    where: { boardId_userId: { boardId, userId } },
    update: { role: 'EDITOR' },
    create: { boardId, userId, role: 'EDITOR' },
  });
}

async function createSyncEvent(
  rca: RcaContext,
  linkId: string,
  boardId: string,
  userId: string,
  eventType: SyncEventType,
) {
  return prisma.rCAFishboneSyncEvent.create({
    data: {
      linkId,
      rcaAnalysisId: rca.id,
      incidentId: rca.incidentId,
      organizationId: rca.Incident.organizationId,
      boardId,
      eventType,
      status: 'PROCESSING',
      requestedById: userId || null,
      startedAt: new Date(),
    },
  });
}

export async function syncRcaFishboneBoard(
  rcaId: string,
  userId: string,
  fishboneOverride?: FishboneData,
  eventType: SyncEventType = 'FISHBONE_SYNC_REQUESTED',
) {
  const rca = await loadRcaContext(rcaId);
  const fishboneData = fishboneOverride || ((rca.fishboneData as FishboneData | null) || { problem: '', categories: [] });
  const link = await ensureBoardLink(rca, userId);
  const board = await prisma.board.findUniqueOrThrow({
    where: { id: link.boardId },
    select: { id: true, ownerId: true, yjsState: true },
  });
  await ensureCollaborator(board.id, board.ownerId, userId);

  const syncEvent = await createSyncEvent(rca, link.id, board.id, userId, eventType);

  try {
    await prisma.rCAFishboneBoardLink.update({
      where: { id: link.id },
      data: {
        syncStatus: 'SYNCING',
        lastSyncError: null,
        lastSyncedById: userId || null,
      },
    });

    const existingSnapshot = parseSnapshot(board.yjsState || null);
    const snapshot = buildSyncedSnapshot(rcaId, fishboneData, existingSnapshot);
    const generatedElementCount = countGeneratedElements(snapshot, rcaId);
    const annotationElementCount = countAnnotationElements(snapshot, rcaId);
    const records = elementRecords(link.id, rcaId, board.id, snapshot);
    const now = new Date();
    const transaction: any[] = [
      prisma.board.update({
        where: { id: board.id },
        data: {
          yjsState: Buffer.from(JSON.stringify(snapshot), 'utf-8'),
          updatedAt: now,
        },
      }),
      prisma.rCAFishboneDiagramElement.deleteMany({
        where: { linkId: link.id },
      }),
    ];

    if (records.length > 0) {
      transaction.push(prisma.rCAFishboneDiagramElement.createMany({ data: records }));
    }

    transaction.push(
      prisma.rCAFishboneBoardLink.update({
        where: { id: link.id },
        data: {
          sourceVersion: { increment: 1 },
          syncStatus: 'SYNCED',
          lastSyncedAt: now,
          lastSyncError: null,
          lastSyncedById: userId || null,
          generatedElementCount,
          annotationElementCount,
        },
      }),
      prisma.rCAFishboneSyncEvent.update({
        where: { id: syncEvent.id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
        },
      }),
    );

    const [updatedBoard] = await prisma.$transaction(transaction);
    const updatedLink = await prisma.rCAFishboneBoardLink.findUnique({
      where: { id: link.id },
    });

    return {
      board: updatedBoard,
      link: updatedLink,
      snapshot,
      syncEventId: syncEvent.id,
    };
  } catch (error: any) {
    const message = error?.message || 'RCA fishbone whiteboard sync failed';
    await prisma.$transaction([
      prisma.rCAFishboneBoardLink.update({
        where: { id: link.id },
        data: {
          syncStatus: 'FAILED',
          lastSyncError: message,
          lastSyncedById: userId || null,
        },
      }),
      prisma.rCAFishboneSyncEvent.update({
        where: { id: syncEvent.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
          completedAt: new Date(),
        },
      }),
    ]);
    throw error;
  }
}

export default {
  syncRcaFishboneBoard,
};
