import type { BackgroundConfig, BackgroundDevice } from '@lobechat/types';
import isEqual from 'fast-deep-equal';
import { useEffect, useRef, useState } from 'react';

import {
  MAX_BACKGROUND_IMAGES,
  normalizeBackgroundConfig,
  validateBackgroundFile,
} from '@/features/GlobalBackground/config';
import { useIsMobile } from '@/hooks/useIsMobile';
import { backgroundService } from '@/services/background';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

import { cropUploadedBackground } from './CropImage';
import { clearBackgroundDraft, readBackgroundDraft, writeBackgroundDraft } from './draftStorage';

type BackgroundNotice = 'limit' | 'size' | 'type' | 'uploadFailed';

export const useBackgroundSetting = () => {
  const mobile = useIsMobile();
  const [device, setDevice] = useState<BackgroundDevice>(mobile ? 'mobile' : 'desktop');
  const deviceChosen = useRef(false);
  const [drafts, setDrafts] = useState<Partial<Record<BackgroundDevice, BackgroundConfig>>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<BackgroundNotice>();
  const [canRetry, setCanRetry] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const retryFiles = useRef<File[]>([]);
  const mounted = useRef(true);
  const [setSettings, ready, userId] = useUserStore((s) => [
    s.setSettings,
    s.isUserStateInit,
    s.user?.id,
  ]);
  const backgrounds = useUserStore(
    (s) => userGeneralSettingsSelectors.config(s).background,
    isEqual,
  );
  const config = drafts[device] ?? normalizeBackgroundConfig(backgrounds?.[device]);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!deviceChosen.current) setDevice(mobile ? 'mobile' : 'desktop');
  }, [mobile]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  useEffect(() => {
    controller.current?.abort();
    setDrafts(
      userId
        ? {
            desktop: readBackgroundDraft(userId, 'desktop'),
            mobile: readBackgroundDraft(userId, 'mobile'),
          }
        : {},
    );
    setStatus('idle');
  }, [userId]);

  const update = (patch: Partial<BackgroundConfig>, target: BackgroundDevice = device) => {
    setDrafts((previous) => {
      const updated = normalizeBackgroundConfig({
        ...(previous[target] ?? backgrounds?.[target]),
        ...patch,
      });
      if (userId) writeBackgroundDraft(userId, target, updated);
      return { ...previous, [target]: updated };
    });
    setStatus('idle');
  };

  const upload = async (files: File[]) => {
    if (uploading) return;
    const remaining = MAX_BACKGROUND_IMAGES - configRef.current.images.length;
    if (!remaining) {
      setNotice('limit');
      return;
    }
    if (files.length > remaining) setNotice('limit');
    else setNotice(undefined);
    setCanRetry(false);
    const selected = files.slice(0, remaining);
    const abort = new AbortController();
    controller.current = abort;
    setUploading(true);
    const target = device;
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        const invalid = validateBackgroundFile(file);
        if (invalid) {
          setNotice(invalid === 'size' ? 'size' : 'type');
          continue;
        }
        retryFiles.current = selected.slice(index);
        const cropped = await cropUploadedBackground(file, target, abort.signal);
        if (!cropped || abort.signal.aborted || !mounted.current) break;
        const image = await backgroundService.uploadImage(cropped, abort);
        if (!mounted.current) break;
        const current = configRef.current;
        update(
          {
            activeImageId: current.activeImageId ?? image.id,
            enabled: true,
            images: [...current.images.filter((item) => item.id !== image.id), image],
          },
          target,
        );
      }
      retryFiles.current = [];
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error('Background upload failed', error);
        setNotice('uploadFailed');
        setCanRetry(true);
      }
    } finally {
      if (mounted.current) setUploading(false);
    }
  };

  const save = async () => {
    setStatus('saving');
    try {
      const next = normalizeBackgroundConfig(configRef.current);
      await setSettings({ general: { background: { [device]: next } } });
      if (userId) clearBackgroundDraft(userId, device);
      setDrafts((previous) => ({ ...previous, [device]: undefined }));
      setStatus('saved');
    } catch (error) {
      console.error('Background settings save failed', error);
      setStatus('failed');
    }
  };

  return {
    canRetry,
    cancelUpload: () => controller.current?.abort(),
    config,
    device,
    notice,
    ready,
    retryUpload: () => upload(retryFiles.current),
    save,
    setDevice: (next: BackgroundDevice) => {
      deviceChosen.current = true;
      setDevice(next);
      setStatus('idle');
      setNotice(undefined);
    },
    status,
    update,
    upload,
    uploading,
  };
};
