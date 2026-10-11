import { memo } from 'react';

import ImageUpload from '@/routes/(main)/(create)/image/features/ConfigPanel/components/ImageUpload';
import {
  useVideoGenerationConfigParam,
  useVideoUploadingPreview,
} from '@/store/video/slices/generationConfig/hooks';

interface FrameUploadProps {
  paramName: 'endImageUrl' | 'imageUrl';
}

const FrameUpload = memo<FrameUploadProps>(({ paramName }) => {
  const { value, setValue, maxFileSize, imageConstraints } =
    useVideoGenerationConfigParam(paramName);
  const trackUpload = useVideoUploadingPreview();

  const handleChange = (
    data?: string | { dimensions?: { height: number; width: number }; url: string },
  ) => {
    const url = typeof data === 'string' ? data : data?.url;
    setValue(url ?? null);
  };

  return (
    <ImageUpload
      imageConstraints={imageConstraints}
      maxFileSize={maxFileSize}
      placeholderHeight={120}
      value={value}
      onChange={handleChange}
      onUploadingChange={trackUpload}
    />
  );
});

export default FrameUpload;
