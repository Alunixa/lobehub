'use client';

import { memo } from 'react';

import CreateGenerationPage from '@/routes/(main)/(create)/features/CreateGenerationPage';

import ImageWorkspace from './features/ImageWorkspace';
import PromptInput from './features/PromptInput';
import { useImageReferenceUpload } from './features/PromptInput/useImageReferenceUpload';

interface ImagePageProps {
  mobile?: boolean;
}

export const ImagePage = memo<ImagePageProps>(({ mobile = false }) => {
  const { canDropImage, handleUploadFiles } = useImageReferenceUpload();

  return (
    <CreateGenerationPage
      PromptInput={PromptInput}
      Workspace={ImageWorkspace}
      dragDisabled={!canDropImage}
      mobile={mobile}
      path="/image"
      onUploadFiles={handleUploadFiles}
    />
  );
});

ImagePage.displayName = 'ImagePage';

const DesktopImagePage = memo(() => <ImagePage />);

DesktopImagePage.displayName = 'DesktopImagePage';

export default DesktopImagePage;
