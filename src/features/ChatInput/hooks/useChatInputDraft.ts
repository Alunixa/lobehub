import type { IEditor } from '@lobehub/editor';
import { debounce } from 'es-toolkit/compat';
import { useCallback, useEffect, useMemo } from 'react';

import { getDraft, getDraftCompositionStart, removeDraft, saveDraft } from '../draftStorage';
import { useStoreApi } from '../store';

const SAVE_DEBOUNCE_MS = 500;

export const useChatInputDraft = () => {
  const storeApi = useStoreApi();

  const saveDraftDebounced = useMemo(
    () =>
      debounce(() => {
        const { compositionClock, draftKey, editor, getMarkdownContent, getJSONState } =
          storeApi.getState();
        if (!draftKey || !editor) return;

        if (getMarkdownContent().trim().length === 0) {
          removeDraft(draftKey);
          return;
        }

        const json = getJSONState();
        if (json) saveDraft(draftKey, json, compositionClock.start);
      }, SAVE_DEBOUNCE_MS),
    [storeApi],
  );

  useEffect(() => () => saveDraftDebounced.flush(), [saveDraftDebounced]);

  const restoreDraft = useCallback(
    (editor: IEditor) => {
      const { draftKey } = storeApi.getState();
      if (!draftKey) return;

      if (!editor.isEmpty) return;

      const draft = getDraft(draftKey);
      if (draft) {
        editor.setDocument('json', draft);
        storeApi.getState().compositionClock.restore(getDraftCompositionStart(draftKey));
      }
    },
    [storeApi],
  );

  return { restoreDraft, saveDraftDebounced };
};
