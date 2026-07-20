'use client';

import { Form, TextArea } from '@lobehub/ui';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';

import { useStore } from '../store';

export interface AgentInstructionsEditorProps {
  disabled?: boolean;
  onChange: (value: string) => Promise<void> | void;
  value?: string;
}

export const AgentInstructionsEditor = memo<AgentInstructionsEditorProps>(
  ({ disabled, onChange, value }) => {
    const { t } = useTranslation('setting');
    const [draft, setDraft] = useState(value ?? '');

    useEffect(() => {
      setDraft(value ?? '');
    }, [value]);

    const save = async () => {
      if (disabled || draft === (value ?? '')) return;
      await onChange(draft);
    };

    return (
      <Form
        itemsType={'flat'}
        variant={'borderless'}
        items={[
          {
            children: (
              <TextArea
                autoSize={{ maxRows: 18, minRows: 6 }}
                disabled={disabled}
                placeholder={t('settingAgent.instructions.placeholder')}
                value={draft}
                variant={'filled'}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                  void save();
                }}
              />
            ),
            desc: t('settingAgent.instructions.desc'),
            label: t('settingAgent.instructions.title'),
            layout: 'vertical',
          },
        ]}
        {...FORM_STYLE}
      />
    );
  },
);

const AgentInstructions = memo(() => {
  const [disabled, instructions, updateConfig] = useStore((s) => [
    s.disabled,
    s.config.instructions,
    s.setAgentConfig,
  ]);

  return (
    <AgentInstructionsEditor
      disabled={disabled}
      value={instructions}
      onChange={(value) => updateConfig({ instructions: value })}
    />
  );
});

AgentInstructions.displayName = 'AgentInstructions';
AgentInstructionsEditor.displayName = 'AgentInstructionsEditor';

export default AgentInstructions;
