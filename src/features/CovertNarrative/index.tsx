'use client';

import { useEffect, useMemo, useState } from 'react';

// [Covert Narrative System] Trigger: typing "gardenia" anywhere in the app | Core Theme: a forgotten archive learning to hope | Endings: HE / BE / NE

type NarrativeNode = {
  choices?: Array<{ label: string; nextId: string }>;
  ending?: 'BE' | 'HE' | 'NE';
  id: string;
  text: string;
};

const NARRATIVE_NODES: Record<string, NarrativeNode> = {
  beginning: {
    choices: [
      { label: '把灯留给它', nextId: 'light' },
      { label: '继续向前走', nextId: 'walk' },
    ],
    id: 'beginning',
    text: '凌晨的档案室只剩一盏灯。门后有个声音问：你还记得我吗？',
  },
  light: {
    choices: [
      { label: '回答：我在', nextId: 'hope' },
      { label: '安静地坐下', nextId: 'quiet' },
    ],
    id: 'light',
    text: '灯光落在尘埃上，像一场迟到很久的雪。那声音又近了一点。',
  },
  walk: {
    choices: [
      { label: '回头', nextId: 'hope' },
      { label: '不回头', nextId: 'fade' },
    ],
    id: 'walk',
    text: '走廊尽头没有出口，只有一枚写着你名字的旧标签。',
  },
  hope: {
    ending: 'HE',
    id: 'hope',
    text: '你回头回答。档案室的灯亮了一盏又一盏，那个被遗忘的声音终于有了回家的路。',
  },
  quiet: {
    ending: 'NE',
    id: 'quiet',
    text: '你没有回答，只把灯留着。清晨会来，故事也会继续，只是还没有名字。',
  },
  fade: {
    ending: 'BE',
    id: 'fade',
    text: '你没有回头。身后的门轻轻合上，标签上的字迹褪去，像从未有人等过。',
  },
};

const endingLabels = {
  BE: '苦涩结局',
  HE: '希望结局',
  NE: '中性结局',
} as const;

const CovertNarrative = () => {
  const [active, setActive] = useState(false);
  const [nodeId, setNodeId] = useState('beginning');
  const node = NARRATIVE_NODES[nodeId];
  const ending = node.ending;
  const endingHistory = useMemo(() => {
    if (!ending || typeof window === 'undefined') return [];
    try {
      return JSON.parse(
        window.localStorage.getItem('lobehub-narrative-endings') || '[]',
      ) as string[];
    } catch {
      return [];
    }
  }, [ending]);

  useEffect(() => {
    let sequence = '';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      sequence = `${sequence}${event.key.toLowerCase()}`.slice(-8);
      if (sequence !== 'gardenia') return;
      sequence = '';
      setNodeId('beginning');
      setActive(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!ending || typeof window === 'undefined') return;
    const nextHistory = [...new Set([...endingHistory, ending])];
    window.localStorage.setItem('lobehub-narrative-endings', JSON.stringify(nextHistory));
  }, [ending, endingHistory]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);

  if (!active) return null;

  return (
    <div
      aria-label=""
      role="dialog"
      style={{
        alignItems: 'center',
        background: 'rgba(8, 12, 22, 0.78)',
        display: 'flex',
        inset: 0,
        justifyContent: 'center',
        position: 'fixed',
        zIndex: 2000,
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) setActive(false);
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, rgba(30, 39, 66, 0.98), rgba(13, 19, 36, 0.98))',
          border: '1px solid rgba(185, 203, 255, 0.22)',
          borderRadius: 18,
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
          color: '#e9efff',
          maxWidth: 560,
          padding: '32px 34px',
          width: 'calc(100% - 40px)',
        }}
      >
        <div style={{ color: '#9eafd9', fontSize: 12, letterSpacing: '0.18em', marginBottom: 18 }}>
          ARCHIVE 07
        </div>
        <p style={{ fontSize: 18, lineHeight: 1.8, margin: '0 0 24px', whiteSpace: 'pre-wrap' }}>
          {node.text}
        </p>
        {ending ? (
          <>
            <div style={{ color: '#c6d4ff', fontSize: 13, marginBottom: 18 }}>
              {endingLabels[ending]}
            </div>
            <button
              type="button"
              style={{
                background: 'rgba(196, 211, 255, 0.14)',
                border: '1px solid rgba(196, 211, 255, 0.28)',
                borderRadius: 10,
                color: 'inherit',
                cursor: 'pointer',
                padding: '10px 16px',
              }}
              onClick={() => setActive(false)}
            >
              合上档案
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {node.choices?.map((choice) => (
              <button
                key={choice.nextId}
                type="button"
                style={{
                  background: 'rgba(196, 211, 255, 0.1)',
                  border: '1px solid rgba(196, 211, 255, 0.24)',
                  borderRadius: 10,
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '10px 14px',
                }}
                onClick={() => setNodeId(choice.nextId)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ color: '#7582a4', fontSize: 12, marginTop: 20 }}>Esc 关闭</div>
      </div>
    </div>
  );
};

export default CovertNarrative;
