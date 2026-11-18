import { toRecord } from './object';

export const isConversationImageGeneration = (plugin: unknown) => {
  const value = toRecord(plugin);
  return value?.identifier === 'lobe-image-generation' && value.apiName === 'generateImage';
};

export const generatedImageFilePath = /^\/f\/(file_[\w-]{1,120})$/;
