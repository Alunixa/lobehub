import { Input } from '@lobehub/ui';
import { memo, useEffect, useRef } from 'react';

interface AttachmentRetentionInputProps {
  disabled?: boolean;
  id: string;
  label: string;
  onSave: (value: number) => Promise<void>;
  value: number;
}

export const AttachmentRetentionInput = memo<AttachmentRetentionInputProps>(
  ({ disabled, id, label, onSave, value }) => {
    const draft = useRef(String(value));
    const saved = useRef(value);
    const commit = () => {
      if (!draft.current.trim()) return;
      const count = Number(draft.current);
      if (!Number.isSafeInteger(count) || count < 0 || count === saved.current) return;
      saved.current = count;
      void onSave(count);
    };
    // Closing the panel must not discard an edited count.
    const commitRef = useRef(commit);
    commitRef.current = commit;
    useEffect(() => () => commitRef.current(), []);

    return (
      <Input
        required
        aria-label={label}
        defaultValue={value}
        disabled={disabled}
        id={id}
        inputMode={'numeric'}
        max={Number.MAX_SAFE_INTEGER}
        min={0}
        step={1}
        type={'number'}
        onBlur={(event) => {
          if (event.currentTarget.reportValidity()) commit();
        }}
        onChange={(event) => {
          draft.current = event.target.value;
        }}
        onPressEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.blur();
        }}
      />
    );
  },
);
